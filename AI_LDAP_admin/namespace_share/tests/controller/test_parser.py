import os
import sys
import unittest

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(BASE, "controller"))

from parser import build_namespace_nfs_path, sanitize_namespace_token, to_volume_name


class TestNamespaceShareParser(unittest.TestCase):
    def test_namespace_token_sanitization(self):
        self.assertEqual(sanitize_namespace_token("B1144209"), "b1144209")

    def test_volume_name_uses_namespace_prefix(self):
        self.assertEqual(to_volume_name("B1144209"), "ns-b1144209")

    def test_build_namespace_nfs_path_uses_namespace_root(self):
        path = build_namespace_nfs_path("/kflow_dev/shared/_namespaces/", "B1144209")
        self.assertEqual(path, "/kflow_dev/shared/_namespaces/b1144209")


if __name__ == "__main__":
    unittest.main()
