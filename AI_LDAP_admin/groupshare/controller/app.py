import hashlib
import logging
import os
import time
from typing import Dict, List, Tuple

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
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "20"))


class GroupshareController:
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
            raise RuntimeError("NFS_PATH missing from groupshare ConfigMap and provisioner deployment env")
        if not nfs_server:
            raise RuntimeError("NFS_SERVER missing from groupshare ConfigMap and provisioner deployment env")

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
                "selector": {"matchLabels": {"groupshare": "enabled"}},
                "volumeMounts": volume_mounts,
                "volumes": volumes,
            },
        }

    def _hash_annotations(self, groups_raw: str, managers_raw: str) -> str:
        raw = f"{groups_raw}|{managers_raw}|{self.nfs_server}|{self.nfs_path}"
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
    controller = GroupshareController()
    controller.run()
