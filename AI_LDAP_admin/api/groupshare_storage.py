import os
import re


DEFAULT_GROUPSHARE_STORAGE_ROOT = os.environ.get("GROUPSHARE_STORAGE_ROOT", "/mnt/groupshare")
DEFAULT_GROUPSHARE_DIR_MODE = 0o777


def sanitize_groupshare_group_token(group_name: str) -> str:
    token = (group_name or "").strip().lower()
    token = re.sub(r"[^a-z0-9-]+", "-", token)
    token = re.sub(r"-{2,}", "-", token)
    return token.strip("-")


def ensure_groupshare_group_directory(group_name: str, root_path: str = None, mode: int = DEFAULT_GROUPSHARE_DIR_MODE) -> str:
    token = sanitize_groupshare_group_token(group_name)
    if not token:
        raise ValueError("group name cannot be empty after sanitization")

    storage_root = root_path or DEFAULT_GROUPSHARE_STORAGE_ROOT
    if not os.path.isdir(storage_root):
        raise RuntimeError(f"groupshare storage root '{storage_root}' is not mounted or not a directory")

    directory_path = os.path.join(storage_root, token)
    os.makedirs(directory_path, exist_ok=True)
    os.chmod(directory_path, mode)
    return directory_path
