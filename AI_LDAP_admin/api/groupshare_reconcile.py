"""Periodic reconciliation of GroupShare state from the Django DB.

The Django DB is the source of truth for group membership. The event-driven
sync calls in views.py make changes visible immediately; this loop repairs
whatever they miss (code paths without a sync call, failed Kubernetes API
calls, migrations), so Profiles and NFS directories always converge.

The groupshare controller turns Profile annotations into PodDefaults; this
module only writes Profile annotations and creates missing directories.
"""
import os
import threading
import time
import traceback

from .groupshare_storage import (
    DEFAULT_GROUPSHARE_STORAGE_ROOT,
    GROUPSHARE_EXCLUDED_GROUPS,
    sanitize_groupshare_group_token,
)
from .namespace_share_storage import sanitize_namespace_share_token


RECONCILE_INTERVAL_SECONDS = int(os.environ.get("GROUPSHARE_RECONCILE_INTERVAL_SECONDS", "600"))
RECONCILE_INITIAL_DELAY_SECONDS = int(os.environ.get("GROUPSHARE_RECONCILE_INITIAL_DELAY_SECONDS", "60"))

_reconciler_started = False
_reconciler_lock = threading.Lock()


def _current_manager_groups(annotations):
    manager_group_raw = (annotations.get("manager-group", "") or "").strip()
    if manager_group_raw:
        return manager_group_raw
    manager_raw = (annotations.get("manager", "") or "").strip()
    if manager_raw and manager_raw.lower() not in {"user", "manager"}:
        return manager_raw
    return ""


def plan_profile_changes(profiles, resolve_desired):
    """Compare Profiles with the desired state.

    resolve_desired(profile_name, owner_email, current_manager) returns
    (groups_raw, manager_groups_raw, manager_role), or None when no DB user
    owns the Profile. Returns (changes, orphans); each change is a dict with
    the Profile name, its current values and the desired values.
    """
    changes = []
    orphans = []
    for profile in profiles:
        metadata = profile.get("metadata", {}) or {}
        name = metadata.get("name", "")
        annotations = metadata.get("annotations", {}) or {}
        owner_email = ((profile.get("spec", {}) or {}).get("owner", {}) or {}).get("name", "") or ""
        if not name:
            continue

        desired = resolve_desired(name, owner_email.strip().lower(), (annotations.get("manager", "") or "").strip())
        if desired is None:
            orphans.append(name)
            continue

        groups_raw, managers_raw, manager_role = desired
        current = {
            "group": (annotations.get("group", "") or "").strip(),
            "manager-group": _current_manager_groups(annotations),
            "manager": (annotations.get("manager", "") or "").strip(),
        }
        wanted = {"group": groups_raw, "manager-group": managers_raw, "manager": manager_role}
        if current != wanted:
            changes.append({"profile": name, "current": current, "desired": wanted})
    return changes, orphans


def plan_missing_directories(group_names, namespace_names, storage_root, isdir=os.path.isdir):
    """Return the group and namespace share directories that do not exist yet."""
    missing = []
    for group_name in sorted(set(group_names)):
        token = sanitize_groupshare_group_token(group_name)
        if token and not isdir(os.path.join(storage_root, token)):
            missing.append(("group", group_name))
    namespace_root = os.path.join(storage_root, "_namespaces")
    for namespace in sorted(set(namespace_names)):
        token = sanitize_namespace_share_token(namespace)
        if token and not isdir(os.path.join(namespace_root, token)):
            missing.append(("namespace", namespace))
    return missing


def _views():
    # api.urls must be imported before api.views: views -> serializers -> urls -> views is a cycle
    # that only resolves when urls starts it, as Django's URLconf loading does for requests.
    from . import urls  # noqa: F401
    from . import views

    return views


def _resolve_desired_from_db(profile_name, owner_email, current_manager):
    views = _views()

    user_obj = views.get_user_by_profile_or_email(profile_name=profile_name, owner_email=owner_email)
    if user_obj is None:
        return None
    groups_raw, managers_raw = views.build_groupshare_annotations(profile_name=profile_name, owner_email=owner_email)
    manager_role = views.resolve_manager_role(
        profile_name=profile_name,
        owner_email=owner_email,
        user_obj=user_obj,
        fallback_role=current_manager or "user",
    )
    return groups_raw, managers_raw, manager_role


