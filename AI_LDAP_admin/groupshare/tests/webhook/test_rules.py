import os
import sys
import unittest

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(BASE, "webhook"))

from rules import evaluate_rules, group_token, user_admin_volume_names

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


class TestWebhookGroupToken(unittest.TestCase):
    def test_group_token_vectors(self):
        for name, token in GROUP_TOKEN_VECTORS.items():
            self.assertEqual(group_token(name), token, name)

    def test_admin_volumes_for_chinese_named_groups_are_distinct(self):
        self.assertEqual(
            user_admin_volume_names(["馬誠佑_lab", "楊智淵_lab"]),
            {"gs-lab-7a249574", "gs-lab-4bd4114e"},
        )


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
            writable_volume_names=set(),
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
            writable_volume_names=set(),
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
            writable_volume_names=set(),
        )

        self.assertFalse(allowed)
        self.assertEqual(rule, "Rule B")

    def test_unlabeled_groupshare_volume_is_validated(self):
        nb = self._base_notebook()
        nb["metadata"]["labels"] = {}

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr-data"},
            allowed_nfs_paths={"/exports/hr-data"},
            admin_volume_names={"gs-hr-admin"},
            writable_volume_names=set(),
        )

        self.assertTrue(allowed)
        self.assertEqual(rule, "ALLOW")

    def test_unlabeled_notebook_without_nfs_is_allowed(self):
        nb = self._base_notebook()
        nb["metadata"]["labels"] = {}
        nb["spec"]["template"]["spec"]["containers"][0]["volumeMounts"] = []
        nb["spec"]["template"]["spec"]["volumes"] = []

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr-data"},
            allowed_nfs_paths={"/exports/hr-data"},
            admin_volume_names={"gs-hr-admin"},
            writable_volume_names=set(),
        )

        self.assertTrue(allowed)
        self.assertEqual(rule, "ALLOW")

    def test_rule_c_admin_scope_is_per_volume(self):
        nb = self._base_notebook()
        nb["spec"]["template"]["spec"]["containers"][0]["volumeMounts"] = [
            {
                "name": "gs-hr",
                "mountPath": "/mnt/groups/hr",
                "readOnly": False,
            },
            {
                "name": "gs-fin",
                "mountPath": "/mnt/groups/fin",
                "readOnly": False,
            },
        ]
        nb["spec"]["template"]["spec"]["volumes"] = [
            {
                "name": "gs-hr",
                "nfs": {
                    "server": "10.100.1.31",
                    "path": "/exports/hr",
                    "readOnly": False,
                },
            },
            {
                "name": "gs-fin",
                "nfs": {
                    "server": "10.100.1.31",
                    "path": "/exports/fin",
                    "readOnly": False,
                },
            },
        ]

        allowed, rule, message = evaluate_rules(
            notebook_obj=nb,
            user_groups=["hr"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr", "gs-fin"},
            allowed_nfs_paths={"/exports/hr", "/exports/fin"},
            admin_volume_names={"gs-hr"},
            writable_volume_names=set(),
        )

        self.assertFalse(allowed)
        self.assertEqual(rule, "Rule C")
        self.assertIn("gs-fin", message)

    def test_rule_c_admin_can_rw_own_volume(self):
        nb = self._base_notebook()
        nb["spec"]["template"]["spec"]["containers"][0]["volumeMounts"][0]["name"] = "gs-hr"
        nb["spec"]["template"]["spec"]["volumes"][0]["name"] = "gs-hr"
        nb["spec"]["template"]["spec"]["volumes"][0]["nfs"]["path"] = "/exports/hr"
        nb["spec"]["template"]["spec"]["volumes"][0]["nfs"]["readOnly"] = False
        nb["spec"]["template"]["spec"]["containers"][0]["volumeMounts"][0]["readOnly"] = False

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["hr"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"gs-hr"},
            allowed_nfs_paths={"/exports/hr"},
            admin_volume_names={"gs-hr"},
            writable_volume_names=set(),
        )

        self.assertTrue(allowed)
        self.assertEqual(rule, "ALLOW")

    def test_namespace_share_volume_can_be_rw(self):
        nb = self._base_notebook()
        nb["spec"]["template"]["spec"]["containers"][0]["volumeMounts"][0] = {
            "name": "ns-b1144209",
            "mountPath": "/mnt/namespaces/b1144209",
            "readOnly": False,
        }
        nb["spec"]["template"]["spec"]["volumes"][0] = {
            "name": "ns-b1144209",
            "nfs": {
                "server": "10.100.1.31",
                "path": "/exports/_namespaces/b1144209",
                "readOnly": False,
            },
        }

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"ns-b1144209"},
            allowed_nfs_paths={"/exports/_namespaces/b1144209"},
            admin_volume_names=set(),
            writable_volume_names={"ns-b1144209"},
        )

        self.assertTrue(allowed)
        self.assertEqual(rule, "ALLOW")

    def test_unlabeled_namespace_share_volume_is_validated(self):
        nb = self._base_notebook()
        nb["metadata"]["labels"] = {}
        nb["spec"]["template"]["spec"]["containers"][0]["volumeMounts"][0] = {
            "name": "ns-b1144209",
            "mountPath": "/mnt/namespaces/b1144209",
            "readOnly": False,
        }
        nb["spec"]["template"]["spec"]["volumes"][0] = {
            "name": "ns-b1144209",
            "nfs": {
                "server": "10.100.1.31",
                "path": "/exports/_namespaces/b1144209",
                "readOnly": False,
            },
        }

        allowed, rule, _ = evaluate_rules(
            notebook_obj=nb,
            user_groups=["staff"],
            expected_nfs_server="10.100.1.31",
            allowed_volume_names={"ns-b1144209"},
            allowed_nfs_paths={"/exports/_namespaces/b1144209"},
            admin_volume_names=set(),
            writable_volume_names={"ns-b1144209"},
        )

        self.assertTrue(allowed)
        self.assertEqual(rule, "ALLOW")


if __name__ == "__main__":
    unittest.main()
