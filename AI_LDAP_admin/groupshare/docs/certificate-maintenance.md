# GroupShare 憑證自動續期與年度維護

更新：2026-09-09，本文時間使用 Asia/Taipei (UTC+8)。
叢集：`kubernetes-admin@kubernetes`；Kubernetes v1.26.15；cert-manager / cmctl v1.12.2。

## 1. 已完成的修復

GroupShare 現在使用 **400 天服務憑證、提前 60 天自動續期、穩定 CA、TLS 熱載入及兩個副本**。一般續期不需要管理者重啟 webhook。

本次故障原本是 cert-manager 已換證，但 Flask 程序仍提供啟動時載入的舊憑證；API Server 的信任資料已換新，因此 Notebook CREATE/UPDATE 回報 `certificate signed by unknown authority`。舊憑證原定 2026-09-12 到期，事發當時尚未過期。

最初的重啟與 liveness 修復可以自動恢復，但不能避免換證時短暫失敗。本次進一步完成：

1. 以專用穩定 CA 簽發 leaf；API Server 信任 CA，一般 leaf 續期不再更換信任根。
2. 每次 TLS 握手檢查 Kubernetes Secret 的原子投射版本；載入完整的新憑證與私鑰後，才切換 SSLContext。
3. 私鑰不匹配或投射暫時不可讀時，保留最後一份有效 context，並輸出監測狀態。
4. 兩個副本優先分散在不同節點（換證演練時為 `gpunode050`、`gpunode051`），rolling update 設定 `maxUnavailable: 0`，PDB 至少保留一個副本。
5. 保留憑證一致性 liveness probe 作為熱載入失效時的最後保護。只有新憑證及私鑰有效且持續未載入，才觸發重啟；新 Secret 缺檔或配對錯誤時保留仍正常提供 TLS 的程序。正常續期不會觸發重啟。
6. Prometheus 每 30 秒對每個副本做具 CA/hostname 驗證的 HTTPS scrape，並監測重新載入、到期、Ready 與資料消失。

此變更處理的是 **GroupShare 憑證到期及續期導致 Notebook admission 失敗**。其他平台元件、儲存、網路、硬體的可用性仍須各自維護；目前控制平面憑證也需要在 2027 年 7 月前處理，見年度時程。

## 2. 現行資源與期限

| 資源 | 目前設定 |
| --- | --- |
| CA Secret | `kubeflow/groupshare-webhook-ca-2026`，私鑰僅供 cert-manager 簽發，不掛進 webhook |
| CA 到期 | **2031-09-08 14:33:56**；版本固定，不自動替換信任根 |
| Issuer | `kubeflow/groupshare-webhook-ca`，type CA |
| Certificate | `kubeflow/groupshare-webhook-serving` |
| Leaf Secret | `kubeflow/groupshare-webhook-serving-tls` |
| Leaf 設定 | `duration: 9600h` (400 天)、`renewBefore: 1440h` (60 天)、`rotationPolicy: Always` |
| Leaf 本次到期 | **2027-10-14 14:36:52** |
| 下次預計自動續期 | **2027-08-15 14:36:52**，後續以 Certificate status 為準 |
| 信任 Secret | `kubeflow/groupshare-webhook-trust`，`ca.crt` 僅含目前穩定 CA |
| CA 注入 | VWC annotation `cert-manager.io/inject-ca-from-secret: kubeflow/groupshare-webhook-trust` |
| 程式碼版本 | immutable ConfigMap `groupshare-webhook-tls-runtime-20260909`，掛於 `/opt/groupshare-webhook` |
| 依賴映像 | `docker.io/cguaicadmin/groupshare-webhook:v20260617-172109d`，啟動命令指向上述 ConfigMap |

舊 `groupshare-webhook-cert` / `groupshare-webhook-tls` 暫留作歷史與回復參考，已不供線上 webhook 使用。盤點時不要把舊 Certificate 的日期當成線上期限。

信任 Secret 有 `cert-manager.io/allow-direct-injection: "true"`。它只有公開 CA；不得把 CA 私鑰放入此 Secret、ConfigMap、Git 或工單。

