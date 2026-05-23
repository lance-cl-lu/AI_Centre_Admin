import json
import os
import logging
import re
from datetime import date

import yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from kubernetes.config.config_exception import ConfigException
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import UserDetail

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
    'announcements.json',
)
ANNOUNCEMENT_K8S_AUTH_MODE = os.environ.get(
    'ANNOUNCEMENT_K8S_AUTH_MODE',
    'auto',
).lower()
ANNOUNCEMENT_KUBECONFIG = os.environ.get('ANNOUNCEMENT_KUBECONFIG', None)
ANNOUNCEMENT_K8S_CONTEXT = os.environ.get('ANNOUNCEMENT_K8S_CONTEXT', None)
ANNOUNCEMENT_K8S_FALLBACK_TO_KUBECONFIG = os.environ.get(
    'ANNOUNCEMENT_K8S_FALLBACK_TO_KUBECONFIG',
    'true',
).lower() in {'1', 'true', 'yes', 'on'}
ANNOUNCEMENT_CANDIDATE_KEYS = (
    ANNOUNCEMENT_DATA_KEY,
    'announcements.json',
    'announcements',
    'announcements.yml',
    'announcements.yaml',
)

logger = logging.getLogger(__name__)


def _fix_incluster_auth_v36(cfg):
    """
    Workaround for kubernetes Python client v27+/v36+ where load_incluster_config()
    stores the token in api_key['authorization'] but auth_settings() only checks
    api_key['BearerToken'].  Copy the token to the expected key so the ApiClient
    actually sends the Authorization header.
    """
    if 'authorization' in cfg.api_key and 'BearerToken' not in cfg.api_key:
        raw = cfg.api_key['authorization']
        if raw.lower().startswith('bearer '):
            raw = raw[7:]
        cfg.api_key['BearerToken'] = raw
        cfg.api_key_prefix['BearerToken'] = 'Bearer'


def _make_k8s_core_v1(mode=None, kubeconfig=None, context=None):
    """Create a per-request CoreV1Api client — does NOT mutate global config (thread-safe)."""
    m = (mode or ANNOUNCEMENT_K8S_AUTH_MODE).lower()
    cfg = client.Configuration()

    if m in {'incluster', 'serviceaccount'}:
        config.load_incluster_config(client_configuration=cfg)
        _fix_incluster_auth_v36(cfg)
        return client.CoreV1Api(api_client=client.ApiClient(configuration=cfg)), 'incluster'

    if m == 'kubeconfig':
        config.load_kube_config(
            config_file=kubeconfig if kubeconfig is not None else ANNOUNCEMENT_KUBECONFIG,
            context=context if context is not None else ANNOUNCEMENT_K8S_CONTEXT,
            client_configuration=cfg,
        )
        return client.CoreV1Api(api_client=client.ApiClient(configuration=cfg)), 'kubeconfig'

    # auto: prefer incluster, fallback kubeconfig
    try:
        config.load_incluster_config(client_configuration=cfg)
        _fix_incluster_auth_v36(cfg)
        return client.CoreV1Api(api_client=client.ApiClient(configuration=cfg)), 'incluster'
    except ConfigException:
        config.load_kube_config(
            config_file=kubeconfig if kubeconfig is not None else ANNOUNCEMENT_KUBECONFIG,
            context=context if context is not None else ANNOUNCEMENT_K8S_CONTEXT,
            client_configuration=cfg,
        )
        return client.CoreV1Api(api_client=client.ApiClient(configuration=cfg)), 'kubeconfig'


def build_announcement_response(announcements):
    return {
        'announcements': announcements,
    }


