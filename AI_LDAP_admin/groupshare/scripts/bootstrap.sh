#!/bin/bash
# Idempotent prerequisites for GroupShare / NamespaceShare that kustomize cannot express.
# Existing objects are never replaced, so re-running on a working cluster changes nothing.
#
#   QNAP_IP=... QNAP_MOUNT=... bash bootstrap.sh nfs    # before `kubectl apply -k`
#   bash bootstrap.sh secrets                           # before `kubectl apply -k` (no-op without the kubeflow namespace)
#   bash bootstrap.sh vwc                               # before `kubectl apply -k` (no-op unless upgrading an old deployment)
#   bash bootstrap.sh webhook                           # after `kubectl apply -k`
#
# nfs:     create QNAP_MOUNT and QNAP_MOUNT/_namespaces on the NFS server when missing (the backend
#          and every notebook mount them; a missing directory blocks Pod start).
# secrets: create the webhook CA Secret and the public trust Secret when absent. When an older
#          deployment's self-signed Secret exists, its CA is kept in the trust bundle so webhook Pods
#          still serving the old certificate stay trusted during the rollout.
# vwc:     upgrading from a deployment whose ValidatingWebhookConfiguration was applied with
#          `caBundle: ""` and `inject-ca-from`: record the new manifest as last-applied first, so
#          the following apply does not blank the injected caBundle (which would reject every
#          Notebook create/update until re-injection), and drop the old injection annotation.
# webhook: run `secrets`, wait for the serving certificate, the webhook and the injected caBundle,
#          and apply monitoring when Prometheus Operator CRDs exist.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
NS=kubeflow
CA_SECRET=groupshare-webhook-ca-2026
TRUST_SECRET=groupshare-webhook-trust
LEGACY_TLS_SECRET=groupshare-webhook-tls

log() { echo "[groupshare-bootstrap] $*"; }

ensure_dir() {
  [ -d "$1" ] && return 0
  mkdir -p "$1" && chmod 777 "$1" && log "created $2"
}

bootstrap_nfs() {
  if [ -z "${QNAP_IP:-}" ] || [ -z "${QNAP_MOUNT:-}" ]; then
    log "QNAP_IP / QNAP_MOUNT not set; skip NFS directories"
    return 1
  fi
  local base="${QNAP_MOUNT%/}" mnt root rc=0
  mnt="$(mktemp -d)"
  # Mount the share itself, or its parent when the share directory does not exist yet.
  if mount -t nfs "${QNAP_IP}:${base}" "$mnt" 2>/dev/null; then
    root="$mnt"
  elif mount -t nfs "${QNAP_IP}:$(dirname "$base")" "$mnt" 2>/dev/null; then
    root="$mnt/$(basename "$base")"
    ensure_dir "$root" "${base}" || rc=1
  else
    log "cannot mount ${QNAP_IP}:${base} or its parent (is nfs-common installed and the export allowed?)"
    rmdir "$mnt"
    return 1
  fi
  ensure_dir "$root/_namespaces" "${base}/_namespaces" || rc=1
  umount "$mnt"; rmdir "$mnt"
  [ $rc -eq 0 ] && log "NFS directories ready: ${QNAP_IP}:${base}{,/_namespaces}" || log "failed to create NFS directories"
  return $rc
}