## 3. 現場驗證結果

2026-09-09 已完成：

- **31 項測試通過**：包含 12 次連續投射更新、無 SNI 用戶端、同時多個 TLS 握手、私鑰不匹配與投射缺失時保留舊有效憑證，以及 liveness 不因無效替代憑證重啟仍正常的程序。
- 線上以 `cmctl renew -n kubeflow groupshare-webhook-serving` 觸發真正的重簽，Certificate revision **1 -> 2**。
- 每個副本實際提供的 leaf 指紋都等於 revision 2 Secret，CA 與 hostname 驗證通過。
- 換證前後兩個 Pod 的 **UID 與 restartCount 完全一致**；透過 TLS 熱載入完成更新。
- 從信任遷移前到續期後，持續 4 分鐘執行 **205 次 Notebook server dry-run：103 CREATE、102 UPDATE、0 失敗**。
- 非法 NFS 路徑仍得到 GroupShare Rule A 拒絕，`failurePolicy: Fail` 持續啟用。
- `openssl verify -attime` 使用一年後的時間驗證目前 leaf、CA 及 hostname，結果為 OK；此檢查沒有修改任何主機時間。
- Prometheus 已取得兩個副本的 `groupshare_tls_reload_healthy=1`，可查詢新 Certificate 的到期 metric。

這是實際續期與短期負載驗證，並非已經運行一年。未實際建立測試 Notebook 或修改使用者 Notebook 資料，也未代替使用者進行瀏覽器登入。

本次 leaf serial：`AAC4EE14D49E00B3CE1CB0A2FB3E54BF`。
本次 leaf SHA-256：`5C:5E:4F:7D:17:0D:AC:F7:BE:4C:A0:2B:21:86:D4:EF:83:13:BF:44:77:6B:85:31:0C:0D:F9:C1:B0:64:E5:EB`。
CA SHA-256：`46:9B:36:3E:5A:3B:39:55:AE:80:95:5E:E2:94:78:B6:0D:49:E1:4A:60:5F:EE:C9:D0:39:8E:E9:07:7D:8E:04`。

原始證據與備份：`/root/mark/groupshare-certificate-maintenance/backups/20260909-hot-reload/`。
`migration-soak.json` 記錄逐類成功數與失敗清單；`pods-before-renew.json` / `pods-after-renew.json` 證明沒有重啟；`leaf-revision*.crt`、`served-*.pem` 留存公開憑證。
目錄另含 CA 私鑰及 Secret 備份，採 root 限制權限，不可整包公開或提交 Git。

## 4. 日常自動流程

```text
cert-manager 到達 renewalTime
    -> 以穩定 CA 簽發新 leaf + 新私鑰
    -> 更新 serving TLS Secret
    -> kubelet 將新 Secret 原子投射至各 Pod
    -> 下一次 TLS 握手載入新 context
    -> Prometheus 驗證 HTTPS、重新載入狀態及到期日
```

兩個 Pod 可以在不同時間收到 Secret。過渡期間舊、新 leaf 都由相同有效 CA 簽發，因此 API Server 都能接受。

不要為了一般 leaf 續期更換 CA Secret 或手動覆寫 `caBundle`。CA 的輪替需事先發佈新舊信任重疊，見第 8 節。

## 5. 檢查、續期與驗收命令

操作主機需可連到叢集網路，並有 `kubectl`、`cmctl`、`jq`、`openssl`、`curl`、Python 3。cmctl 已從 cert-manager 官方 v1.12.2 release 安裝至 `/usr/local/bin/cmctl`。

```bash
kubectl config current-context
kubectl -n kubeflow get certificate groupshare-webhook-serving -o yaml
kubectl -n kubeflow get issuer groupshare-webhook-ca
kubectl -n kubeflow get pods -l app=groupshare-validating-webhook -o wide
kubectl -n kubeflow get endpoints groupshare-webhook
```

公開 leaf 的有效期與指紋：

