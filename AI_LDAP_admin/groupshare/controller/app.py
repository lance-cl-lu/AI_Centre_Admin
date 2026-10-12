import datetime
import hashlib
import logging
import os
import time
from typing import Dict, List, Optional, Tuple

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from parser import (
    build_group_nfs_path,
    parse_csv_list,
    parse_manager_groups,
    intersect_groups,
    sanitize_group_token,
    to_volume_name,
)


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("groupshare-controller")

PROFILE_GROUP = "kubeflow.org"
PROFILE_VERSION = "v1"
PROFILE_PLURAL = "profiles"
PODDEFAULT_GROUP = "kubeflow.org"
PODDEFAULT_VERSION = "v1alpha1"
PODDEFAULT_PLURAL = "poddefaults"

NFS_NAMESPACE = os.getenv("NFS_NAMESPACE", "kubeflow")
NFS_DEPLOYMENT = os.getenv("NFS_DEPLOYMENT", "nfs-client-provisioner")
NFS_CONFIGMAP = os.getenv("NFS_CONFIGMAP", "groupshare-nfs-defaults")
PODDEFAULT_NAME = os.getenv("GROUPSHARE_PODDEFAULT_NAME", "groupshare")
PODDEFAULT_SELECTOR_VERSION = "all-notebooks-v1"
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "20"))
NOTEBOOK_POD_LABEL = "notebook-name"
RESTART_REQUIRED_ANNOTATION = "groupshare.kubeflow.org/restart-required"


