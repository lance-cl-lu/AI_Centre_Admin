from  kubernetes import client,config

from kubernetes.config import ConfigException

import pprint

try:
    config.load_incluster_config()
except ConfigException:
    config.load_kube_config()

custom_api = client.CustomObjectsApi()

res = custom_api.list_cluster_custom_object("kubeflow.org","v1beta1","notebooks")
pprint.pprint(res)
