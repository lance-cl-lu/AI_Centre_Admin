#!/usr/bin/env bash
set -euo pipefail

IMAGE_REPO="${IMAGE_REPO:-cguaicadmin/pod-killer}"
TAG="${TAG:-v0.55}"
LOCAL_IMAGE="pod-killer:${TAG}"
REMOTE_IMAGE="${IMAGE_REPO}:${TAG}"

NAMESPACE="${NAMESPACE:-pod-killer-ns}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-pod-killer-deployment}"
CONTAINER_NAME="${CONTAINER_NAME:-pod-killer}"
MANIFEST_FILE="${MANIFEST_FILE:-mycontroll.yaml}"

echo "[1/6] Build image: ${LOCAL_IMAGE}"
docker build -t "${LOCAL_IMAGE}" . --no-cache

echo "[2/6] Tag image: ${REMOTE_IMAGE}"
docker tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE}"

echo "[3/6] Push image"
docker push "${REMOTE_IMAGE}"

echo "[4/6] Apply manifest: ${MANIFEST_FILE}"
kubectl apply -f "${MANIFEST_FILE}"

echo "[5/6] Update deployment image"
kubectl -n "${NAMESPACE}" set image "deployment/${DEPLOYMENT_NAME}" "${CONTAINER_NAME}=${REMOTE_IMAGE}"

echo "[6/6] Rollout restart + status"
kubectl -n "${NAMESPACE}" rollout restart "deployment/${DEPLOYMENT_NAME}"
kubectl -n "${NAMESPACE}" rollout status "deployment/${DEPLOYMENT_NAME}" --timeout=180s

echo "Done: ${REMOTE_IMAGE}"