```bash
kubectl -n kubeflow get secret groupshare-webhook-serving-tls \
  -o jsonpath='{.data.tls\.crt}' | base64 -d \
  | openssl x509 -noout -dates -serial -fingerprint -sha256
```

以 API Server 真正使用的信任資料檢查 **每個** endpoint；在獨立 Bash shell 執行：

```bash
set -euo pipefail
TLS_CHECK_DIR=$(mktemp -d)
kubectl get validatingwebhookconfiguration groupshare-validating-webhook \
  -o jsonpath='{.webhooks[0].clientConfig.caBundle}' | base64 -d > "$TLS_CHECK_DIR/ca.crt"
kubectl -n kubeflow get secret groupshare-webhook-serving-tls \
  -o jsonpath='{.data.tls\.crt}' | base64 -d > "$TLS_CHECK_DIR/expected.crt"
EXPECTED_FP=$(openssl x509 -in "$TLS_CHECK_DIR/expected.crt" -noout -fingerprint -sha256)
ENDPOINTS=$(kubectl -n kubeflow get endpoints groupshare-webhook -o jsonpath='{.subsets[*].addresses[*].ip}')
test -n "$ENDPOINTS"
for endpoint in $ENDPOINTS; do
  timeout 10 openssl s_client -connect "$endpoint:8443" \
    -servername groupshare-webhook.kubeflow.svc \
    -verify_hostname groupshare-webhook.kubeflow.svc \
    -verify_return_error -CAfile "$TLS_CHECK_DIR/ca.crt" \
    </dev/null > "$TLS_CHECK_DIR/served-$endpoint.pem"
  ACTUAL_FP=$(openssl x509 -in "$TLS_CHECK_DIR/served-$endpoint.pem" -noout -fingerprint -sha256)
  test "$EXPECTED_FP" = "$ACTUAL_FP"
  printf '%s: current leaf and trust verified\n' "$endpoint"
done
printf 'Public verification files: %s\n' "$TLS_CHECK_DIR"
```

剛續期時要等待 kubelet 投射完成再要求 fingerprint 完全相同；過渡期間舊 leaf 的 CA 驗證仍應成功。`caBundle` 是 CA，**不應**要求它與 leaf 的指紋相同。

主動續期演練：先記錄 revision、serial、Pod UID 與 restartCount，再開啟連續 admission 驗證：

```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin/groupshare
python3 scripts/admission-soak.py --namespace TEST_NAMESPACE --notebook TEST_NOTEBOOK \
  --seconds 240 --report /tmp/groupshare-renewal-check.json
```

請將 `TEST_NAMESPACE` 與 `TEST_NOTEBOOK` 替換為仍存在且符合政策的驗收 Notebook。程式以它作為合法範本，所有 CREATE/UPDATE 都是 server dry-run，不會保存物件。

在另一個終端執行：

```bash
cmctl renew -n kubeflow groupshare-webhook-serving
kubectl -n kubeflow get certificate groupshare-webhook-serving -w
```

等待 revision 增加、serial 改變及 Ready=True，再執行 endpoint 驗證與比較 Pod UID/restartCount。舊 Ready=True 可能在重簽期間仍存在，所以單靠 `kubectl wait --for=condition=Ready` 不足以證明續期成功。

正常續期不執行 rollout restart、不刪 Secret，也不把 failurePolicy 改成 Ignore。

## 6. 部署與回復

### 現行程式碼發布

[webhook-tls-runtime-configmap.json](../deploy/webhook-tls-runtime-configmap.json) 是由 `webhook/app.py`、`rules.py`、`tls_reload.py` 產生的 immutable ConfigMap。所有 Notebook 政策仍由原有 rules.py 判斷。

新版本需產生新名稱，例如修改下列 VERSION；同步更新 deployment 與 runtime patch 的 ConfigMap 名稱，再測試及部署。不可修改已發布的 immutable ConfigMap。

