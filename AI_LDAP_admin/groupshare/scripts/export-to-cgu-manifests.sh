#!/bin/bash
# Copy GroupShare / NamespaceShare from this repository (the source of truth) into a cgu-manifests
# checkout, keeping the same directory layout so the kustomizations work unchanged in both places.
#
#   bash groupshare/scripts/export-to-cgu-manifests.sh /path/to/cgu-manifests
#
# deploy/controller-configmap.yaml and deploy/controller-deployment.yaml are not copied: they hold
# environment values that cgu-manifests' apply.sh rewrites from env.ini.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
DST="${1:?usage: $0 /path/to/cgu-manifests}"
[ -f "$DST/apply.sh" ] || { echo "$DST does not look like cgu-manifests (no apply.sh)" >&2; exit 1; }

copy() {
  mkdir -p "$(dirname "$DST/cgu/$2")"
  cp "$SRC/$1" "$DST/cgu/$2"
}

for f in kustomization.yaml README.md docs/certificate-maintenance.md docs/deploy-handoff-20261012.md docs/profile-annotation-spec.md \
         controller/app.py controller/parser.py \
         webhook/app.py webhook/rules.py webhook/tls_reload.py \
         scripts/bootstrap.sh scripts/check.sh \
         deploy/controller-rbac.yaml deploy/controller-runtime-patch.yaml \
         deploy/webhook-rbac.yaml deploy/webhook-service.yaml deploy/webhook-ca-issuer.yaml \
         deploy/webhook-serving-certificate.yaml deploy/webhook-deployment.yaml deploy/webhook-pdb.yaml \
         deploy/validating-webhook-configuration.yaml deploy/webhook-certificate-monitoring.yaml; do
  copy "groupshare/$f" "groupshare/$f"
done
for f in kustomization.yaml controller/app.py controller/parser.py \
         deploy/controller-rbac.yaml deploy/controller-runtime-patch.yaml; do
  copy "namespace_share/$f" "namespace_share/$f"
done

# Superseded by the kustomize ConfigMap generators and the serving certificate.
rm -f "$DST"/cgu/groupshare/deploy/{controller-code-configmap,webhook-code-configmap,webhook-certificate,notebook-template-groupshare}.yaml \
      "$DST"/cgu/namespace_share/deploy/controller-code-configmap.yaml

echo "exported to $DST/cgu/{groupshare,namespace_share}"
