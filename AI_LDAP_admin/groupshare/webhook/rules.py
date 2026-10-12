import hashlib
import re
from typing import List, Set, Tuple


def parse_csv(raw: str) -> Set[str]:
    if not raw:
        return set()
    return {item.strip() for item in raw.split(',') if item.strip()}


def sanitize_group(group: str) -> str:
    token = group.lower()
    token = re.sub(r'[^a-z0-9-]+', '-', token)
    token = re.sub(r'-{2,}', '-', token)
    return token.strip('-')


def group_token(group: str) -> str:
    """Directory and volume token for a group name, unique per name.

    ASCII names keep the plain sanitized token, so existing directories stay where they are.
    Other characters (e.g. Chinese) are dropped by sanitizing, which would map "馬誠佑_lab" and
    "楊智淵_lab" to the same "lab" folder, so such names get a hash of the full name appended.
    The result always fits a volume name ("gs-" + token, at most 63 characters).
    Must stay identical in the backend, the controller and the webhook.
    """
    name = (group or "").strip()
    if not name:
        return ""
    token = sanitize_group(name)
    if name.isascii() and token and len(token) <= 60:
        return token
    digest = hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
    base = token[:51].strip("-")
    return f"{base}-{digest}" if base else f"g-{digest}"


def user_admin_volume_names(user_groups: List[str]) -> Set[str]:
    out = set()
    for group in user_groups or []:
        token = group_token(group)
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
    pod_spec = extract_pod_spec(notebook_obj)
    volumes = pod_spec.get("volumes", []) or []
    if not any(volume.get("nfs") for volume in volumes):
        return True, "ALLOW", "no NFS volumes to validate"

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
