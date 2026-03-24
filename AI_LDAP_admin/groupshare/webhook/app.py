import logging
import os
from typing import Dict

from flask import Flask, jsonify, request
from kubernetes import client, config
from kubernetes.client.rest import ApiException

from rules import evaluate_rules, parse_csv


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("groupshare-webhook")

PODDEFAULT_NAME = os.getenv("GROUPSHARE_PODDEFAULT_NAME", "groupshare")
NAMESPACE_SHARE_PODDEFAULT_NAME = os.getenv("NAMESPACE_SHARE_PODDEFAULT_NAME", "namespace-share")
PODDEFAULT_GROUP = "kubeflow.org"
PODDEFAULT_VERSION = "v1alpha1"
PODDEFAULT_PLURAL = "poddefaults"

app = Flask(__name__)
config.load_incluster_config()
co_api = client.CustomObjectsApi()


def admission_response(uid: str, allowed: bool, message: str = "", code: int = 403) -> Dict:
    response = {"uid": uid, "allowed": allowed}
    if not allowed:
        response["status"] = {"code": code, "message": message}
    return {"apiVersion": "admission.k8s.io/v1", "kind": "AdmissionReview", "response": response}


def load_poddefault_annotations(namespace: str, poddefault_name: str, required: bool = True) -> Dict:
    try:
        poddefault = co_api.get_namespaced_custom_object(
            group=PODDEFAULT_GROUP,
            version=PODDEFAULT_VERSION,
            namespace=namespace,
            plural=PODDEFAULT_PLURAL,
            name=poddefault_name,
        )
        return poddefault.get("metadata", {}).get("annotations", {}) or {}
    except ApiException as exc:
        if exc.status == 404 and not required:
            return {}
        raise


def load_namespace_policy(namespace: str) -> Dict:
    groupshare_annotations = load_poddefault_annotations(namespace, PODDEFAULT_NAME, required=True)
    namespace_share_annotations = load_poddefault_annotations(
        namespace,
        NAMESPACE_SHARE_PODDEFAULT_NAME,
        required=False,
    )
    expected_servers = {
        server
        for server in [
            groupshare_annotations.get("groupshare.kubeflow.org/nfs-server", ""),
            namespace_share_annotations.get("namespace-share.kubeflow.org/nfs-server", ""),
        ]
        if server
    }
    if len(expected_servers) > 1:
        raise RuntimeError(f"conflicting managed NFS servers detected: {sorted(expected_servers)}")

    expected_nfs_server = next(iter(expected_servers), "")
    allowed_volume_names = parse_csv(groupshare_annotations.get("groupshare.kubeflow.org/allowed-volumes", ""))
    allowed_volume_names.update(
        parse_csv(namespace_share_annotations.get("namespace-share.kubeflow.org/allowed-volumes", ""))
    )
    allowed_nfs_paths = parse_csv(groupshare_annotations.get("groupshare.kubeflow.org/allowed-paths", ""))
    allowed_nfs_paths.update(
        parse_csv(namespace_share_annotations.get("namespace-share.kubeflow.org/allowed-paths", ""))
    )
    admin_volume_names = parse_csv(groupshare_annotations.get("groupshare.kubeflow.org/admin-groups", ""))
    writable_volume_names = parse_csv(
        namespace_share_annotations.get("namespace-share.kubeflow.org/writable-volumes", "")
    )

    return {
        "expected_nfs_server": expected_nfs_server,
        "allowed_volume_names": allowed_volume_names,
        "allowed_nfs_paths": allowed_nfs_paths,
        "admin_volume_names": admin_volume_names,
        "writable_volume_names": writable_volume_names,
    }


@app.route("/healthz", methods=["GET"])
def healthz():
    return "ok", 200


@app.route("/validate", methods=["POST"])
def validate():
    try:
        review = request.get_json(force=True)
        req = review["request"]
        uid = req["uid"]
        operation = req.get("operation", "")
        namespace = req.get("namespace", "")
        user = req.get("userInfo", {}).get("username", "unknown")
        user_groups = req.get("userInfo", {}).get("groups", [])
        obj = req.get("object", {})

        if req.get("kind", {}).get("group") != "kubeflow.org" or req.get("kind", {}).get("kind") != "Notebook":
            return jsonify(admission_response(uid, True))

        if operation not in {"CREATE", "UPDATE"}:
            return jsonify(admission_response(uid, True))

        policy = load_namespace_policy(namespace)
        allowed, rule, message = evaluate_rules(
            notebook_obj=obj,
            user_groups=user_groups,
            expected_nfs_server=policy["expected_nfs_server"],
            allowed_volume_names=policy["allowed_volume_names"],
            allowed_nfs_paths=policy["allowed_nfs_paths"],
            admin_volume_names=policy["admin_volume_names"],
            writable_volume_names=policy["writable_volume_names"],
        )

        if not allowed:
            attempted_paths = []
            for volume in (obj.get("spec", {}).get("template", {}).get("spec", {}).get("volumes", []) or []):
                if volume.get("nfs", {}).get("path"):
                    attempted_paths.append(volume["nfs"]["path"])
            logger.warning(
                "[DENY] Request rejected: rule=%s user=%s namespace=%s paths=%s reason=%s",
                rule,
                user,
                namespace,
                attempted_paths,
                message,
            )
            return jsonify(admission_response(uid, False, f"Security Violation ({rule}): {message}"))

        return jsonify(admission_response(uid, True))
    except Exception as exc:
        logger.exception("[DENY] Request rejected: webhook internal error fail-closed: %s", exc)
        uid = "unknown"
        try:
            uid = request.get_json(force=True).get("request", {}).get("uid", "unknown")
        except Exception:
            pass
        return jsonify(admission_response(uid, False, "webhook internal error (fail-closed)", 500))


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8443"))
    cert = os.getenv("TLS_CERT_FILE", "/tls/tls.crt")
    key = os.getenv("TLS_KEY_FILE", "/tls/tls.key")
    app.run(host="0.0.0.0", port=port, ssl_context=(cert, key))
