# GroupShare 部署修正交接（2026-10-12）

給：負責 cgu-manifests 部署的人。內容：這次改了什麼、檔案在哪、要執行哪些指令。

## 一句話

GroupShare 已整合在 cgu-manifests 的 `apply.sh`，但原本的設定只在手動修過的 .6 能用，新環境（例如 10.100.1.4）會壞。這次把 9 月在 .6 修好的設定與程式放回 repo，並補上新環境需要的自動前置作業，之後跑 `apply.sh` 就能正確部署。

## 程式與檔案位置

兩個 repository 都推了 branch `groupshare-deploy-fix-20261012`，請檢查後合併：

| Repository | 基底 branch | 內容 |
|---|---|---|
| `wycc/cgu-manifests` | `cgu-2.0-2026H3-Lance`（fab6a2b8） | 部署設定，`apply.sh` |
| `lance-cl-lu/AI_Centre_Admin` | `cgu-2.0-2026H3-23.6-mark` | 程式原始碼（唯一來源）、後端 |

`AI_LDAP_admin/groupshare/scripts/export-to-cgu-manifests.sh` 會把 GroupShare 從 AI_Centre_Admin 同步到 cgu-manifests；以後改程式請先改 AI_Centre_Admin 再同步，不要只改 cgu-manifests。

cgu-manifests 的 branch 沒有動到你本機有改過的 6 個環境檔（`env.ini`、兩個 `controller-configmap.yaml`、兩個 `controller-deployment.yaml`、`ldap-backend/full-stack-deployment.yaml`），`git pull` / merge 不會衝突，`apply.sh` 依 `env.ini` 改寫這些檔案的方式也不變。

## 改了什麼

### cgu-manifests

- `cgu/groupshare/`：換成與 .6 線上相同的 webhook 設定（自建 CA Issuer、`groupshare-webhook-serving` 憑證、2 副本、PDB、TLS 熱載入、健康檢查）。
- `validating-webhook-configuration.yaml`：拿掉 `caBundle: ""`。舊檔每次 apply 都會清空 API server 對 webhook 的信任，期間所有 Notebook 建立／修改都會被擋。
- controller 與 webhook 程式改由 kustomize `configMapGenerator` 產生 ConfigMap 掛入，改程式不需重建映像（映像只提供 Python 套件）。
- 移除：`notebook-template-groupshare.yaml`（部署時會真的建立一個 Notebook，webhook 未就緒時讓 `apply.sh` 卡在重試迴圈）、舊的 `*-code-configmap.yaml`、舊 SelfSigned `webhook-certificate.yaml`。
- 新增 `cgu/groupshare/scripts/`：
  - `bootstrap.sh nfs`：NFS 上沒有 `QNAP_MOUNT` 或 `QNAP_MOUNT/_namespaces` 時建立。
  - `bootstrap.sh secrets`：沒有 webhook CA / trust Secret 時建立；若有舊的 `groupshare-webhook-tls`，trust 會同時信任舊憑證，換版期間不中斷。
  - `bootstrap.sh webhook`：等憑證、webhook 與 caBundle 就緒；有 Prometheus Operator 時套用監測。
  - `check.sh`：部署後唯讀檢查。
- `apply.sh`：kustomize 前執行 `bootstrap.sh nfs`、`bootstrap.sh secrets`，恢復 ingress 後執行 `bootstrap.sh webhook`，最後執行 `check.sh`。三個步驟都可重複執行，已存在的物件不會被覆蓋。
- `example/kustomization.yaml`：後端映像改為 `docker.io/cguaicadmin/ldap_backend:v2610121415`（**先推映像再 apply**，見下方）。

### Controller（AI_Centre_Admin `groupshare/controller`、`namespace_share/controller`）

