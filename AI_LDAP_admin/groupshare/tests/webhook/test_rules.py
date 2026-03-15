import os
import sys
import unittest

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(BASE, "webhook"))

from rules import evaluate_rules


class TestWebhookRules(unittest.TestCase):
    def _base_notebook(self):
        return {
            "metadata": {"name": "nb1", "labels": {"groupshare": "enabled"}},
            "spec": {
                "template": {
                    "spec": {
                        "containers": [
                            {
                                "name": "nb",
                                "volumeMounts": [
                                    {
                                        "name": "gs-hr-data",
                                        "mountPath": "/mnt/groups/hr-data",
                                        "readOnly": True,
                                    }
                                ],
                            }
                        ],
                        "volumes": [
                            {
                                "name": "gs-hr-data",
                                "nfs": {
                                    "server": "10.100.1.31",
                                    "path": "/exports/hr-data",
                                    "readOnly": True,
                                },
                            }
                        ]
                    }
                }
            },
        }

    def test_rule_a_forbidden_group_path(self):
        nb = self._base_notebook()
        nb["spec"]["template"]["spec"]["volumes"][0]["nfs"]["path"] = "/group/hr_data"

        allowed, rule, message = evaluate_rules(
            notebook_obj=nb,
            user_groups=["hr-data"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr-data"},
            allowed_nfs_paths={"/group/hr-data"},
            admin_volume_names={"gs-admin"},
        )

        self.assertFalse(allowed)
        self.assertEqual(rule, "Rule A")
        self.assertIn("forbidden", message)

    def test_rule_c_non_admin_cannot_rw(self):
        nb = self._base_notebook()
        nb["spec"]["template"]["spec"]["volumes"][0]["nfs"]["readOnly"] = False

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr-data"},
            allowed_nfs_paths={"/exports/hr-data"},
            admin_volume_names={"gs-hr-admin"},
        )

        self.assertFalse(allowed)
        self.assertEqual(rule, "Rule C")

    def test_rule_b_path_whitelist(self):
        nb = self._base_notebook()
        nb["spec"]["template"]["spec"]["volumes"][0]["nfs"]["path"] = "/exports/not-allowed"

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr-data"},
            allowed_nfs_paths={"/exports/hr-data"},
            admin_volume_names={"gs-hr-admin"},
        )

        self.assertFalse(allowed)
        self.assertEqual(rule, "Rule B")

    def test_rule_d_label_required(self):
        nb = self._base_notebook()
        nb["metadata"]["labels"] = {}

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr-data"},
            allowed_nfs_paths={"/exports/hr-data"},
            admin_volume_names={"gs-hr-admin"},
        )

        self.assertFalse(allowed)
        self.assertEqual(rule, "Rule D")


if __name__ == "__main__":
    unittest.main()
