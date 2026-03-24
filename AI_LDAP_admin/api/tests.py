import os
import stat
import tempfile
import unittest

from .groupshare_storage import ensure_groupshare_group_directory, sanitize_groupshare_group_token
from .namespace_share_storage import ensure_namespace_share_directory, sanitize_namespace_share_token


class GroupShareStorageTests(unittest.TestCase):
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
