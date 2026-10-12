import os
import stat
import tempfile
import unittest

from .groupshare_storage import (
    GROUPSHARE_EXCLUDED_GROUPS,
    ensure_groupshare_group_directory,
    sanitize_groupshare_group_token,
)
from .namespace_share_storage import ensure_namespace_share_directory, sanitize_namespace_share_token
from .groupshare_reconcile import plan_missing_directories, plan_profile_changes


class GroupShareStorageTests(unittest.TestCase):
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
