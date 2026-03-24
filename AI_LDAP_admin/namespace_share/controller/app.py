import hashlib
import logging
import os
import time
from typing import Tuple

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from parser import build_namespace_nfs_path, sanitize_namespace_token, to_volume_name


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("namespace-share-controller")

PROFILE_GROUP = "kubeflow.org"
PROFILE_VERSION = "v1"
PROFILE_PLURAL = "profiles"
PODDEFAULT_GROUP = "kubeflow.org"
PODDEFAULT_VERSION = "v1alpha1"
PODDEFAULT_PLURAL = "poddefaults"

NFS_NAMESPACE = os.getenv("NFS_NAMESPACE", "kubeflow")
NFS_DEPLOYMENT = os.getenv("NFS_DEPLOYMENT", "nfs-client-provisioner")
NFS_CONFIGMAP = os.getenv("NFS_CONFIGMAP", "namespace-share-nfs-defaults")
PODDEFAULT_NAME = os.getenv("NAMESPACE_SHARE_PODDEFAULT_NAME", "namespace-share")
SELECTOR_LABEL = os.getenv("NAMESPACE_SHARE_SELECTOR_LABEL", "groupshare")
SELECTOR_VALUE = os.getenv("NAMESPACE_SHARE_SELECTOR_VALUE", "enabled")
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "20"))


class NamespaceShareController:
    def __init__(self) -> None:
        config.load_incluster_config()
        self.co_api = client.CustomObjectsApi()
        self.apps_api = client.AppsV1Api()
        self.core_api = client.CoreV1Api()
        self.nfs_server, self.nfs_path = self._load_nfs_settings()

    def _load_nfs_settings(self) -> Tuple[str, str]:
        dep = self.apps_api.read_namespaced_deployment(name=NFS_DEPLOYMENT, namespace=NFS_NAMESPACE)
        env_map = {}
        for container in dep.spec.template.spec.containers:
            for env_var in container.env or []:
                env_map[env_var.name] = env_var.value

        cm_data = {}
        try:
            cm = self.core_api.read_namespaced_config_map(name=NFS_CONFIGMAP, namespace=NFS_NAMESPACE)
            cm_data = cm.data or {}
        except ApiException as exc:
            if exc.status != 404:
                raise

        nfs_path = (cm_data.get("NFS_PATH") or env_map.get("NFS_PATH") or "").strip()
        nfs_server = (cm_data.get("NFS_SERVER") or env_map.get("NFS_SERVER") or "").strip()
        if not nfs_path:
            raise RuntimeError("NFS_PATH missing from namespace-share ConfigMap and provisioner deployment env")
        if not nfs_server:
            raise RuntimeError("NFS_SERVER missing from namespace-share ConfigMap and provisioner deployment env")

        logger.info("[INFO] Loaded namespace-share NFS settings: server=%s path=%s", nfs_server, nfs_path)
        return nfs_server, nfs_path

    def _build_spec(self, namespace: str) -> dict:
        mount_token = sanitize_namespace_token(namespace)
        if not mount_token:
            raise RuntimeError(f"namespace '{namespace}' cannot be sanitized")

        volume_name = to_volume_name(namespace)
        nfs_path = build_namespace_nfs_path(self.nfs_path, namespace)

        annotations = {
            "namespace-share.kubeflow.org/nfs-server": self.nfs_server,
            "namespace-share.kubeflow.org/allowed-volumes": volume_name,
            "namespace-share.kubeflow.org/allowed-paths": nfs_path,
            "namespace-share.kubeflow.org/writable-volumes": volume_name,
        }

        return {
            "apiVersion": "kubeflow.org/v1alpha1",
            "kind": "PodDefault",
            "metadata": {
                "name": PODDEFAULT_NAME,
                "annotations": annotations,
            },
            "spec": {
                "desc": "NamespaceShare auto-generated mount",
                "selector": {"matchLabels": {SELECTOR_LABEL: SELECTOR_VALUE}},
                "volumeMounts": [
                    {
                        "name": volume_name,
                        "mountPath": f"/mnt/namespaces/{mount_token}",
                        "readOnly": False,
                    }
                ],
                "volumes": [
                    {
                        "name": volume_name,
                        "nfs": {
                            "server": self.nfs_server,
                            "path": nfs_path,
                            "readOnly": False,
                        },
                    }
                ],
            },
        }

    def _hash_namespace(self, namespace: str) -> str:
        raw = f"{namespace}|{self.nfs_server}|{self.nfs_path}|{SELECTOR_LABEL}|{SELECTOR_VALUE}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def sync_profile(self, profile: dict) -> None:
        namespace = (profile.get("metadata", {}) or {}).get("name", "")
        if not namespace:
            return

        current_hash = self._hash_namespace(namespace)
        body = self._build_spec(namespace)
        body["metadata"]["namespace"] = namespace
        body["metadata"]["annotations"]["namespace-share.kubeflow.org/hash"] = current_hash

        try:
            existing = self.co_api.get_namespaced_custom_object(
                group=PODDEFAULT_GROUP,
                version=PODDEFAULT_VERSION,
                namespace=namespace,
                plural=PODDEFAULT_PLURAL,
                name=PODDEFAULT_NAME,
            )
            existing_hash = (
                existing.get("metadata", {})
                .get("annotations", {})
                .get("namespace-share.kubeflow.org/hash", "")
            )
            if existing_hash == current_hash:
                logger.info("[INFO] Synced Profile namespace=%s no changes", namespace)
                return
            self.co_api.patch_namespaced_custom_object(
                group=PODDEFAULT_GROUP,
                version=PODDEFAULT_VERSION,
                namespace=namespace,
                plural=PODDEFAULT_PLURAL,
                name=PODDEFAULT_NAME,
                body=body,
            )
            action = "Updated"
        except ApiException as exc:
            if exc.status != 404:
                raise
            self.co_api.create_namespaced_custom_object(
                group=PODDEFAULT_GROUP,
                version=PODDEFAULT_VERSION,
                namespace=namespace,
                plural=PODDEFAULT_PLURAL,
                body=body,
            )
            action = "Created"

        logger.info("[INFO] %s PodDefault namespace=%s name=%s", action, namespace, PODDEFAULT_NAME)

    def run(self) -> None:
        while True:
            try:
                profiles = self.co_api.list_cluster_custom_object(
                    group=PROFILE_GROUP,
                    version=PROFILE_VERSION,
                    plural=PROFILE_PLURAL,
                )
                for profile in profiles.get("items", []):
                    self.sync_profile(profile)
            except Exception as exc:
                logger.exception("controller loop failed: %s", exc)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    controller = NamespaceShareController()
    controller.run()
