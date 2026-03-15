import os
import sys
import unittest

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(BASE, "controller"))

from parser import intersect_groups, parse_csv_list, to_volume_name


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


if __name__ == "__main__":
    unittest.main()
