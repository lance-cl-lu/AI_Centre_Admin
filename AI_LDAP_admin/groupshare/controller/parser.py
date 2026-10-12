import hashlib
import re
from typing import Dict, List, Tuple


ROLE_MARKERS = {"user", "manager"}


def parse_csv_list(raw: str) -> List[str]:
    if not raw:
        return []
    parts = [item.strip() for item in raw.split(',')]
    parts = [item for item in parts if item]

    deduped = []
    seen = set()
    for item in parts:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


def parse_manager_groups(annotations: Dict[str, str]) -> str:
    manager_group_raw = (annotations.get("manager-group", "") or "").strip()
    if manager_group_raw:
        return manager_group_raw

    # Backward compatibility: older transition wrote manager groups into manager.
    manager_raw = (annotations.get("manager", "") or "").strip()
    if manager_raw and manager_raw.lower() not in ROLE_MARKERS:
        return manager_raw

    return ""


def intersect_groups(groups: List[str], managers: List[str]) -> Tuple[List[str], List[str]]:
    group_set = set(groups)
    admin_groups = []
    warnings = []

    for mgr in managers:
        if mgr in group_set:
            admin_groups.append(mgr)
        else:
            warnings.append(f"Manager group '{mgr}' not found in group annotation; ignored")

    return admin_groups, warnings


def sanitize_group_token(group: str) -> str:
    token = group.lower()
    token = re.sub(r'[^a-z0-9-]+', '-', token)
    token = re.sub(r'-{2,}', '-', token)
    token = token.strip('-')
    return token


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
    token = sanitize_group_token(name)
    if name.isascii() and token and len(token) <= 60:
        return token
    digest = hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
    base = token[:51].strip("-")
    return f"{base}-{digest}" if base else f"g-{digest}"


def build_group_nfs_path(base_path: str, group: str) -> str:
    token = group_token(group)
    if not token:
        return ""
    return f"{base_path.rstrip('/')}/{token}"


def to_volume_name(group: str) -> str:
    token = group_token(group)
    return f"gs-{token}" if token else "gs-unknown"
