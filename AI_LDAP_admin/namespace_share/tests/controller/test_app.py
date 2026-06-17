import importlib.util
import os
import sys
import types
import unittest


BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
CONTROLLER_DIR = os.path.join(BASE, "controller")
APP_PATH = os.path.join(CONTROLLER_DIR, "app.py")


class ApiException(Exception):
    def __init__(self, status=None):
        super().__init__(status)
        self.status = status


def load_controller_app():
    kubernetes = types.ModuleType("kubernetes")
    client = types.ModuleType("kubernetes.client")
    config = types.ModuleType("kubernetes.config")
    rest = types.ModuleType("kubernetes.client.rest")
    rest.ApiException = ApiException

    old_modules = {
        name: sys.modules.get(name)
        for name in [
            "kubernetes",
            "kubernetes.client",
            "kubernetes.config",
            "kubernetes.client.rest",
            "parser",
            "namespace_share_controller_app",
        ]
    }
    old_path = list(sys.path)

    sys.modules["kubernetes"] = kubernetes
    sys.modules["kubernetes.client"] = client
    sys.modules["kubernetes.config"] = config
    sys.modules["kubernetes.client.rest"] = rest
    sys.path.insert(0, CONTROLLER_DIR)

    try:
        spec = importlib.util.spec_from_file_location("namespace_share_controller_app", APP_PATH)
        app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(app)
        return app
    finally:
        sys.path[:] = old_path
        for name, module in old_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


class FakeCustomObjectsApi:
    def __init__(self, existing):
        self.existing = existing
        self.replaced_body = None
        self.created_body = None

    def get_namespaced_custom_object(self, **_kwargs):
        return self.existing

    def replace_namespaced_custom_object(self, **kwargs):
        self.replaced_body = kwargs["body"]

    def create_namespaced_custom_object(self, **kwargs):
        self.created_body = kwargs["body"]


class TestNamespaceShareControllerApp(unittest.TestCase):
    def test_build_spec_applies_to_all_notebooks_without_configuration_label(self):
        app = load_controller_app()
        controller = object.__new__(app.NamespaceShareController)
        controller.nfs_server = "10.100.4.71"
        controller.nfs_path = "/Public/shared/_namespaces"

        poddefault = controller._build_spec("Mark")

        self.assertEqual(poddefault["spec"]["selector"], {})
        self.assertEqual(poddefault["spec"]["volumes"][0]["name"], "ns-mark")
        self.assertFalse(poddefault["spec"]["volumes"][0]["nfs"]["readOnly"])

    def test_sync_updates_existing_poddefault_when_only_selector_is_stale(self):
        app = load_controller_app()
        controller = object.__new__(app.NamespaceShareController)
        controller.nfs_server = "10.100.4.71"
        controller.nfs_path = "/Public/shared/_namespaces"

        current_hash = controller._hash_namespace("mark")
        fake_api = FakeCustomObjectsApi(
            {
                "metadata": {
                    "annotations": {"namespace-share.kubeflow.org/hash": current_hash},
                    "resourceVersion": "123",
                },
                "spec": {"selector": {"matchLabels": {"groupshare": "enabled"}}},
            }
        )
        controller.co_api = fake_api

        controller.sync_profile({"metadata": {"name": "mark"}})

        self.assertIsNotNone(fake_api.replaced_body)
        self.assertIsNone(fake_api.created_body)
        self.assertEqual(fake_api.replaced_body["spec"]["selector"], {})
        self.assertEqual(fake_api.replaced_body["metadata"]["resourceVersion"], "123")


if __name__ == "__main__":
    unittest.main()
