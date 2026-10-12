#!/bin/bash
# GroupShare / NamespaceShare 唯讀檢查（不修改任何資源）
# 用法：在要檢查的 master 上，於 cgu-manifests 目錄執行：sudo bash cgu/groupshare/scripts/check.sh [env.ini 路徑]
# apply.sh 部署完會自動執行一次。
ENV_FILE="${1:-env.ini}"
source "$ENV_FILE" || exit 1
echo "== env: QNAP_IP=$QNAP_IP QNAP_MOUNT=$QNAP_MOUNT NS=$QNAP_SHARED_NAMESPACE DEPLOY=$QNAP_NFS_DEPLOYMENT"

echo "== 1. controller 讀取的 NFS 設定 ConfigMap（provisioner Deployment 只是備用來源）"
kubectl -n "$QNAP_SHARED_NAMESPACE" get cm groupshare-nfs-defaults namespace-share-nfs-defaults -o custom-columns=NAME:.metadata.name,SERVER:.data.NFS_SERVER,PATH:.data.NFS_PATH \
  || echo "!! 找不到 -> controller 無法產生 PodDefault"

echo "== 2. 元件狀態"
kubectl -n kubeflow get deploy groupshare-controller namespace-share-controller groupshare-validating-webhook
kubectl -n kubeflow get pods | grep -E "groupshare|namespace-share"
for d in groupshare-controller namespace-share-controller groupshare-validating-webhook; do
  echo "-- logs $d"; kubectl -n kubeflow logs deploy/$d --tail=15 2>&1
done

echo "== 3. webhook 憑證（failurePolicy=Fail，壞了會擋住所有 Notebook 建立/修改）"
kubectl -n kubeflow get issuer groupshare-webhook-ca
kubectl -n kubeflow get certificate groupshare-webhook-serving
kubectl -n kubeflow get secret groupshare-webhook-trust >/dev/null && echo "secret groupshare-webhook-trust OK" || echo "!! 缺 trust Secret，請執行 bootstrap.sh webhook"
VWC=groupshare-validating-webhook
echo "inject-ca-from=$(kubectl get validatingwebhookconfiguration $VWC -o jsonpath='{.metadata.annotations.cert-manager\.io/inject-ca-from}')（應為空）"
echo "inject-ca-from-secret=$(kubectl get validatingwebhookconfiguration $VWC -o jsonpath='{.metadata.annotations.cert-manager\.io/inject-ca-from-secret}')"
echo "caBundle 長度=$(kubectl get validatingwebhookconfiguration $VWC -o jsonpath='{.webhooks[0].clientConfig.caBundle}' | wc -c)（0 表示 API server 無法信任 webhook）"

echo "== 4. PodDefault 是否已對每個 Profile 產生"
echo "profiles=$(kubectl get profiles --no-headers | wc -l)  groupshare-poddefaults=$(kubectl get poddefault -A --no-headers | grep -c ' groupshare ')"

echo "== 5. NFS 匯出與目錄"
showmount -e "$QNAP_IP" 2>&1 | head -n 10
MNT=$(mktemp -d)
if mount -t nfs -o ro "$QNAP_IP:$QNAP_MOUNT" "$MNT" 2>/dev/null; then
  [ -d "$MNT/_namespaces" ] || echo "!! $QNAP_MOUNT/_namespaces 不存在"
  for ns in $(kubectl get profiles -o jsonpath='{.items[*].metadata.name}'); do
    [ -d "$MNT/_namespaces/$ns" ] || echo "!! 缺 namespace 目錄: _namespaces/$ns（該 namespace 的 Pod 會卡在 FailedMount）"
  done
  umount "$MNT"
else
  echo "!! 無法掛載 $QNAP_IP:$QNAP_MOUNT"
fi
rmdir "$MNT"

echo "== 6. 需要重啟才會套用新群組掛載的 Notebook Pod（不會自動重啟）"
kubectl get pods -A -l notebook-name -o jsonpath='{range .items[?(@.metadata.annotations.groupshare\.kubeflow\.org/restart-required)]}{.metadata.namespace}/{.metadata.name} {.metadata.annotations.groupshare\.kubeflow\.org/restart-required}{"\n"}{end}'

echo "== 7. 近期與掛載/webhook 相關的事件"
kubectl get events -A --sort-by=.lastTimestamp | grep -iE "groupshare|FailedMount|webhook|GroupShareRestartRequired" | tail -n 20
