import os
import importlib.util
import unittest

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
PARSER_PATH = os.path.join(BASE, "controller", "parser.py")

spec = importlib.util.spec_from_file_location("groupshare_controller_parser", PARSER_PATH)
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)

build_group_nfs_path = parser.build_group_nfs_path
intersect_groups = parser.intersect_groups
parse_csv_list = parser.parse_csv_list
parse_manager_groups = parser.parse_manager_groups
to_volume_name = parser.to_volume_name
group_token = parser.group_token

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


class TestControllerParser(unittest.TestCase):
    def test_group_token_vectors(self):
        for name, token in GROUP_TOKEN_VECTORS.items():
            self.assertEqual(group_token(name), token, name)

    def test_non_ascii_names_no_longer_share_a_folder(self):
        names = ["馬誠佑_lab", "楊智淵_lab", "張賢宗_lab", "林英嘉_lab", "王佑中lab"]
        self.assertEqual(len({group_token(n) for n in names}), len(names))

    def test_long_names_fit_volume_name_limit(self):
        self.assertLessEqual(len("gs-" + group_token("x" * 80)), 63)
        self.assertNotEqual(group_token("x" * 80), group_token("x" * 81))

    def test_volume_and_path_use_the_group_token(self):
        self.assertEqual(to_volume_name("王佑中教授實驗室"), "gs-g-c4be5913")
        self.assertEqual(build_group_nfs_path("/AIC_K8s/shared", "馬誠佑_lab"), "/AIC_K8s/shared/lab-7a249574")
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
        path = build_group_nfs_path("/Public/shared/", "MarkTest")
        self.assertEqual(path, "/Public/shared/marktest")

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
