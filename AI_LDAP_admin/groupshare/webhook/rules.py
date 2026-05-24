from typing import List, Set, Tuple


def parse_csv(raw: str) -> Set[str]:
    if not raw:
        return set()
    return {item.strip() for item in raw.split(',') if item.strip()}


def sanitize_group(group: str) -> str:
    import re

    token = group.lower()
    token = re.sub(r'[^a-z0-9-]+', '-', token)
    token = re.sub(r'-{2,}', '-', token)
    return token.strip('-')


def user_admin_volume_names(user_groups: List[str]) -> Set[str]:
    out = set()
    for group in user_groups or []:
        token = sanitize_group(group)
        if token:
            out.add(f"gs-{token}")
    return out


def extract_pod_spec(notebook_obj: dict) -> dict:
    spec = notebook_obj.get("spec", {})
    if "template" in spec and isinstance(spec["template"], dict):
        return spec["template"].get("spec", {})
    return spec.get("podSpec", {})


def evaluate_rules(
    notebook_obj: dict,
    user_groups: List[str],
    expected_nfs_server: str,
    allowed_volume_names: Set[str],
    allowed_nfs_paths: Set[str],
    admin_volume_names: Set[str],
    writable_volume_names: Set[str],
) -> Tuple[bool, str, str]:
    metadata = notebook_obj.get("metadata", {})
    labels = metadata.get("labels", {}) or {}
    pod_spec = extract_pod_spec(notebook_obj)
    volumes = pod_spec.get("volumes", []) or []
    if labels.get("groupshare") != "enabled":
        for volume in volumes:
            nfs = volume.get("nfs")
            if not nfs:
                continue
            volume_name = volume.get("name", "")
            path = nfs.get("path", "")
            if volume_name in allowed_volume_names or path in allowed_nfs_paths or path.startswith("/group"):
                return False, "Rule D", "groupshare label is required: groupshare=enabled"
        return True, "ALLOW", "groupshare disabled: skip rules"

    containers = pod_spec.get("containers", []) or []
    mount_readonly = {}
    for container in containers:
        for vm in (container.get("volumeMounts", []) or []):
            if "name" in vm and "readOnly" in vm:
                mount_readonly[vm["name"]] = bool(vm["readOnly"])
    requested_admin_volumes = user_admin_volume_names(user_groups).intersection(admin_volume_names)

    for volume in volumes:
        nfs = volume.get("nfs")
        if not nfs:
            continue

        volume_name = volume.get("name", "")
        path = nfs.get("path", "")
        server = nfs.get("server", "")
        read_only = bool(nfs.get("readOnly", False))
        is_admin_for_volume = volume_name in requested_admin_volumes
        is_namespace_writable = volume_name in writable_volume_names

        if path.startswith("/group"):
            return False, "Rule A", f"forbidden NFS path: {path}"

        if server != expected_nfs_server:
            return False, "Rule B", f"NFS server mismatch: {server}"

        if volume_name not in allowed_volume_names:
            return False, "Rule B", f"volume not in allowed whitelist: {volume_name}"

        if path not in allowed_nfs_paths:
            return False, "Rule B", f"NFS path not in allowed whitelist: {path}"

        if not is_admin_for_volume and not is_namespace_writable and not read_only:
            return False, "Rule C", f"readOnly=false denied for non-admin on volume {volume_name}"

        if not is_admin_for_volume and not is_namespace_writable and mount_readonly.get(volume_name) is False:
            return False, "Rule C", f"volumeMount readOnly=false denied for non-admin on volume {volume_name}"

    return True, "ALLOW", "request accepted"