```bash
VERSION=replace-with-new-release
kubectl -n kubeflow create configmap "groupshare-webhook-tls-runtime-$VERSION" \
  --from-file=app.py=webhook/app.py --from-file=rules.py=webhook/rules.py \
  --from-file=tls_reload.py=webhook/tls_reload.py --dry-run=client -o json \
  | jq '.immutable=true'
python3 -m unittest discover -s tests -p 'test_*.py'
```

已完成信任遷移的環境可套用：

```bash
kubectl apply -f deploy/webhook-ca-issuer.yaml -f deploy/webhook-serving-certificate.yaml
kubectl apply -f deploy/webhook-tls-runtime-configmap.json
kubectl -n kubeflow patch deployment groupshare-validating-webhook \
  --type=strategic --patch-file deploy/webhook-tls-runtime-patch.yaml
kubectl -n kubeflow patch deployment groupshare-validating-webhook \
  --type=strategic --patch-file deploy/webhook-tls-probes-patch.yaml
kubectl apply -f deploy/webhook-pdb.yaml -f deploy/webhook-certificate-monitoring.yaml
kubectl -n kubeflow rollout status deployment/groupshare-validating-webhook --timeout=240s
```

完整 Deployment 來源 [webhook-deployment.yaml](../deploy/webhook-deployment.yaml) 已同步現行 image、command、Secret、ConfigMap、replicas 及 affinity，供新部署使用；probes 由上述獨立 patch 加入。

### 應用程式回復

若新版熱載入程式出現問題，可先回到原映像內的 webhook 程式，**保留新 CA、400 天 leaf、兩個副本與 liveness 防護**：

```bash
kubectl -n kubeflow patch deployment groupshare-validating-webhook --type=strategic \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"webhook","command":["python","/app/webhook/app.py"],"args":[]}]}}}}'
kubectl -n kubeflow rollout status deployment/groupshare-validating-webhook --timeout=240s
```

此回復版本失去熱載入與 `/metrics`，監測會回報失敗；應修正後重新套用 runtime patch。不要直接 rollout undo 到舊 SelfSigned Secret，也不要還原已過期的 leaf。

若只有 Secret 投射後載入卡住且憑證/私鑰已確認有效，可執行 `kubectl -n kubeflow rollout restart deployment/groupshare-validating-webhook` 作為應急處理，之後必須追查熱載入失敗原因。

## 7. 已部署的監測

現有 Prometheus 已載入 [webhook-certificate-monitoring.yaml](../deploy/webhook-certificate-monitoring.yaml)：

| 規則 | 條件 |
| --- | --- |
| GroupShareTLSReloadFailed | 新 Secret 無法載入超過 2 分鐘 |
| GroupShareTLSHandshakeFailed | 任一副本的具信任驗證 HTTPS scrape 失敗超過 2 分鐘 |
| GroupShareTLSMonitoringMissing | 所有熱載入監測資料消失超過 5 分鐘 |
| GroupShareCertificateExpiring | 新 leaf 剩餘不到 45 天，代表已進入 60 天續期窗但尚未完成更新 |
| GroupShareCertificateRenewalOverdue | renewalTime 已過超過 1 小時仍未完成續期 |
| GroupShareCertificateNotReady | Certificate Ready 異常超過 5 分鐘 |
| GroupShareCertificateMetricsMissing | 憑證盤點資料消失超過 5 分鐘 |
| GroupShareRootCARotationDue | 版本化 CA 剩餘不到 540 天，提前安排根憑證遷移 |

HTTPS scrape 的 CA 來自 `groupshare-webhook-trust`，沒有停用 TLS 驗證。leaf 的到期 metric 由 cert-manager 提供，與實際服務握手監測一起使用。

**通知限制：目前 Alertmanager 唯一 receiver 是 `null`，沒有 email/webhook 整合。** 告警可在 Prometheus/Alertmanager 查詢，但不會送達人員。本次已詢問通知管道，尚待提供；沒有設定或發送任何外部通知。

根 CA 告警中的 epoch `1946615636` 對應此版本 CA 的到期日；更換 CA 時必須同步更新規則，不能沿用舊日期。

## 8. 首次遷移與 CA 輪替

本次使用以下順序避免信任切換期間失敗，未來根憑證輪替也採相同原則：