bootstrap_secrets() {
  if ! kubectl get namespace "$NS" >/dev/null 2>&1; then
    log "namespace $NS not created yet; secrets are created after the first apply"
    return 0
  fi
  local work
  work="$(mktemp -d)"

  if ! kubectl -n "$NS" get secret "$CA_SECRET" >/dev/null 2>&1; then
    log "creating webhook CA Secret $NS/$CA_SECRET"
    if ! openssl req -x509 -newkey rsa:3072 -nodes -days 1826 \
        -keyout "$work/ca.key" -out "$work/ca.crt" \
        -subj "/CN=GroupShare Webhook CA $(date +%Y)/O=CGU" \
        -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
        -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null; then
      log "openssl failed"; rm -rf "$work"; return 1
    fi
    kubectl -n "$NS" create secret tls "$CA_SECRET" --cert="$work/ca.crt" --key="$work/ca.key" || { rm -rf "$work"; return 1; }
  fi

  if ! kubectl -n "$NS" get secret "$TRUST_SECRET" >/dev/null 2>&1; then
    kubectl -n "$NS" get secret "$CA_SECRET" -o jsonpath='{.data.tls\.crt}' | base64 -d > "$work/trust.crt"
    local legacy
    legacy="$(kubectl -n "$NS" get secret "$LEGACY_TLS_SECRET" -o jsonpath='{.data.ca\.crt}' 2>/dev/null | base64 -d 2>/dev/null)"
    if [ -n "$legacy" ]; then
      printf '%s\n' "$legacy" >> "$work/trust.crt"
      log "trust bundle also keeps the CA of $NS/$LEGACY_TLS_SECRET for the migration"
    fi
    log "creating public trust Secret $NS/$TRUST_SECRET"
    kubectl -n "$NS" create secret generic "$TRUST_SECRET" --from-file=ca.crt="$work/trust.crt" || { rm -rf "$work"; return 1; }
    kubectl -n "$NS" annotate secret "$TRUST_SECRET" cert-manager.io/allow-direct-injection=true --overwrite
  fi
  rm -rf "$work"
}

bootstrap_vwc() {
  local vwc=groupshare-validating-webhook last
  kubectl get validatingwebhookconfiguration "$vwc" >/dev/null 2>&1 || return 0
  last="$(kubectl get validatingwebhookconfiguration "$vwc" \
    -o jsonpath='{.metadata.annotations.kubectl\.kubernetes\.io/last-applied-configuration}')"
  case "$last" in
    *caBundle*|*'inject-ca-from"'*) ;;
    *) return 0 ;;
  esac
  log "upgrading $vwc: keep the injected caBundle across the first apply"
  kubectl apply set-last-applied -f "$HERE/../deploy/validating-webhook-configuration.yaml" || return 1
  kubectl annotate validatingwebhookconfiguration "$vwc" cert-manager.io/inject-ca-from- >/dev/null 2>&1 || true
}

bootstrap_webhook() {
  local rc=0 bundle
  bootstrap_secrets || return 1

  if ! kubectl -n "$NS" wait certificate/groupshare-webhook-serving --for=condition=Ready --timeout=300s; then
    log "serving certificate not Ready; check: kubectl -n $NS describe certificate groupshare-webhook-serving"
    rc=1
  fi
  if ! kubectl -n "$NS" rollout status deploy/groupshare-validating-webhook --timeout=300s; then
    log "webhook not ready; Notebook create/update is blocked until it is (failurePolicy=Fail)"
    rc=1
  fi
  for _ in $(seq 1 30); do
    bundle="$(kubectl get validatingwebhookconfiguration groupshare-validating-webhook -o jsonpath='{.webhooks[0].clientConfig.caBundle}')"
    [ -n "$bundle" ] && break
    sleep 5
  done
  if [ -z "$bundle" ]; then
    log "caBundle still empty; check cert-manager cainjector logs"
    rc=1
  fi

  if kubectl get crd prometheusrules.monitoring.coreos.com podmonitors.monitoring.coreos.com \
      servicemonitors.monitoring.coreos.com >/dev/null 2>&1; then
    kubectl apply -f "$HERE/../deploy/webhook-certificate-monitoring.yaml" || rc=1
  else
    log "Prometheus Operator CRDs not found; skip certificate monitoring"
  fi
  return $rc
}

case "${1:-}" in
  nfs) bootstrap_nfs ;;
  secrets) bootstrap_secrets ;;
  vwc) bootstrap_vwc ;;
  webhook) bootstrap_webhook ;;
  *) echo "usage: $0 nfs|secrets|vwc|webhook" >&2; exit 2 ;;
esac
