import os

from .groupshare_storage import DEFAULT_GROUPSHARE_DIR_MODE, DEFAULT_GROUPSHARE_STORAGE_ROOT, sanitize_groupshare_group_token


DEFAULT_NAMESPACE_SHARE_STORAGE_ROOT = os.path.join(DEFAULT_GROUPSHARE_STORAGE_ROOT, "_namespaces")


def sanitize_namespace_share_token(namespace_name: str) -> str:
    return sanitize_groupshare_group_token(namespace_name)


def ensure_namespace_share_directory(
    namespace_name: str,
    root_path: str = None,
    mode: int = DEFAULT_GROUPSHARE_DIR_MODE,
) -> str:
    token = sanitize_namespace_share_token(namespace_name)
    if not token:
        raise ValueError("namespace name cannot be empty after sanitization")

    storage_root = root_path or DEFAULT_NAMESPACE_SHARE_STORAGE_ROOT
    validation_root = os.path.dirname(storage_root.rstrip(os.sep)) or os.sep
    if not os.path.isdir(validation_root):
        raise RuntimeError(f"namespace-share parent root '{validation_root}' is not mounted or not a directory")

    os.makedirs(storage_root, exist_ok=True)
    os.chmod(storage_root, mode)

    directory_path = os.path.join(storage_root, token)
    os.makedirs(directory_path, exist_ok=True)
    os.chmod(directory_path, mode)
    return directory_path
