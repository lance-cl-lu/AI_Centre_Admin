import os
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Tuple

from django.core.management.base import BaseCommand, CommandError

from kubernetes import client, config
from kubernetes.config.config_exception import ConfigException

from api.groupshare_storage import (
    DEFAULT_GROUPSHARE_DIR_MODE,
    DEFAULT_GROUPSHARE_STORAGE_ROOT,
    ensure_groupshare_group_directory,
    sanitize_groupshare_group_token,
)
from api.namespace_share_storage import (
    DEFAULT_NAMESPACE_SHARE_STORAGE_ROOT,
    ensure_namespace_share_directory,
    sanitize_namespace_share_token,
)


PROFILE_GROUP = "kubeflow.org"
PROFILE_VERSION = "v1"
PROFILE_PLURAL = "profiles"

ROLE_MARKERS = {"user", "manager"}


@dataclass
class DirectoryTargets:
    groups: Dict[str, str] = field(default_factory=dict)
    namespaces: Dict[str, str] = field(default_factory=dict)
    skipped: List[str] = field(default_factory=list)


def parse_csv_list(raw: str) -> List[str]:
    if not raw:
        return []

    values = []
    seen = set()
    for item in raw.split(","):
        value = item.strip()
        if value and value not in seen:
            values.append(value)
            seen.add(value)
    return values


def collect_directory_targets(profiles: Iterable[dict], group_names: Iterable[str]) -> DirectoryTargets:
    targets = DirectoryTargets()

    for group_name in group_names:
        add_group_target(targets, group_name, source="django-group")

    for profile in profiles:
        metadata = profile.get("metadata", {}) or {}
        namespace = (metadata.get("name") or "").strip()
        add_namespace_target(targets, namespace)

        annotations = metadata.get("annotations", {}) or {}
        for group_name in parse_csv_list(str(annotations.get("group", "") or "")):
            add_group_target(targets, group_name, source=f"profile/{namespace}")

    return targets


def add_group_target(targets: DirectoryTargets, group_name: str, source: str) -> None:
    name = (group_name or "").strip()
    if not name:
        return
    if name.lower() in ROLE_MARKERS or name.lower() == "root":
        return

    token = sanitize_groupshare_group_token(name)
    if not token:
        targets.skipped.append(f"group from {source} cannot be sanitized: {name!r}")
        return

    targets.groups.setdefault(token, name)


def add_namespace_target(targets: DirectoryTargets, namespace: str) -> None:
    name = (namespace or "").strip()
    if not name:
        return

    token = sanitize_namespace_share_token(name)
    if not token:
        targets.skipped.append(f"namespace cannot be sanitized: {name!r}")
        return

    targets.namespaces.setdefault(token, name)


def repair_directory_targets(
    targets: DirectoryTargets,
    groupshare_root: str,
    namespace_root: str,
    mode: int,
    dry_run: bool,
) -> Tuple[List[str], List[str]]:
    group_paths = []
    namespace_paths = []

    for token, name in sorted(targets.groups.items()):
        if dry_run:
            group_paths.append(os.path.join(groupshare_root, token))
        else:
            group_paths.append(ensure_groupshare_group_directory(name, root_path=groupshare_root, mode=mode))

    for token, name in sorted(targets.namespaces.items()):
        if dry_run:
            namespace_paths.append(os.path.join(namespace_root, token))
        else:
            namespace_paths.append(ensure_namespace_share_directory(name, root_path=namespace_root, mode=mode))

    return group_paths, namespace_paths


def parse_mode(raw_mode: str) -> int:
    try:
        return int(str(raw_mode), 8)
    except ValueError as exc:
        raise CommandError(f"invalid mode {raw_mode!r}; use an octal value like 777 or 775") from exc


def _fix_incluster_auth_v36(cfg: client.Configuration) -> None:
    if "authorization" in cfg.api_key and "BearerToken" not in cfg.api_key:
        raw = cfg.api_key["authorization"]
        if raw.lower().startswith("bearer "):
            raw = raw[7:]
        cfg.api_key["BearerToken"] = raw
        cfg.api_key_prefix["BearerToken"] = "Bearer"


def make_custom_objects_api(mode: str, kubeconfig: str, context: str) -> client.CustomObjectsApi:
    cfg = client.Configuration()
    selected_mode = (mode or "auto").lower()

    if selected_mode in {"incluster", "serviceaccount"}:
        config.load_incluster_config(client_configuration=cfg)
        _fix_incluster_auth_v36(cfg)
        return client.CustomObjectsApi(api_client=client.ApiClient(configuration=cfg))

    if selected_mode == "kubeconfig":
        config.load_kube_config(config_file=kubeconfig, context=context, client_configuration=cfg)
        return client.CustomObjectsApi(api_client=client.ApiClient(configuration=cfg))

    try:
        config.load_incluster_config(client_configuration=cfg)
        _fix_incluster_auth_v36(cfg)
        return client.CustomObjectsApi(api_client=client.ApiClient(configuration=cfg))
    except ConfigException:
        config.load_kube_config(config_file=kubeconfig, context=context, client_configuration=cfg)
        return client.CustomObjectsApi(api_client=client.ApiClient(configuration=cfg))


def list_profiles(api: client.CustomObjectsApi) -> List[dict]:
    response = api.list_cluster_custom_object(PROFILE_GROUP, PROFILE_VERSION, PROFILE_PLURAL)
    return response.get("items", [])


class Command(BaseCommand):
    help = "Create missing GroupShare and NamespaceShare directories on the mounted NFS share."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show target directories without creating them.")
        parser.add_argument("--groupshare-root", default=DEFAULT_GROUPSHARE_STORAGE_ROOT)
        parser.add_argument("--namespace-root", default=DEFAULT_NAMESPACE_SHARE_STORAGE_ROOT)
        parser.add_argument("--mode", default=oct(DEFAULT_GROUPSHARE_DIR_MODE)[2:])
        parser.add_argument(
            "--k8s-auth-mode",
            default=os.environ.get("K8S_AUTH_MODE", "auto"),
            choices=["auto", "incluster", "serviceaccount", "kubeconfig"],
        )
        parser.add_argument("--kubeconfig", default=os.environ.get("K8S_KUBECONFIG"))
        parser.add_argument("--context", default=os.environ.get("K8S_CONTEXT"))

    def handle(self, *args, **options):
        from django.contrib.auth.models import Group

        mode = parse_mode(options["mode"])
        api = make_custom_objects_api(options["k8s_auth_mode"], options["kubeconfig"], options["context"])
        profiles = list_profiles(api)
        group_names = Group.objects.values_list("name", flat=True)

        targets = collect_directory_targets(profiles, group_names)
        group_paths, namespace_paths = repair_directory_targets(
            targets=targets,
            groupshare_root=options["groupshare_root"],
            namespace_root=options["namespace_root"],
            mode=mode,
            dry_run=options["dry_run"],
        )

        action = "would create/check" if options["dry_run"] else "created/checked"
        self.stdout.write(
            f"{action} {len(group_paths)} groupshare directories and {len(namespace_paths)} namespace-share directories"
        )
        self.stdout.write(f"profiles scanned: {len(profiles)}")

        for path in group_paths:
            self.stdout.write(f"group: {path}")
        for path in namespace_paths:
            self.stdout.write(f"namespace: {path}")
        for warning in targets.skipped:
            self.stderr.write(f"skipped: {warning}")
