import os
import sys
import unittest

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(BASE, "controller"))

from parser import build_group_nfs_path, intersect_groups, parse_csv_list, parse_manager_groups, to_volume_name


class TestControllerParser(unittest.TestCase):
    def test_parse_groups_and_managers(self):
        groups = parse_csv_list("A, B,, C ")
        managers = parse_csv_list("B, X")
        admin_groups, warnings = intersect_groups(groups, managers)

        self.assertEqual(groups, ["A", "B", "C"])
        self.assertEqual(admin_groups, ["B"])
        self.assertEqual(len(warnings), 1)
        self.assertIn("X", warnings[0])

    def test_group_name_sanitization_to_volume(self):
        name = to_volume_name("Lab_Vision! 2023")
        self.assertEqual(name, "gs-lab-vision-2023")

    def test_build_group_nfs_path_uses_shared_root(self):
        path = build_group_nfs_path("/kflow_dev/shared/", "MarkTest")
        self.assertEqual(path, "/kflow_dev/shared/marktest")

    def test_parse_manager_groups_prefers_manager_group(self):
        annotations = {
            "manager-group": "A,B",
            "manager": "user",
        }
        self.assertEqual(parse_manager_groups(annotations), "A,B")

    def test_parse_manager_groups_fallback_legacy_manager(self):
        annotations = {
            "manager": "A,B",
        }
        self.assertEqual(parse_manager_groups(annotations), "A,B")

    def test_parse_manager_groups_ignores_role_marker(self):
        annotations = {
            "manager": "manager",
        }
        self.assertEqual(parse_manager_groups(annotations), "")


if __name__ == "__main__":
    unittest.main()