- NFS 設定以 `apply.sh` 寫入的 ConfigMap 為準；provisioner Deployment 只是備用來源。原本找不到 `QNAP_NFS_DEPLOYMENT` 時 controller 會直接 crash。
- 設定每輪重新讀取，不再只在啟動時讀。
- 新增：比對每個 Notebook Pod 實際的群組掛載與目前 PodDefault，不一致時在 Pod 加 `groupshare.kubeflow.org/restart-required` annotation，並對 Notebook 發 `GroupShareRestartRequired` Event。**不會重啟任何 Pod**；使用者停止再啟動 Notebook 就套用，`/home/jovyan` 不受影響。Kubernetes 無法修改執行中 Pod 的 volume，所以只能提示。

### 後端（AI_Centre_Admin `AI_LDAP_admin/api`）

- `groupshare_reconcile.py`（新）：後端每 600 秒依 Django DB（管理平台看到的群組成員與管理權限）對帳所有 Profile 的 `group` / `manager` / `manager-group` annotation，並建立缺少的群組與 namespace 目錄。DB 找不到使用者的 Profile 不動。`GROUPSHARE_RECONCILE_INTERVAL_SECONDS=0` 可停用。
- `python manage.py reconcile_groupshare [--dry-run]`（新）：手動執行。
- `views.py`：群組刪除（含到期清理）、使用者停用、批次匯入既有使用者這三處原本沒有同步 Profile，已補上。
- `TRASH` 與 `root` 一樣不產生共享資料夾（`groupshare_storage.GROUPSHARE_EXCLUDED_GROUPS`）。
- `views.py` 第 1099 行：repo 版本把 `else:` 註解掉，會讓群組成員清單只列出 LDAP 找不到的人；已改回與線上一致。
- `api/migrations/0006_groupdefaultquota_gpu_vendor.py`：線上容器啟動時自動產生、但 repo 沒有的 migration，已補上。
- `Dockerfile.groupshare-overlay`：以線上 `v0.3.01` 為基底只覆蓋上述 Python 檔，前端與套件完全不變。

測試：GroupShare 39 項、NamespaceShare 6 項、後端 12 項全部通過。

## .6（gpunode040）目前狀態

已完成（2026-10-12 由 Mark 執行）：

- `kubectl apply -k cgu/groupshare`、`kubectl apply -k cgu/namespace_share`。webhook 憑證未重簽、caBundle 未中斷，server dry-run 建立 Notebook 正常。
- controller 已標記 `d000018238` 的 6 個舊 Notebook 需重啟（缺 `aid002-a3463`、多 `a2615`）。

尚未完成：後端映像推送與換版（這台 root 登入的 Docker Hub 帳號 `wycca1` 沒有 `cguaicadmin` 的推送權限）。

## 要執行的指令

### 1. 推後端映像（一次即可，.6 與其他環境共用）

映像已在 gpunode040 的 docker 建好。用有 `cguaicadmin` 權限的帳號：

```bash
sudo -i
docker login -u cguaicadmin
docker push docker.io/cguaicadmin/ldap_backend:v2610121415
```

在其他機器重建（結果相同）：

```bash
git clone -b groupshare-deploy-fix-20261012 https://github.com/lance-cl-lu/AI_Centre_Admin.git
cd AI_Centre_Admin/AI_LDAP_admin
docker build -f Dockerfile.groupshare-overlay -t docker.io/cguaicadmin/ldap_backend:v2610121415 .
docker push docker.io/cguaicadmin/ldap_backend:v2610121415
```

### 2. .6 後端換版（管理平台約停 1 分鐘，Notebook 不受影響）

後端 SQLite 放在 NFS 上，RollingUpdate 會讓新舊 Pod 同時寫同一個資料庫，所以先縮到 0 再換：

```bash
sudo -i
kubectl -n ldap scale deploy/backend-deployment --replicas=0
kubectl -n ldap wait --for=delete pod -l app=backend --timeout=180s
kubectl -n ldap set image deploy/backend-deployment backend=docker.io/cguaicadmin/ldap_backend:v2610121415
kubectl -n ldap scale deploy/backend-deployment --replicas=1
kubectl -n ldap rollout status deploy/backend-deployment --timeout=300s
```

