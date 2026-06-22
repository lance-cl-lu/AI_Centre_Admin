import os
import unittest

import yaml


PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def load_yaml_documents(relative_path):
    with open(os.path.join(PROJECT_DIR, relative_path), "r", encoding="utf-8") as fh:
        return [doc for doc in yaml.safe_load_all(fh) if doc]


def first_document(relative_path):
    documents = load_yaml_documents(relative_path)
    if not documents:
        raise AssertionError(f"{relative_path} has no YAML documents")
    return documents[0]


class NfsConfigTests(unittest.TestCase):
    def test_groupshare_and_namespace_share_use_distinct_nfs_roots(self):
        groupshare_cm = first_document("groupshare/deploy/controller-configmap.yaml")
        namespace_share_cm = first_document("namespace_share/deploy/controller-configmap.yaml")

        self.assertEqual(groupshare_cm["metadata"]["name"], "groupshare-nfs-defaults")
        self.assertEqual(namespace_share_cm["metadata"]["name"], "namespace-share-nfs-defaults")
        self.assertEqual(groupshare_cm["data"]["NFS_SERVER"], namespace_share_cm["data"]["NFS_SERVER"])
        self.assertEqual(groupshare_cm["data"]["NFS_PATH"], "/kflow_dev/shared")
        self.assertEqual(namespace_share_cm["data"]["NFS_PATH"], "/kflow_dev/shared/_namespaces")
        self.assertNotEqual(groupshare_cm["data"]["NFS_PATH"], namespace_share_cm["data"]["NFS_PATH"])

    def test_backend_groupshare_mount_matches_groupshare_root(self):
        groupshare_cm = first_document("groupshare/deploy/controller-configmap.yaml")
        deployment = next(
            doc
            for doc in load_yaml_documents("full-stack-deployment.yaml")
            if doc.get("kind") == "Deployment" and doc.get("metadata", {}).get("name") == "backend-deployment"
        )

        volumes = {
            volume["name"]: volume
            for volume in deployment["spec"]["template"]["spec"]["volumes"]
        }
        groupshare_volume = volumes["groupshare-storage"]["nfs"]

        self.assertEqual(groupshare_volume["server"], groupshare_cm["data"]["NFS_SERVER"])
        self.assertEqual(groupshare_volume["path"], groupshare_cm["data"]["NFS_PATH"])
