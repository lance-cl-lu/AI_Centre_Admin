#!/usr/bin/env bash
set -euo pipefail

IMAGE_REPO="cguaicadmin/ldap_backend"
TAG="${TAG:-v$(date +%y%m%d%H%M)}"
LOCAL_IMAGE="ldap_backend:${TAG}"
REMOTE_IMAGE="${IMAGE_REPO}:${TAG}"

NAMESPACE="${NAMESPACE:-ldap}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-backend-deployment}"
CONTAINER_NAME="${CONTAINER_NAME:-backend}"

./upload_frontend_ldap.sh

echo "[1/5] Build image: ${LOCAL_IMAGE}"
docker build -t "${LOCAL_IMAGE}" . --no-cache

echo "[2/5] Tag image: ${REMOTE_IMAGE}"
docker tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE}"

echo "[3/5] Push image"
docker push "${REMOTE_IMAGE}"

echo "[4/5] Update deployment image"
kubectl -n "${NAMESPACE}" set image "deployment/${DEPLOYMENT_NAME}" "${CONTAINER_NAME}=${REMOTE_IMAGE}"

echo "[5/5] Rollout restart + status"
kubectl -n "${NAMESPACE}" rollout restart "deployment/${DEPLOYMENT_NAME}"
kubectl -n "${NAMESPACE}" rollout status "deployment/${DEPLOYMENT_NAME}" --timeout=180s

echo "Done: ${REMOTE_IMAGE}"

