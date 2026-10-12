import importlib.util
import os
import sys
import types
import unittest
from types import SimpleNamespace


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
            "groupshare_controller_app",
        ]
    }
    old_path = list(sys.path)

    sys.modules["kubernetes"] = kubernetes
    sys.modules["kubernetes.client"] = client
    sys.modules["kubernetes.config"] = config
    sys.modules["kubernetes.client.rest"] = rest
    sys.path.insert(0, CONTROLLER_DIR)

    try:
        spec = importlib.util.spec_from_file_location("groupshare_controller_app", APP_PATH)
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


class TestGroupshareControllerApp(unittest.TestCase):
    def test_build_spec_applies_to_all_notebooks_without_configuration_label(self):
        app = load_controller_app()
        controller = object.__new__(app.GroupshareController)
        controller.nfs_server = "10.100.4.71"
        controller.nfs_path = "/Public/shared"

        poddefault = controller._build_spec(groups=["Lab_A"], admin_groups=[])

        self.assertEqual(poddefault["spec"]["selector"], {})
        self.assertEqual(poddefault["spec"]["volumes"][0]["name"], "gs-lab-a")
        self.assertTrue(poddefault["spec"]["volumes"][0]["nfs"]["readOnly"])

    def test_sync_updates_existing_poddefault_when_only_selector_is_stale(self):
        app = load_controller_app()
        controller = object.__new__(app.GroupshareController)
        controller.nfs_server = "10.100.4.71"
        controller.nfs_path = "/Public/shared"
        controller.desired_mounts = {}

        profile = {
            "metadata": {
                "name": "mark",
                "annotations": {
                    "group": "Lab_A",
                },
            }
        }
        current_hash = controller._hash_annotations("Lab_A", "")
        fake_api = FakeCustomObjectsApi(
            {
                "metadata": {
                    "annotations": {"groupshare.kubeflow.org/hash": current_hash},
                    "resourceVersion": "123",
                },
                "spec": {"selector": {"matchLabels": {"groupshare": "enabled"}}},
            }
        )
        controller.co_api = fake_api

        controller.sync_profile(profile)

        self.assertIsNotNone(fake_api.replaced_body)
        self.assertIsNone(fake_api.created_body)
        self.assertEqual(fake_api.replaced_body["spec"]["selector"], {})
        self.assertEqual(fake_api.replaced_body["metadata"]["resourceVersion"], "123")

    def test_poddefault_written_under_the_old_naming_rule_is_rewritten(self):
        import hashlib

        app = load_controller_app()
        controller = object.__new__(app.GroupshareController)
        controller.nfs_server = "10.100.4.71"
        controller.nfs_path = "/Public/shared"
        controller.desired_mounts = {}
        old_raw = f"王佑中lab||10.100.4.71|/Public/shared|{app.PODDEFAULT_SELECTOR_VERSION}"
        fake_api = FakeCustomObjectsApi(
            {
                "metadata": {
                    "annotations": {"groupshare.kubeflow.org/hash": hashlib.sha256(old_raw.encode()).hexdigest()},
                    "resourceVersion": "7",
                },
                "spec": {"selector": {}},
            }
        )
        controller.co_api = fake_api

        controller.sync_profile({"metadata": {"name": "m1", "annotations": {"group": "王佑中lab"}}})

        self.assertIsNotNone(fake_api.replaced_body)
        self.assertEqual(fake_api.replaced_body["spec"]["volumes"][0]["nfs"]["path"], "/Public/shared/lab-6179d8fd")


class FakeCoreApi:
    def __init__(self, configmap_data=None, pods=None):
        self.configmap_data = configmap_data
        self.pods = pods or []
        self.patches = []
        self.events = []

    def read_namespaced_config_map(self, **_kwargs):
        if self.configmap_data is None:
            raise ApiException(status=404)
        return SimpleNamespace(data=self.configmap_data)

    def list_pod_for_all_namespaces(self, **_kwargs):
        return SimpleNamespace(items=self.pods)

    def patch_namespaced_pod(self, **kwargs):
        self.patches.append(kwargs)

    def create_namespaced_event(self, **kwargs):
        self.events.append(kwargs["body"])


class FakeAppsApi:
    def __init__(self, env=None):
        self.env = env

    def read_namespaced_deployment(self, **_kwargs):
        if self.env is None:
            raise ApiException(status=404)
        container = SimpleNamespace(env=[SimpleNamespace(name=k, value=v) for k, v in self.env.items()])
        return SimpleNamespace(spec=SimpleNamespace(template=SimpleNamespace(spec=SimpleNamespace(containers=[container]))))


class FakeNotebookApi:
    def get_namespaced_custom_object(self, **kwargs):
        return {"metadata": {"name": kwargs["name"], "uid": "nb-uid"}}


def make_pod(volumes, annotations=None, phase="Running"):
    return SimpleNamespace(
        metadata=SimpleNamespace(name="a2-0", namespace="lab", uid="pod-uid", annotations=annotations,
                                 labels={"notebook-name": "a2"}),
        spec=SimpleNamespace(volumes=[
            SimpleNamespace(name=name, nfs=SimpleNamespace(server=server, path=path, read_only=ro))
            for name, server, path, ro in volumes
        ]),
        status=SimpleNamespace(phase=phase),
    )


