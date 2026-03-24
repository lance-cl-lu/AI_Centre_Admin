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


def build_group_nfs_path(base_path: str, group: str) -> str:
    sanitized = sanitize_group_token(group)
    if not sanitized:
        return ""
    return f"{base_path.rstrip('/')}/{sanitized}"


def to_volume_name(group: str) -> str:
    sanitized = sanitize_group_token(group)
    return f"gs-{sanitized}" if sanitized else "gs-unknown"