class GroupshareController:
    def __init__(self) -> None:
        config.load_incluster_config()
        self.co_api = client.CustomObjectsApi()
        self.apps_api = client.AppsV1Api()
        self.core_api = client.CoreV1Api()
        self.nfs_server, self.nfs_path = "", ""
        self.desired_mounts: Dict[str, Dict[str, Tuple[str, bool]]] = {}

    def _load_nfs_settings(self) -> Tuple[str, str]:
        # The ConfigMap written by apply.sh is authoritative. The provisioner Deployment is only a
        # fallback source, so a cluster whose provisioner has another name or namespace still works.
        cm_data = {}
        try:
            cm = self.core_api.read_namespaced_config_map(name=NFS_CONFIGMAP, namespace=NFS_NAMESPACE)
            cm_data = cm.data or {}
        except ApiException as exc:
            if exc.status != 404:
                raise

        nfs_path = (cm_data.get("NFS_PATH") or "").strip()
        nfs_server = (cm_data.get("NFS_SERVER") or "").strip()
        if not nfs_path or not nfs_server:
            env_map = {}
            try:
                dep = self.apps_api.read_namespaced_deployment(name=NFS_DEPLOYMENT, namespace=NFS_NAMESPACE)
                for container in dep.spec.template.spec.containers:
                    for env_var in container.env or []:
                        env_map[env_var.name] = env_var.value
            except ApiException as exc:
                if exc.status != 404:
                    raise
            nfs_path = nfs_path or (env_map.get("NFS_PATH") or "").strip()
            nfs_server = nfs_server or (env_map.get("NFS_SERVER") or "").strip()

        if not nfs_path:
            raise RuntimeError(
                f"NFS_PATH missing from ConfigMap {NFS_NAMESPACE}/{NFS_CONFIGMAP} and provisioner deployment env"
            )
        if not nfs_server:
            raise RuntimeError(
                f"NFS_SERVER missing from ConfigMap {NFS_NAMESPACE}/{NFS_CONFIGMAP} and provisioner deployment env"
            )

        if (nfs_server, nfs_path) != (self.nfs_server, self.nfs_path):
            logger.info("[INFO] Loaded NFS settings: server=%s path=%s", nfs_server, nfs_path)
        return nfs_server, nfs_path

    def _build_spec(self, groups: List[str], admin_groups: List[str]) -> dict:
        admin_set = set(admin_groups)

        volume_mounts = []
        volumes = []
        volume_names = []
        sanitized_admin_volume_names = []
        allowed_nfs_paths = []

        for group in groups:
            mount_token = sanitize_group_token(group)
            if not mount_token:
                continue

            volume_name = to_volume_name(group)
            volume_names.append(volume_name)
            if group in admin_set:
                sanitized_admin_volume_names.append(volume_name)

            nfs_path = build_group_nfs_path(self.nfs_path, group)
            allowed_nfs_paths.append(nfs_path)

            volume_mounts.append(
                {
                    "name": volume_name,
                    "mountPath": f"/mnt/groups/{mount_token}",
                    "readOnly": group not in admin_set,
                }
            )

            volumes.append(
                {
                    "name": volume_name,
                    "nfs": {
                        "server": self.nfs_server,
                        "path": nfs_path,
                        "readOnly": group not in admin_set,
                    },
                }
            )

        annotations = {
            "groupshare.kubeflow.org/nfs-server": self.nfs_server,
            "groupshare.kubeflow.org/allowed-volumes": ",".join(volume_names),
            "groupshare.kubeflow.org/admin-groups": ",".join(sanitized_admin_volume_names),
            "groupshare.kubeflow.org/allowed-paths": ",".join(allowed_nfs_paths),
        }

        return {
            "apiVersion": "kubeflow.org/v1alpha1",
            "kind": "PodDefault",
            "metadata": {
                "name": PODDEFAULT_NAME,
                "annotations": annotations,
            },
            "spec": {
                "desc": "GroupShare auto-generated mounts",
                "selector": {},
                "volumeMounts": volume_mounts,
                "volumes": volumes,
            },
        }

    def _hash_annotations(self, groups_raw: str, managers_raw: str) -> str:
        raw = f"{groups_raw}|{managers_raw}|{self.nfs_server}|{self.nfs_path}|{PODDEFAULT_SELECTOR_VERSION}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def sync_profile(self, profile: dict) -> None:
        metadata = profile.get("metadata", {})
        annotations = metadata.get("annotations", {}) or {}
        namespace = metadata.get("name")

        if not namespace:
            return

        groups_raw = annotations.get("group", "")
        managers_raw = parse_manager_groups(annotations)

        groups = parse_csv_list(groups_raw)
        managers = parse_csv_list(managers_raw)
        admin_groups, warnings = intersect_groups(groups, managers)

        for warning in warnings:
            logger.warning("[WARN] %s namespace=%s", warning, namespace)

        current_hash = self._hash_annotations(groups_raw, managers_raw)
        body = self._build_spec(groups, admin_groups)
        self.desired_mounts[namespace] = {
            volume["name"]: (volume["nfs"]["path"], volume["nfs"]["readOnly"]) for volume in body["spec"]["volumes"]
        }
        body["metadata"]["namespace"] = namespace
        body["metadata"]["annotations"]["groupshare.kubeflow.org/hash"] = current_hash

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
                .get("groupshare.kubeflow.org/hash", "")
            )
            existing_selector = existing.get("spec", {}).get("selector", {})
            desired_selector = body.get("spec", {}).get("selector", {})
            if existing_hash == current_hash and existing_selector == desired_selector:
                logger.info("[INFO] Synced Profile namespace=%s no changes", namespace)
                return
            body["metadata"]["resourceVersion"] = existing.get("metadata", {}).get("resourceVersion")
            self.co_api.replace_namespaced_custom_object(
                group=PODDEFAULT_GROUP,
                version=PODDEFAULT_VERSION,
                namespace=namespace,
                plural=PODDEFAULT_PLURAL,
                name=PODDEFAULT_NAME,
                body=body,
            )
            action = "Updated"
        except ApiException as e:
            if e.status != 404:
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

    def _actual_mounts(self, pod) -> Dict[str, Tuple[str, bool]]:
        mounts = {}
        for volume in pod.spec.volumes or []:
            nfs = getattr(volume, "nfs", None)
            if not volume.name.startswith("gs-") or nfs is None or nfs.server != self.nfs_server:
                continue
            mounts[volume.name] = (nfs.path, bool(nfs.read_only))
        return mounts

    @staticmethod
    def describe_mount_drift(
        desired: Dict[str, Tuple[str, bool]], actual: Dict[str, Tuple[str, bool]]
    ) -> Optional[str]:
        """Describe how a Pod's group mounts differ from its PodDefault, or None when they match."""
        added = sorted(set(desired) - set(actual))
        removed = sorted(set(actual) - set(desired))
        changed = sorted(name for name in set(desired) & set(actual) if desired[name] != actual[name])
        parts = []
        if added:
            parts.append("added=" + ",".join(added))
        if removed:
            parts.append("removed=" + ",".join(removed))
        if changed:
            parts.append("changed=" + ",".join(changed))
        return ";".join(parts) or None

    def _emit_restart_event(self, pod, notebook_name: str, drift: str) -> None:
        namespace = pod.metadata.namespace
        involved = {"apiVersion": "v1", "kind": "Pod", "name": pod.metadata.name, "namespace": namespace,
                    "uid": pod.metadata.uid}
        try:
            notebook = self.co_api.get_namespaced_custom_object(
                group="kubeflow.org", version="v1", namespace=namespace, plural="notebooks", name=notebook_name
            )
            involved = {"apiVersion": "kubeflow.org/v1", "kind": "Notebook", "name": notebook_name,
                        "namespace": namespace, "uid": notebook["metadata"]["uid"]}
        except ApiException as exc:
            logger.warning("[WARN] Notebook %s/%s not readable for event: %s", namespace, notebook_name, exc.status)

        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.core_api.create_namespaced_event(
            namespace=namespace,
            body={
                "apiVersion": "v1",
                "kind": "Event",
                "metadata": {"generateName": f"{pod.metadata.name}.groupshare-", "namespace": namespace},
                "involvedObject": involved,
                "type": "Warning",
                "reason": "GroupShareRestartRequired",
                "message": (
                    f"Group share mounts changed ({drift}). Stop and start this notebook to apply them; "
                    "files in /home/jovyan are kept."
                ),
                "source": {"component": "groupshare-controller"},
                "reportingComponent": "groupshare-controller",
                "firstTimestamp": now,
                "lastTimestamp": now,
                "count": 1,
            },
        )

    def check_notebook_pods(self) -> None:
        """Flag running notebook Pods whose group mounts are older than their PodDefault.

        Kubernetes cannot change the volumes of a running Pod, so the controller only annotates the Pod
        and emits an Event; the new mounts apply the next time the notebook restarts.
        """
        pods = self.core_api.list_pod_for_all_namespaces(label_selector=NOTEBOOK_POD_LABEL)
        for pod in pods.items:
            namespace = pod.metadata.namespace
            desired = self.desired_mounts.get(namespace)
            if desired is None or pod.status.phase not in ("Pending", "Running"):
                continue

            drift = self.describe_mount_drift(desired, self._actual_mounts(pod))
            annotations = pod.metadata.annotations or {}
            if annotations.get(RESTART_REQUIRED_ANNOTATION) == drift:
                continue

            try:
                self.core_api.patch_namespaced_pod(
                    name=pod.metadata.name,
                    namespace=namespace,
                    body={"metadata": {"annotations": {RESTART_REQUIRED_ANNOTATION: drift}}},
                )
                if drift is None:
                    logger.info("[INFO] Pod %s/%s group mounts up to date", namespace, pod.metadata.name)
                    continue
                logger.info("[INFO] Pod %s/%s needs restart for group mounts: %s", namespace, pod.metadata.name, drift)
                self._emit_restart_event(pod, (pod.metadata.labels or {}).get(NOTEBOOK_POD_LABEL, ""), drift)
            except ApiException as exc:
                logger.warning("[WARN] Pod %s/%s mount check failed: %s", namespace, pod.metadata.name, exc.status)

    def run(self) -> None:
        while True:
            try:
                self.nfs_server, self.nfs_path = self._load_nfs_settings()
                profiles = self.co_api.list_cluster_custom_object(
                    group=PROFILE_GROUP,
                    version=PROFILE_VERSION,
                    plural=PROFILE_PLURAL,
                )
                for profile in profiles.get("items", []):
                    self.sync_profile(profile)
                self.check_notebook_pods()
            except Exception as exc:
                logger.exception("controller loop failed: %s", exc)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    controller = GroupshareController()
    controller.run()
