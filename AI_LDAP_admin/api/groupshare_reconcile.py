"""Periodic reconciliation of GroupShare state from the Django DB.

The Django DB is the source of truth for group membership. The event-driven
sync calls in views.py make changes visible immediately; this loop repairs
whatever they miss (code paths without a sync call, failed Kubernetes API
calls, migrations), so Profiles and NFS directories always converge.

The groupshare controller turns Profile annotations into PodDefaults; this
module only writes Profile annotations and creates missing directories.
"""
import copy
import os
import threading
import time
import traceback

from .groupshare_storage import (
    DEFAULT_GROUPSHARE_STORAGE_ROOT,
    GROUPSHARE_EXCLUDED_GROUPS,
    groupshare_group_token,
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


def _wanted(desired):
    groups_raw, managers_raw, manager_role = desired
    return {"group": groups_raw, "manager-group": managers_raw, "manager": manager_role}


def _split(raw):
    return {item for item in (raw or "").split(",") if item}


def plan_profile_changes(profiles, resolve_desired):
    """Compare Profiles with the desired state.

    resolve_desired(profile_name, owner_email, current_manager) returns
    (groups_raw, manager_groups_raw, manager_role), or None when no DB user
    owns the Profile. Returns (changes, orphans); each change holds the Profile
    snapshot it was planned from, its current values and the desired values.
    """
    changes = []
    orphans = []
    for profile in profiles:
        metadata = profile.get("metadata", {}) or {}
        name = metadata.get("name", "")
        annotations = metadata.get("annotations", {}) or {}
        owner_email = (((profile.get("spec", {}) or {}).get("owner", {}) or {}).get("name", "") or "").strip().lower()
        if not name:
            continue

        current_manager = (annotations.get("manager", "") or "").strip()
        desired = resolve_desired(name, owner_email, current_manager)
        if desired is None:
            orphans.append(name)
            continue

        current = {
            "group": (annotations.get("group", "") or "").strip(),
            "manager-group": _current_manager_groups(annotations),
            "manager": current_manager,
        }
        wanted = _wanted(desired)
        if current != wanted:
            changes.append({
                "profile": name,
                "owner_email": owner_email,
                "current": current,
                "desired": wanted,
                "snapshot": profile,
            })
    return changes, orphans


def groups_without_directory(change, unavailable_groups):
    """Groups a change would newly publish whose shared directory is not available.

    unavailable_groups is a set of group names, or None when the storage root cannot be checked at
    all. Publishing such a group would hand Notebooks a mount of a missing directory (FailedMount).
    """
    added = _split(change["desired"]["group"]) - _split(change["current"]["group"])
    if unavailable_groups is None:
        return sorted(added)
    return sorted(added & unavailable_groups)


def plan_missing_directories(group_names, namespace_names, storage_root, isdir=os.path.isdir):
    """Return the group and namespace share directories that do not exist yet."""
    missing = []
    for group_name in sorted(set(group_names)):
        token = groupshare_group_token(group_name)
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


def apply_profile_change(api, change, resolve_desired, group, version, plural):
    """Write a planned change unless the DB or the Profile moved on since it was planned.

    Returns "updated", "replanned" (the DB now wants something else) or "conflict" (someone
    updated the Profile after the snapshot). Both skips are picked up by the next pass.
    """
    from kubernetes.client.rest import ApiException

    fresh = resolve_desired(change["profile"], change["owner_email"], change["current"]["manager"])
    if fresh is None or _wanted(fresh) != change["desired"]:
        return "replanned"

    profile = copy.deepcopy(change["snapshot"])
    annotations = profile.setdefault("metadata", {}).get("annotations") or {}
    annotations.update(change["desired"])
    profile["metadata"]["annotations"] = annotations
    try:
        # The snapshot's resourceVersion makes the API server reject the write if the Profile
        # changed after it was listed, instead of overwriting a newer group update.
        api.replace_cluster_custom_object(group, version, plural, change["profile"], profile)
    except ApiException as exc:
        if exc.status == 409:
            return "conflict"
        raise
    return "updated"


def reconcile_groupshare(dry_run=False):
    """Run one reconciliation pass and return a summary dict.

    Directories come first: a group is published to a Profile only once its shared directory
    exists, so the controller never mounts a directory that is not there.
    """
    from django.contrib.auth.models import Group
    views = _views()
    from .groupshare_storage import ensure_groupshare_group_directory
    from .namespace_share_storage import ensure_namespace_share_directory

    api, _ = views._make_k8s_custom_objects_api_views()
    profiles = api.list_cluster_custom_object(views.group, views.version, views.plural).get("items", [])
    changes, orphans = plan_profile_changes(profiles, _resolve_desired_from_db)

    summary = {"profiles": len(profiles), "changes": changes, "orphans": orphans, "directories": [],
               "skipped": [], "errors": []}

    group_names = {g.name for g in Group.objects.all() if g.name and g.name not in GROUPSHARE_EXCLUDED_GROUPS}
    for change in changes:
        group_names.update(_split(change["desired"]["group"]))
    namespace_names = [p.get("metadata", {}).get("name", "") for p in profiles]

    storage_root = DEFAULT_GROUPSHARE_STORAGE_ROOT
    unavailable_groups = set()
    if not os.path.isdir(storage_root):
        unavailable_groups = None
        summary["errors"].append(f"storage root '{storage_root}' is not mounted; new groups are not published")
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
                if kind == "group":
                    unavailable_groups.add(name)

    for change in changes:
        blocked = groups_without_directory(change, unavailable_groups)
        if blocked:
            summary["skipped"].append(change["profile"])
            print(f"[groupshare-reconcile] keep profile={change['profile']} unchanged: no directory for {blocked}")
            continue
        print(
            f"[groupshare-reconcile] {'would update' if dry_run else 'update'} profile={change['profile']} "
            f"current={change['current']} desired={change['desired']}"
        )
        if dry_run:
            continue
        try:
            result = apply_profile_change(
                api, change, _resolve_desired_from_db, views.group, views.version, views.plural
            )
        except Exception as exc:
            summary["errors"].append(f"profile {change['profile']}: {exc}")
            continue
        if result != "updated":
            summary["skipped"].append(change["profile"])
            print(f"[groupshare-reconcile] skip profile={change['profile']}: {result}, retried next pass")

    if orphans:
        print(f"[groupshare-reconcile] profiles without a DB user (left unchanged): {','.join(sorted(orphans))}")
    for error in summary["errors"]:
        print(f"[groupshare-reconcile] error: {error}")
    print(
        f"[groupshare-reconcile] done dry_run={dry_run} profiles={len(profiles)} changes={len(changes)} "
        f"skipped={len(summary['skipped'])} directories={len(summary['directories'])} orphans={len(orphans)} "
        f"errors={len(summary['errors'])}"
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