驗證（啟動 60 秒後第一次對帳）：

```bash
kubectl -n ldap exec deploy/backend-deployment -- python manage.py reconcile_groupshare --dry-run
kubectl -n ldap logs deploy/backend-deployment | grep groupshare-reconcile
```

預期第一輪修正 17 個 Profile（移除 DB 已不存在的群組 `徐永真_AID003_3464`、`A2615 深度學習應用`、`楊智淵_AIM128-A2612 進階電腦視覺`，補上 `Generative_AI` 等）並建立 `test103` 目錄；`d000018231`、`kjlin`、`kubeflow-user-example-com` 在 DB 沒有使用者，維持不動。之後應為 `changes=0`。

回復：`kubectl -n ldap set image deploy/backend-deployment backend=docker.io/cguaicadmin/ldap_backend:v0.3.01`（同樣先縮到 0）。

### 3. .6 的 cgu-manifests 合併 branch

GroupShare 已套用，合併只是讓 repo 與線上一致：

```bash
cd /home/lance/work/cgu-manifests
git fetch origin
git merge origin/groupshare-deploy-fix-20261012
kubectl diff -k cgu/groupshare; kubectl diff -k cgu/namespace_share    # 應無差異
```

**不要只為了 GroupShare 在 .6 跑整個 `apply.sh`**：它會刪除重建 `istio-ingressgateway`，全體使用者會短暫斷線。

### 4. 10.100.1.4（新環境）

新安裝或重新部署走原本流程即可：

```bash
cd <cgu-manifests>
git fetch origin && git merge origin/groupshare-deploy-fix-20261012
cp env.ini.4 env.ini
./apply.sh
```

若 10.100.1.4 已經部署過、只想更新 GroupShare（不重跑整個 `apply.sh`）：

```bash
cd <cgu-manifests>                      # 工作目錄內的環境檔已由上次 apply.sh 寫入 .4 的值
git fetch origin && git merge origin/groupshare-deploy-fix-20261012
source env.ini
QNAP_IP="$QNAP_IP" QNAP_MOUNT="$QNAP_MOUNT" bash cgu/groupshare/scripts/bootstrap.sh nfs
bash cgu/groupshare/scripts/bootstrap.sh secrets
# 舊部署的 VWC last-applied 含 caBundle: ""，先只更新 last-applied，避免 apply 清空信任
kubectl kustomize cgu/groupshare | python3 -c 'import sys,yaml; [print("---\n"+yaml.safe_dump(d)) for d in yaml.safe_load_all(sys.stdin) if d and d["kind"]=="ValidatingWebhookConfiguration"]' | kubectl apply set-last-applied -f -
kubectl diff -k cgu/groupshare; kubectl diff -k cgu/namespace_share    # 確認 NFS 值是 .4 的
kubectl apply -k cgu/groupshare && kubectl apply -k cgu/namespace_share
bash cgu/groupshare/scripts/bootstrap.sh webhook
bash cgu/groupshare/scripts/check.sh env.ini
```

然後依步驟 2 換後端映像（10.100.1.4 的 deployment 名稱相同）。

`check.sh` 重點：第 1 段 NFS ConfigMap 是 `10.100.100.31` / `/AIC_K8s/shared`；第 3 段 `caBundle` 長度大於 0、`inject-ca-from` 為空；第 5 段沒有 `!!`。

## 注意

- 新環境 NFS export 要允許 master（`bootstrap.sh nfs` 在 master 上掛載），master 需安裝 `nfs-common`。
- 舊 Notebook 不會自動換掛載，使用者重啟 Notebook 即生效；`check.sh` 第 6 段列出需重啟的 Pod。
- 程式與部署設定的說明：`cgu/groupshare/README.md`；憑證維護：`cgu/groupshare/docs/certificate-maintenance.md`。
