import re


def sanitize_namespace_token(namespace: str) -> str:
    token = (namespace or "").strip().lower()
    token = re.sub(r"[^a-z0-9-]+", "-", token)
    token = re.sub(r"-{2,}", "-", token)
    return token.strip("-")


def build_namespace_nfs_path(base_path: str, namespace: str) -> str:
    sanitized = sanitize_namespace_token(namespace)
    if not sanitized:
        return ""
    return f"{base_path.rstrip('/')}/{sanitized}"


def to_volume_name(namespace: str) -> str:
    sanitized = sanitize_namespace_token(namespace)
    return f"ns-{sanitized}" if sanitized else "ns-unknown"