def extract_k8s_forbidden_detail(exc):
    body = getattr(exc, 'body', None)
    message_text = ''

    if body:
        try:
            parsed = json.loads(body)
            message_text = str(parsed.get('message', '') or '')
        except Exception:
            message_text = str(body)

    if not message_text:
        message_text = str(exc)

    # Typical K8s message:
    # User "system:serviceaccount:ldap:backend-service-account" cannot get resource "configmaps" in API group "" in the namespace "kubeflow"
    user = None
    verb = None
    resource = None
    namespace = None
    api_group = None

    user_match = re.search(r'User "([^"]+)"', message_text)
    if user_match:
        user = user_match.group(1)

    permission_match = re.search(
        r'cannot\s+([a-z]+)\s+resource\s+"([^"]+)"\s+in\s+API\s+group\s+"([^"]*)"\s+in\s+the\s+namespace\s+"([^"]+)"',
        message_text,
    )
    if permission_match:
        verb = permission_match.group(1)
        resource = permission_match.group(2)
        api_group = permission_match.group(3)
        namespace = permission_match.group(4)

    return {
        'message': message_text,
        'user': user,
        'verb': verb,
        'resource': resource,
        'api_group': api_group,
        'namespace': namespace,
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


def current_announcement_date():
    return date.today().isoformat()


def get_announcement_configmap():
    v1, auth_source = _make_k8s_core_v1()
    return v1, v1.read_namespaced_config_map(
        ANNOUNCEMENT_CONFIGMAP_NAME,
        ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
    ), auth_source


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
    payload = {
        'announcements': announcements,
    }
    target_key = ANNOUNCEMENT_DATA_KEY or 'announcements.json'
    current_data[target_key] = json.dumps(payload, ensure_ascii=False, indent=2)

    if data_key and data_key != target_key and data_key in current_data:
        del current_data[data_key]

    return v1.patch_namespaced_config_map(
        ANNOUNCEMENT_CONFIGMAP_NAME,
        ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
        {'data': current_data},
    )


class AnnouncementWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False

        if user.is_staff or user.is_superuser or user.username == 'root':
            return True

        if UserDetail.objects.filter(uid=user.id, permission__in=[0, 1]).exists():
            return True

        token = getattr(request, 'auth', None)
        permission = None
        if token is not None:
            if hasattr(token, 'get'):
                permission = token.get('permission')
            else:
                permission = getattr(token, 'payload', {}).get('permission')

        return permission in {'admin', 'root'}


class AnnouncementList(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [AnnouncementWritePermission()]

    def get(self, request):
        auth_source = 'unknown'
        try:
            _, config_map, auth_source = get_announcement_configmap()
            announcements, _ = read_announcements_from_configmap(config_map)
            logger.info(
                'Announcement GET via k8s auth source=%s mode=%s namespace=%s configmap=%s',
                auth_source,
                ANNOUNCEMENT_K8S_AUTH_MODE,
                ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
                ANNOUNCEMENT_CONFIGMAP_NAME,
            )
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            if (exc.status or 0) == 403:
                forbidden = extract_k8s_forbidden_detail(exc)
                if (
                    auth_source == 'incluster'
                    and forbidden.get('user') == 'system:anonymous'
                    and ANNOUNCEMENT_K8S_FALLBACK_TO_KUBECONFIG
                ):
                    try:
                        v1_fb, _ = _make_k8s_core_v1(mode='kubeconfig')
                        fallback_config_map = v1_fb.read_namespaced_config_map(
                            ANNOUNCEMENT_CONFIGMAP_NAME,
                            ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
                        )
                        announcements, _ = read_announcements_from_configmap(fallback_config_map)
                        logger.warning(
                            'Announcement GET switched from incluster to kubeconfig fallback due to anonymous 403 cfg_ns=%s cfg_name=%s kubeconfig=%s context=%s',
                            ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
                            ANNOUNCEMENT_CONFIGMAP_NAME,
                            ANNOUNCEMENT_KUBECONFIG,
                            ANNOUNCEMENT_K8S_CONTEXT,
                        )
                        return Response(build_announcement_response(announcements), status=200)
                    except Exception as fallback_exc:
                        logger.warning(
                            'Announcement kubeconfig fallback failed after anonymous 403: %s',
                            fallback_exc,
                        )
                logger.warning(
                    'Announcement GET fallback due to K8s 403 mode=%s cfg_ns=%s cfg_name=%s denied_user=%s denied_verb=%s denied_resource=%s denied_api_group=%s denied_ns=%s raw=%s',
                    ANNOUNCEMENT_K8S_AUTH_MODE,
                    ANNOUNCEMENT_CONFIGMAP_NAMESPACE,
                    ANNOUNCEMENT_CONFIGMAP_NAME,
                    forbidden.get('user'),
                    forbidden.get('verb'),
                    forbidden.get('resource'),
                    forbidden.get('api_group'),
                    forbidden.get('namespace'),
                    forbidden.get('message'),
                )
                return Response(build_announcement_response([]), status=200)
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
            v1, config_map, _ = get_announcement_configmap()
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
        if not isinstance(ids, list) or len(ids) == 0:
            return Response({'detail': 'ids is required'}, status=400)

        try:
            ids = {int(value) for value in ids}
        except (TypeError, ValueError):
            return Response({'detail': 'invalid ids'}, status=400)

        try:
            v1, config_map, _ = get_announcement_configmap()
            announcements, data_key = read_announcements_from_configmap(config_map)
            existing_ids = {item.get('id') for item in announcements}
            deleted_ids = sorted([item_id for item_id in ids if item_id in existing_ids])
            announcements = [item for item in announcements if item.get('id') not in ids]
            save_announcements_to_configmap(v1, config_map, announcements, data_key)
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '更新 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        return Response({
            'status': 'deleted',
            'deleted_ids': deleted_ids,
            'deleted_count': len(deleted_ids),
            'announcements': announcements,
        })

class AnnouncementDetail(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [AnnouncementWritePermission()]

    def get(self, request, pk):
        try:
            _, config_map, _ = get_announcement_configmap()
            announcements, _ = read_announcements_from_configmap(config_map)
        except ConfigException as exc:
            return Response({'detail': f'無法載入 Kubernetes 設定：{exc}'}, status=500)
        except ApiException as exc:
            status_code = exc.status or 500
            message = exc.reason or '讀取 ConfigMap 失敗。'
            return Response({'detail': message}, status=status_code)

        for item in announcements:
            if item.get('id') == pk:
                return Response({'announcement': item})

        return Response({'detail': 'announcement not found'}, status=404)

    def patch(self, request, pk):
        if not isinstance(request.data, dict):
            return Response({'detail': 'invalid payload'}, status=400)

        try:
            v1, config_map, _ = get_announcement_configmap()
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
                merged.update({
                    'title': request.data.get('title', item.get('title', '')),
                    'content': request.data.get('content', item.get('content', '')),
                    'type': request.data.get('type', item.get('type', '')),
                    'date': current_announcement_date(),
                })
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
