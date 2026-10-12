import json
import os
import stat
import tempfile
import unittest
from unittest import mock

from django.test import RequestFactory, TestCase as DjangoTestCase

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


class FakeK8sProfiles:
    """In-memory Profiles for the deletion flow; delete can be made to fail."""

    def __init__(self, names):
        self.profiles = {n: {"metadata": {"name": n, "annotations": {}}, "spec": {"owner": {"name": f"{n}@x"}}} for n in names}
        self.fail_deletes = 0
        self.deleted = []

    def patch_cluster_custom_object(self, group, version, plural, name, body):
        if name not in self.profiles:
            raise ApiException(status=404)
        annotations = self.profiles[name]["metadata"]["annotations"]
        for key, value in body["metadata"]["annotations"].items():
            if value is None:
                annotations.pop(key, None)
            else:
                annotations[key] = value

    def delete_cluster_custom_object(self, group, version, plural, name):
        if self.fail_deletes:
            self.fail_deletes -= 1
            raise ApiException(status=500)
        if name not in self.profiles:
            raise ApiException(status=404)
        del self.profiles[name]
        self.deleted.append(name)

    def list_cluster_custom_object(self, group, version, plural):
        return {"items": list(self.profiles.values())}


class TrashDeletionTests(DjangoTestCase):
    def setUp(self):
        from django.contrib.auth.models import Group, User
        from . import urls  # noqa: F401  (views/serializers/urls import cycle)
        from . import views
        from .models import UserDetail

        self.views = views
        self.trash = Group.objects.create(name="TRASH")
        self.lab = Group.objects.create(name="LabA")
        self.trashed = User.objects.create_user("trashed", "trashed@x", "pw")
        self.trashed.groups.add(self.trash)
        UserDetail.objects.create(uid=self.trashed, permission=2, labname=self.trash)
        self.member = User.objects.create_user("member", "member@x", "pw")
        self.member.groups.add(self.lab)
        UserDetail.objects.create(uid=self.member, permission=2, labname=self.lab)

        self.k8s = FakeK8sProfiles(["trashed", "member"])
        views._trashed_at.clear()
        for name, value in {
            "_make_k8s_custom_objects_api_views": lambda *a, **k: (self.k8s, "test"),
            "get_profile_by_email": lambda email: email.split("@")[0] if email else None,
            "get_profile_content": lambda name: self.k8s.profiles.get(name),
            "connectLDAP": lambda: mock.MagicMock(entries=[]),
            "send_delete_account_email": lambda *a: None,
            "replace_profile_user_delete_date": lambda *a: True,
            "sync_profile_groupshare_annotations": lambda *a: True,
        }.items():
            patcher = mock.patch.object(views, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def post(self, view, payload):
        request = RequestFactory().post("/", data=json.dumps(payload), content_type="application/json")
        return view(request)

    def exists(self, username):
        from django.contrib.auth.models import User
        return User.objects.filter(username=username).exists()

    def test_resent_and_duplicated_batch_delete_only_moves_to_trash(self):
        self.post(self.views.multiple_user_delete, {"users": ["member", "member"]})
        self.post(self.views.multiple_user_delete, {"users": ["member"]})  # resubmitted request

        self.assertTrue(self.exists("member"))
        self.assertTrue(self.views.is_only_in_trash("member"))
        self.assertEqual(self.k8s.deleted, [])

    def test_trash_only_user_is_deleted_permanently(self):
        self.post(self.views.multiple_user_delete, {"users": ["trashed"]})

        self.assertFalse(self.exists("trashed"))
        self.assertEqual(self.k8s.deleted, ["trashed"])

    def test_user_restored_during_permanent_delete_is_kept(self):
        def restore_while_marking(profile_name, username):
            if username:
                self.trashed.groups.add(self.lab)  # another request adds the user back to a lab
            return original(profile_name, username)

        original = self.views._set_pending_delete
        with mock.patch.object(self.views, "_set_pending_delete", side_effect=restore_while_marking):
            self.assertFalse(self.views.deleteUserModelPermanent("trashed"))

        self.assertTrue(self.exists("trashed"))
        self.assertEqual(self.k8s.deleted, [])
        self.assertNotIn(self.views.PENDING_DELETE_ANNOTATION, self.k8s.profiles["trashed"]["metadata"]["annotations"])

    def test_failed_profile_delete_is_retried_and_unmarked_orphans_are_kept(self):
        self.k8s.profiles["kubeflow-user-example-com"] = {
            "metadata": {"name": "kubeflow-user-example-com", "annotations": {}}, "spec": {"owner": {"name": "x@x"}}}
        self.k8s.fail_deletes = 1

        self.assertTrue(self.views.deleteUserModelPermanent("trashed"))
        self.assertFalse(self.exists("trashed"))
        self.assertIn("trashed", self.k8s.profiles)  # deletion failed, marker left behind

        self.assertEqual(self.views.retry_pending_profile_deletions(), ["trashed"])
        self.assertNotIn("trashed", self.k8s.profiles)
        self.assertIn("kubeflow-user-example-com", self.k8s.profiles)

    def test_database_error_during_delete_unmarks_profile(self):
        from django.db import OperationalError

        with mock.patch.object(type(self.trashed), "delete", side_effect=OperationalError("database is locked")):
            with self.assertRaises(OperationalError):
                self.views.deleteUserModelPermanent("trashed")

        self.assertTrue(self.exists("trashed"))
        self.assertNotIn(self.views.PENDING_DELETE_ANNOTATION, self.k8s.profiles["trashed"]["metadata"]["annotations"])

    def test_trash_user_still_in_a_lab_is_never_deleted_permanently(self):
        self.trashed.groups.add(self.lab)

        self.assertFalse(self.views.deleteUserModelPermanent("trashed"))
        self.assertTrue(self.exists("trashed"))
