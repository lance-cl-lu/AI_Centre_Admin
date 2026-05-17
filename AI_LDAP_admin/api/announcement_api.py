import json
import os

import yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from kubernetes.config.config_exception import ConfigException
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

ANNOUNCEMENT_CONFIGMAP_NAME = os.environ.get(
    'ANNOUNCEMENT_CONFIGMAP_NAME',
    'kubeflow-announcements',
)
ANNOUNCEMENT_CONFIGMAP_NAMESPACE = os.environ.get(
    'ANNOUNCEMENT_CONFIGMAP_NAMESPACE',
    'kubeflow',
)
ANNOUNCEMENT_DATA_KEY = os.environ.get(
    'ANNOUNCEMENT_CONFIGMAP_KEY',
    'announcements.yaml',
)
ANNOUNCEMENT_CANDIDATE_KEYS = (
    ANNOUNCEMENT_DATA_KEY,
    'announcements',
    'announcements.yaml',
    'announcements.yml',
    'announcements.json',
)


def ensure_k8s_config():
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()


def build_announcement_response(announcements):
    return {
        'announcements': announcements,
    }


def parse_announcement_document(raw_value):
    if raw_value is None:
        return []
    if isinstance(raw_value, dict):
        source = raw_value.get('announcements', raw_value)
        if isinstance(source, list):
            return source
        return []
    if isinstance(raw_value, list):
        return raw_value

    text = str(raw_value).strip()
    if not text:
        return []

    loaders = (json.loads, yaml.safe_load)
    for loader in loaders:
        try:
            parsed = loader(text)
        except Exception:
            continue
        if isinstance(parsed, dict):
            source = parsed.get('announcements', parsed)
            if isinstance(source, list):
                return source
        if isinstance(parsed, list):
            return parsed

    return []


def normalize_announcement(item, fallback_id):
    if not isinstance(item, dict):
        return None

    normalized_id = item.get('id', fallback_id)
    try:
        normalized_id = int(normalized_id)
    except (TypeError, ValueError):
        normalized_id = fallback_id

    return {
        'id': normalized_id,
        'date': str(item.get('date', '') or ''),
        'title': str(item.get('title', '') or ''),
        'content': str(item.get('content', '') or ''),
        'type': str(item.get('type', '') or ''),
    }


def normalize_announcements(items):
    normalized = []
    for index, item in enumerate(items or [], start=1):
        announcement = normalize_announcement(item, index)
        if announcement is not None:
            normalized.append(announcement)

    normalized.sort(key=lambda item: item.get('id', 0), reverse=True)
    return normalized


def get_announcement_configmap():
    ensure_k8s_config()
    v1 = client.CoreV1Api()
    return v1, v1.read_namespaced_config_map(
        ANNOUNCEMENT_CONFIGMAP_NAME,
        ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
    )


def read_announcements_from_configmap(config_map):
    data = getattr(config_map, 'data', None) or {}
    for key in ANNOUNCEMENT_CANDIDATE_KEYS:
        if key in data:
            return normalize_announcements(parse_announcement_document(data.get(key))), key

    for key, value in data.items():
        parsed = normalize_announcements(parse_announcement_document(value))
        if parsed:
            return parsed, key

    return [], ANNOUNCEMENT_DATA_KEY


def save_announcements_to_configmap(v1, config_map, announcements, data_key):
    current_data = dict(getattr(config_map, 'data', None) or {})
    current_data[data_key] = yaml.safe_dump(
        {'announcements': announcements},
        allow_unicode=True,
        sort_keys=False,
    )
    return v1.patch_namespaced_config_map(
        ANNOUNCEMENT_CONFIGMAP_NAME,
        ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
        {'data': current_data},
    )


class AnnouncementList(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            _, config_map = get_announcement_configmap()
            announcements, _ = read_announcements_from_configmap(config_map)
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '讀取 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        return Response(build_announcement_response(announcements))

    def put(self, request):
        payload = request.data
        if not isinstance(payload, dict) or 'announcements' not in payload:
            return Response({'detail': 'invalid payload'}, status=400)

        announcements = normalize_announcements(payload.get('announcements', []))
        try:
            v1, config_map = get_announcement_configmap()
            _, data_key = read_announcements_from_configmap(config_map)
            save_announcements_to_configmap(v1, config_map, announcements, data_key)
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '更新 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        return Response({'status': 'updated', 'announcements': announcements})

    def delete(self, request):
        ids = request.data.get('ids', [])
        try:
            ids = {int(value) for value in ids}
        except (TypeError, ValueError):
            return Response({'detail': 'invalid ids'}, status=400)

        try:
            v1, config_map = get_announcement_configmap()
            announcements, data_key = read_announcements_from_configmap(config_map)
            announcements = [item for item in announcements if item.get('id') not in ids]
            save_announcements_to_configmap(v1, config_map, announcements, data_key)
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '更新 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        return Response({'status': 'deleted', 'announcements': announcements})

class AnnouncementDetail(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            v1, config_map = get_announcement_configmap()
            announcements, data_key = read_announcements_from_configmap(config_map)
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '讀取 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        updated_announcement = None
        for index, item in enumerate(announcements):
            if item.get('id') == pk:
                merged = dict(item)
                merged.update(request.data or {})
                updated_announcement = normalize_announcement(merged, pk)
                announcements[index] = updated_announcement
                break

        if updated_announcement is None:
            return Response({'detail': 'announcement not found'}, status=404)

        try:
            save_announcements_to_configmap(v1, config_map, announcements, data_key)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '更新 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        return Response({'status': 'patched', 'announcement': updated_announcement})