def _apply_profile_change(api, change):
    views = _views()

    profile = api.get_cluster_custom_object(views.group, views.version, views.plural, change["profile"])
    annotations = profile.get("metadata", {}).get("annotations", {}) or {}
    annotations.update(change["desired"])
    profile["metadata"]["annotations"] = annotations
    # The fetched resourceVersion makes a concurrent edit fail instead of being overwritten.
    api.replace_cluster_custom_object(views.group, views.version, views.plural, change["profile"], profile)


def reconcile_groupshare(dry_run=False):
    """Run one reconciliation pass and return a summary dict."""
    from django.contrib.auth.models import Group
    views = _views()
    from .groupshare_storage import ensure_groupshare_group_directory
    from .namespace_share_storage import ensure_namespace_share_directory

    api, _ = views._make_k8s_custom_objects_api_views()
    profiles = api.list_cluster_custom_object(views.group, views.version, views.plural).get("items", [])
    changes, orphans = plan_profile_changes(profiles, _resolve_desired_from_db)

    summary = {"profiles": len(profiles), "changes": changes, "orphans": orphans, "directories": [], "errors": []}

    for change in changes:
        print(
            f"[groupshare-reconcile] {'would update' if dry_run else 'update'} profile={change['profile']} "
            f"current={change['current']} desired={change['desired']}"
        )
        if dry_run:
            continue
        try:
            _apply_profile_change(api, change)
        except Exception as exc:
            summary["errors"].append(f"profile {change['profile']}: {exc}")

    group_names = {g.name for g in Group.objects.all() if g.name and g.name not in GROUPSHARE_EXCLUDED_GROUPS}
    for change in changes:
        group_names.update(item for item in change["desired"]["group"].split(",") if item)
    namespace_names = [p.get("metadata", {}).get("name", "") for p in profiles]

    storage_root = DEFAULT_GROUPSHARE_STORAGE_ROOT
    if not os.path.isdir(storage_root):
        summary["errors"].append(f"storage root '{storage_root}' is not mounted; directories not checked")
    else:
        for kind, name in plan_missing_directories(group_names, namespace_names, storage_root):
            summary["directories"].append(f"{kind}:{name}")
            print(f"[groupshare-reconcile] {'would create' if dry_run else 'create'} {kind} directory for {name}")
            if dry_run:
                continue
            try:
                if kind == "group":
                    ensure_groupshare_group_directory(name)
                else:
                    ensure_namespace_share_directory(name)
            except Exception as exc:
                summary["errors"].append(f"{kind} directory {name}: {exc}")

    if orphans:
        print(f"[groupshare-reconcile] profiles without a DB user (left unchanged): {','.join(sorted(orphans))}")
    for error in summary["errors"]:
        print(f"[groupshare-reconcile] error: {error}")
    print(
        f"[groupshare-reconcile] done dry_run={dry_run} profiles={len(profiles)} changes={len(changes)} "
        f"directories={len(summary['directories'])} orphans={len(orphans)} errors={len(summary['errors'])}"
    )
    return summary


def _reconcile_loop():
    from django.db import close_old_connections

    time.sleep(RECONCILE_INITIAL_DELAY_SECONDS)
    while True:
        close_old_connections()
        try:
            reconcile_groupshare()
        except Exception:
            print("[groupshare-reconcile] pass failed")
            print(traceback.format_exc())
        finally:
            close_old_connections()
        time.sleep(RECONCILE_INTERVAL_SECONDS)


def start_background_reconciler():
    global _reconciler_started
    if RECONCILE_INTERVAL_SECONDS <= 0:
        print("[groupshare-reconcile] disabled (GROUPSHARE_RECONCILE_INTERVAL_SECONDS<=0)")
        return
    with _reconciler_lock:
        if _reconciler_started:
            return
        _reconciler_started = True
    threading.Thread(target=_reconcile_loop, name="groupshare-reconcile", daemon=True).start()
    print(f"[groupshare-reconcile] started interval={RECONCILE_INTERVAL_SECONDS}s")
