import os
import stat
import tempfile
import unittest

from .groupshare_storage import (
    GROUPSHARE_EXCLUDED_GROUPS,
    ensure_groupshare_group_directory,
    groupshare_group_token,
    sanitize_groupshare_group_token,
)
from .namespace_share_storage import ensure_namespace_share_directory, sanitize_namespace_share_token
from kubernetes.client.rest import ApiException

from .groupshare_reconcile import (
    apply_profile_change,
    groups_without_directory,
    plan_missing_directories,
    plan_profile_changes,
)


# Shared with groupshare/tests/webhook/test_rules.py and api/tests.py: the backend, the controller
# and the webhook must map every group name to the same token.
GROUP_TOKEN_VECTORS = {
    "AIC_DEV": "aic-dev",
    "Hojjat_lab": "hojjat-lab",
    "馬誠佑_lab": "lab-7a249574",
    "楊智淵_lab": "lab-4bd4114e",
    "王佑中教授實驗室": "g-c4be5913",
    "王佑中_AID002-A3463_深度學習結構": "aid002-a3463-7ef7d056",
}


class GroupShareStorageTests(unittest.TestCase):
    def test_group_token_vectors(self):
        for name, token in GROUP_TOKEN_VECTORS.items():
            self.assertEqual(groupshare_group_token(name), token, name)

    def test_chinese_named_group_gets_its_own_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            first = ensure_groupshare_group_directory("馬誠佑_lab", root_path=temp_dir)
            second = ensure_groupshare_group_directory("楊智淵_lab", root_path=temp_dir)
            self.assertNotEqual(first, second)
            self.assertEqual(os.path.basename(first), "lab-7a249574")

    def test_admin_marker_and_trash_get_no_shared_folder(self):
        self.assertEqual(GROUPSHARE_EXCLUDED_GROUPS, {"root", "TRASH"})

    def test_sanitize_groupshare_group_token_matches_controller_convention(self):
        self.assertEqual(sanitize_groupshare_group_token("Lab_Vision! 2026"), "lab-vision-2026")

    def test_ensure_groupshare_group_directory_creates_sanitized_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = ensure_groupshare_group_directory("Mark Test", root_path=temp_dir)

            self.assertEqual(directory, os.path.join(temp_dir, "mark-test"))
            self.assertTrue(os.path.isdir(directory))
            self.assertEqual(stat.S_IMODE(os.stat(directory).st_mode), 0o777)

    def test_ensure_groupshare_group_directory_requires_existing_root(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_root = os.path.join(temp_dir, "missing")

            with self.assertRaises(RuntimeError):
                ensure_groupshare_group_directory("marktest", root_path=missing_root)


class NamespaceShareStorageTests(unittest.TestCase):
    def test_sanitize_namespace_share_token_matches_controller_convention(self):
        self.assertEqual(sanitize_namespace_share_token("B1144209"), "b1144209")

    def test_ensure_namespace_share_directory_creates_namespace_subdirectory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            namespace_root = os.path.join(temp_dir, "_namespaces")
            directory = ensure_namespace_share_directory("B1144209", root_path=namespace_root)

            self.assertEqual(directory, os.path.join(namespace_root, "b1144209"))
            self.assertTrue(os.path.isdir(directory))
            self.assertEqual(stat.S_IMODE(os.stat(directory).st_mode), 0o777)

    def test_ensure_namespace_share_directory_requires_existing_parent_root(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_root = os.path.join(temp_dir, "missing", "_namespaces")

            with self.assertRaises(RuntimeError):
                ensure_namespace_share_directory("b1144209", root_path=missing_root)



def make_profile(name, owner, annotations):
    return {"metadata": {"name": name, "annotations": annotations}, "spec": {"owner": {"name": owner}}}


class GroupShareReconcilePlanTests(unittest.TestCase):
    def test_profile_matching_db_is_left_alone(self):
        profiles = [make_profile("m1", "m1@x", {"group": "a,b", "manager-group": "a", "manager": "manager"})]
        changes, orphans = plan_profile_changes(profiles, lambda *_: ("a,b", "a", "manager"))
        self.assertEqual((changes, orphans), ([], []))

    def test_drifted_profile_is_planned_with_desired_values(self):
        profiles = [make_profile("m1", "M1@X", {"group": "old", "manager": "user"})]
        seen = []

        def resolve(name, email, manager):
            seen.append((name, email, manager))
            return "new", "", "user"

        changes, _ = plan_profile_changes(profiles, resolve)
        self.assertEqual(seen, [("m1", "m1@x", "user")])
        self.assertEqual(changes[0]["desired"], {"group": "new", "manager-group": "", "manager": "user"})
        self.assertEqual(changes[0]["current"]["group"], "old")

    def test_legacy_manager_groups_count_as_manager_group(self):
        profiles = [make_profile("m1", "m1@x", {"group": "a", "manager": "a"})]
        changes, _ = plan_profile_changes(profiles, lambda *_: ("a", "a", "manager"))
        self.assertEqual(changes[0]["current"]["manager-group"], "a")
        self.assertEqual(changes[0]["desired"]["manager"], "manager")

    def test_profile_without_db_user_is_reported_not_changed(self):
        profiles = [make_profile("ghost", "ghost@x", {"group": "a"})]
        changes, orphans = plan_profile_changes(profiles, lambda *_: None)
        self.assertEqual((changes, orphans), ([], ["ghost"]))

    def test_missing_directories_are_planned_by_sanitized_name(self):
        existing = {os.path.join("/root", "lab-a"), os.path.join("/root", "_namespaces", "m1")}
        missing = plan_missing_directories(
            ["Lab_A", "test103"], ["m1", "m2"], "/root", isdir=lambda path: path in existing
        )
        self.assertEqual(missing, [("group", "test103"), ("namespace", "m2")])



class FakeProfileApi:
    def __init__(self, conflict=False):
        self.conflict = conflict
        self.written = None

    def replace_cluster_custom_object(self, group, version, plural, name, body):
        if self.conflict:
            raise ApiException(status=409)
        self.written = body


def planned_change(snapshot_groups="old", desired_groups="new", resource_version="5"):
    profile = make_profile("m1", "m1@x", {"group": snapshot_groups, "manager": "user"})
    profile["metadata"]["resourceVersion"] = resource_version
    changes, _ = plan_profile_changes([profile], lambda *_: (desired_groups, "", "user"))
    return changes[0]


class GroupShareReconcileSafetyTests(unittest.TestCase):
    def test_new_group_without_directory_is_not_published(self):
        change = planned_change("a", "a,new")
        self.assertEqual(groups_without_directory(change, {"new"}), ["new"])
        self.assertEqual(groups_without_directory(change, set()), [])

    def test_removing_groups_never_waits_for_directories(self):
        change = planned_change("a,gone", "a")
        self.assertEqual(groups_without_directory(change, None), [])

    def test_unmounted_storage_blocks_only_added_groups(self):
        self.assertEqual(groups_without_directory(planned_change("a", "a,b"), None), ["b"])

    def test_write_uses_snapshot_version(self):
        api = FakeProfileApi()
        result = apply_profile_change(api, planned_change(), lambda *_: ("new", "", "user"), "g", "v", "p")
        self.assertEqual(result, "updated")
        self.assertEqual(api.written["metadata"]["resourceVersion"], "5")
        self.assertEqual(api.written["metadata"]["annotations"]["group"], "new")

    def test_db_changed_after_planning_is_replanned_not_written(self):
        api = FakeProfileApi()
        result = apply_profile_change(api, planned_change(), lambda *_: ("newer", "", "user"), "g", "v", "p")
        self.assertEqual(result, "replanned")
        self.assertIsNone(api.written)

    def test_profile_changed_after_planning_is_not_overwritten(self):
        api = FakeProfileApi(conflict=True)
        result = apply_profile_change(api, planned_change(), lambda *_: ("new", "", "user"), "g", "v", "p")
        self.assertEqual(result, "conflict")