1. 先備份現行 Deployment、VWC、Certificates 及 Secrets 至 root 限制目錄。
2. 產生新的版本化 CA，先建立新 CA Secret、Issuer 與獨立 leaf Certificate/Secret。**不要覆蓋正在使用的 CA Secret。**
3. 建立含「舊信任根 + 新 CA」的公開 trust Secret，設定 `allow-direct-injection: "true"`。
4. 將 VWC 注入來源改成 trust Secret；確認 API Server 的 caBundle 已包含兩份信任，且舊服務仍通過驗證。
5. Rolling update 切換服務至新 leaf 與熱載入程式；持續執行 admission soak。
6. 確認所有 Ready endpoints 都使用新 leaf、舊 Pod 已退出，才移除 trust bundle 中的舊信任。
7. 演練一次 leaf 續期；驗證零 admission 失敗、所有副本載入新 leaf、無 Pod 重啟。

本次 CA 以 OpenSSL 產生，RSA 3072、有效 1825 天、`basicConstraints=critical,CA:TRUE,pathlen:0`、`keyUsage=critical,keyCertSign,cRLSign`。它是專供 GroupShare 的版本化 CA，沒有改動 Kubernetes、其他 webhook 或網站的信任根。

CA 不做無協調的自動覆蓋，因為那會重新引入本次信任不同步問題。最遲在 CA 剩餘 400 天前完成上述遷移，確保新簽發的 400 天 leaf 不超出 CA 有效期；監測提前至 540 天提醒。

備份須包含 CA Secret 私鑰並限制存取。新叢集的災難還原需恢復原 CA 與 trust；若私鑰遺失，使用新 CA 並重新進行信任遷移，不能只恢復公開憑證。

## 9. 年度流程

GroupShare 例行換證交給自動化，年度人工工作集中於盤點、演練與其他元件維護。

| 時間 | 工作 |
| --- | --- |
| 持續 | 已部署 cert-manager 自動續期、TLS 熱載入、30 秒監測及告警規則 |
| 近期 | 補上 Alertmanager 實際通知管道與主要/代理負責人 |
| 每月第一個工作日 | 複核監測目標健康、無資料告警及憑證期限；確認通知通道可用 |
| 每年 5 月第一週 | 全平台憑證與 kubeconfig 盤點；確認備份與維護窗口 |
| 2027-06-05 09:00-11:00（建議窗口） | 控制平面憑證維護及 Notebook 登入、建立、掛載驗收 |
| 2027-08-15 左右 | GroupShare 預計自動續期，應由監測驗證；不需例行人工重啟 |
| CA 剩餘 540 天前後 | 啟動版本化 CA 輪替計畫，於剩餘 400 天前完成 |

2026-09-09 其他元件盤點：kubeadm 控制平面多數憑證到 **2027-07-20**，scheduler 到 **2027-07-23**；`kflow2.cgu.edu.tw` 到 **2026-11-19 05:05:01**，certbot.timer 已啟用；其餘 cert-manager leaf 多在 2026 年 11 月到期，仍按原有短效流程續期。

本次沒有更新上述其他元件。單控制平面 `gpunode040` 的換證及 static Pod 重啟需在維護窗口執行，並事前驗證 etcd snapshot、備份 `/etc/kubernetes`、確認 kubeconfig 副本更新方式。年度流程與通知人員尚未建立行事曆指派。

## 10. 參考資料

- [cert-manager v1.12：Certificate 續期與重新載入](https://cert-manager.io/v1.12-docs/usage/certificate/)
- [cert-manager v1.12：CA Issuer 與根憑證輪替責任](https://cert-manager.io/v1.12-docs/configuration/ca/)
- [cert-manager v1.12：CA Injector](https://cert-manager.io/v1.12-docs/concepts/ca-injector/)
- [Python 3.11：SSLContext 與 SNI callback](https://docs.python.org/3.11/library/ssl.html#ssl.SSLContext.sni_callback)
- [Kubernetes：kubeadm 憑證管理](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