def make_controller(app, core_api=None, apps_api=None):
    controller = object.__new__(app.GroupshareController)
    controller.nfs_server = "10.100.4.71"
    controller.nfs_path = "/Public/shared"
    controller.desired_mounts = {}
    controller.core_api = core_api
    controller.apps_api = apps_api
    controller.co_api = FakeNotebookApi()
    return controller


class TestNfsSettings(unittest.TestCase):
    def test_configmap_is_enough_without_provisioner_deployment(self):
        app = load_controller_app()
        controller = make_controller(
            app,
            core_api=FakeCoreApi(configmap_data={"NFS_SERVER": "10.100.100.31", "NFS_PATH": "/AIC_K8s/shared"}),
            apps_api=FakeAppsApi(env=None),
        )
        self.assertEqual(controller._load_nfs_settings(), ("10.100.100.31", "/AIC_K8s/shared"))

    def test_provisioner_env_is_fallback_when_configmap_missing(self):
        app = load_controller_app()
        controller = make_controller(
            app,
            core_api=FakeCoreApi(configmap_data=None),
            apps_api=FakeAppsApi(env={"NFS_SERVER": "10.100.4.71", "NFS_PATH": "/Public"}),
        )
        self.assertEqual(controller._load_nfs_settings(), ("10.100.4.71", "/Public"))

    def test_missing_settings_raise_instead_of_guessing(self):
        app = load_controller_app()
        controller = make_controller(app, core_api=FakeCoreApi(configmap_data=None), apps_api=FakeAppsApi(env=None))
        with self.assertRaises(RuntimeError):
            controller._load_nfs_settings()


class TestNotebookPodMountCheck(unittest.TestCase):
    def test_describe_mount_drift(self):
        app = load_controller_app()
        desired = {"gs-new": ("/s/new", True), "gs-keep": ("/s/keep", False)}
        actual = {"gs-old": ("/s/old", True), "gs-keep": ("/s/keep", True)}
        self.assertEqual(
            app.GroupshareController.describe_mount_drift(desired, actual),
            "added=gs-new;removed=gs-old;changed=gs-keep",
        )
        self.assertIsNone(app.GroupshareController.describe_mount_drift(desired, dict(desired)))

    def test_stale_pod_is_annotated_and_evented_without_restart(self):
        app = load_controller_app()
        pod = make_pod([("gs-old", "10.100.4.71", "/Public/shared/old", True),
                        ("workspace", "10.100.4.71", "/Public/pvc", False)])
        core = FakeCoreApi(pods=[pod])
        controller = make_controller(app, core_api=core)
        controller.desired_mounts = {"lab": {"gs-new": ("/Public/shared/new", True)}}

        controller.check_notebook_pods()

        self.assertEqual(
            core.patches[0]["body"],
            {"metadata": {"annotations": {app.RESTART_REQUIRED_ANNOTATION: "added=gs-new;removed=gs-old"}}},
        )
        self.assertEqual(core.events[0]["reason"], "GroupShareRestartRequired")
        self.assertEqual(core.events[0]["involvedObject"]["kind"], "Notebook")
        self.assertEqual(core.events[0]["involvedObject"]["uid"], "nb-uid")

    def test_already_flagged_pod_is_not_evented_again(self):
        app = load_controller_app()
        pod = make_pod([], annotations={"groupshare.kubeflow.org/restart-required": "added=gs-new"})
        core = FakeCoreApi(pods=[pod])
        controller = make_controller(app, core_api=core)
        controller.desired_mounts = {"lab": {"gs-new": ("/Public/shared/new", True)}}

        controller.check_notebook_pods()

        self.assertEqual(core.patches, [])
        self.assertEqual(core.events, [])

    def test_flag_is_cleared_when_pod_matches(self):
        app = load_controller_app()
        pod = make_pod([("gs-new", "10.100.4.71", "/Public/shared/new", True)],
                       annotations={"groupshare.kubeflow.org/restart-required": "added=gs-new"})
        core = FakeCoreApi(pods=[pod])
        controller = make_controller(app, core_api=core)
        controller.desired_mounts = {"lab": {"gs-new": ("/Public/shared/new", True)}}

        controller.check_notebook_pods()

        self.assertEqual(core.patches[0]["body"], {"metadata": {"annotations": {app.RESTART_REQUIRED_ANNOTATION: None}}})
        self.assertEqual(core.events, [])

    def test_namespace_without_synced_poddefault_is_skipped(self):
        app = load_controller_app()
        core = FakeCoreApi(pods=[make_pod([("gs-x", "10.100.4.71", "/Public/shared/x", True)])])
        controller = make_controller(app, core_api=core)

        controller.check_notebook_pods()

        self.assertEqual(core.patches, [])


if __name__ == "__main__":
    unittest.main()
