import hashlib
import os
import re


DEFAULT_GROUPSHARE_STORAGE_ROOT = os.environ.get("GROUPSHARE_STORAGE_ROOT", "/mnt/groupshare")
DEFAULT_GROUPSHARE_DIR_MODE = 0o777
# Not labs: root is the admin marker and TRASH holds disabled users, so neither gets a shared folder.
GROUPSHARE_EXCLUDED_GROUPS = {"root", "TRASH"}


def sanitize_groupshare_group_token(group_name: str) -> str:
    token = (group_name or "").strip().lower()
    token = re.sub(r"[^a-z0-9-]+", "-", token)
    token = re.sub(r"-{2,}", "-", token)
    return token.strip("-")


def groupshare_group_token(group: str) -> str:
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
    token = sanitize_groupshare_group_token(name)
    if name.isascii() and token and len(token) <= 60:
        return token
    digest = hashlib.sha256(name.encode("utf-8")).hexdigest()[:8]
    base = token[:51].strip("-")
    return f"{base}-{digest}" if base else f"g-{digest}"


def ensure_groupshare_group_directory(group_name: str, root_path: str = None, mode: int = DEFAULT_GROUPSHARE_DIR_MODE) -> str:
    token = groupshare_group_token(group_name)
    if not token:
        raise ValueError("group name cannot be empty")

    storage_root = root_path or DEFAULT_GROUPSHARE_STORAGE_ROOT
    if not os.path.isdir(storage_root):
        raise RuntimeError(f"groupshare storage root '{storage_root}' is not mounted or not a directory")

    directory_path = os.path.join(storage_root, token)
    os.makedirs(directory_path, exist_ok=True)
    os.chmod(directory_path, mode)
    return directory_path
