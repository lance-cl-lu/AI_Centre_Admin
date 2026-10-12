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
  - `bootstrap.sh vwc`：從舊版升級時，先只更新 VWC 的 last-applied 並移除舊的 `inject-ca-from`，讓接下來的 apply 不會清空 caBundle（舊版 last-applied 含 `caBundle: ""`，第一次 apply 會刪掉已注入的 CA，所有 Notebook 建立／修改被擋）。已升級過的叢集不做任何事。
  - `bootstrap.sh webhook`：等憑證、webhook 與 caBundle 就緒；有 Prometheus Operator 時套用監測。
  - `check.sh`：部署後唯讀檢查。
- `apply.sh`：kustomize 前執行 `bootstrap.sh nfs`、`secrets`、`vwc`，任一失敗就在刪除 ingress、套用資源之前停止（exit 1）；恢復 ingress 後執行 `bootstrap.sh webhook`，最後執行 `check.sh`，webhook 未就緒時整個 `apply.sh` 回傳 1。各步驟都可重複執行，已存在的物件不會被覆蓋。
- `example/kustomization.yaml`：後端映像改為 `docker.io/cguaicadmin/ldap_backend:v2610121415`（**先推映像再 apply**，見下方）。

### Controller（AI_Centre_Admin `groupshare/controller`、`namespace_share/controller`）

- NFS 設定以 `apply.sh` 寫入的 ConfigMap 為準；provisioner Deployment 只是備用來源。原本找不到 `QNAP_NFS_DEPLOYMENT` 時 controller 會直接 crash。
- 設定每輪重新讀取，不再只在啟動時讀。
- 群組目錄／volume 名稱規則修正（後端、controller、webhook 三處一致）：原規則只保留 `a-z0-9-`，中文會被丟掉，`馬誠佑_lab`、`楊智淵_lab` 等都變成 `lab`（不同實驗室共用同一個資料夾），`王佑中教授實驗室` 變成空字串（沒有資料夾）。新規則：純英文名稱不變；含中文等非 ASCII 字元的名稱在後面加上完整名稱的 8 碼 hash，例如 `lab-7a249574`、`g-c4be5913`。管理平台新增群組或 Excel 匯入時，若名稱會對應到既有群組的資料夾（例如 `Lab_A` 與 `lab-a`）會拒絕建立。PodDefault 的 hash 包含規則版本，新 controller 上線後會把所有 PodDefault 重寫一次（英文群組內容不變）。
- 新增：比對每個 Notebook Pod 實際的群組掛載與目前 PodDefault，不一致時在 Pod 加 `groupshare.kubeflow.org/restart-required` annotation，並對 Notebook 發 `GroupShareRestartRequired` Event。**不會重啟任何 Pod**；使用者停止再啟動 Notebook 就套用，`/home/jovyan` 不受影響。Kubernetes 無法修改執行中 Pod 的 volume，所以只能提示。

### 後端（AI_Centre_Admin `AI_LDAP_admin/api`）

- `groupshare_reconcile.py`（新）：後端每 600 秒依 Django DB（管理平台看到的群組成員與管理權限）對帳所有 Profile 的 `group` / `manager` / `manager-group` annotation，並建立缺少的群組與 namespace 目錄。順序是先建目錄、再寫 Profile：目錄建不起來的新群組不會寫進 Profile（下一輪重試），避免 Notebook 掛載不存在的目錄。寫入前會重新讀一次 DB，並以列出 Profile 時的 resourceVersion 寫入；期間 DB 或 Profile 若已被管理員更新就跳過，不會把剛改好的群組蓋回舊值。DB 找不到使用者的 Profile 不動。`GROUPSHARE_RECONCILE_INTERVAL_SECONDS=0` 可停用。
- `python manage.py reconcile_groupshare [--dry-run]`（新）：手動執行。
- `views.py`：群組刪除（含到期清理）、使用者停用、批次匯入既有使用者這三處原本沒有同步 Profile，已補上。
- `TRASH` 與 `root` 一樣不產生共享資料夾（`groupshare_storage.GROUPSHARE_EXCLUDED_GROUPS`）。
- 刪除保護（取自測試版 `v2607080741`）：`deleteUserModelPermanent` 只永久刪除「只在 TRASH」的使用者，到期自動刪除（`user_delete_check`）與批次刪除都經過它；批次刪除改成與單筆刪除相同，只在 TRASH 的永久刪除、其他移到 TRASH。`v2607080741` 的批次刪除在第一個永久刪除後就 `return`，其餘使用者沒處理，這裡已修正。`repair_share_directories` 的功能已由對帳涵蓋，沒有移植。另外補上三個防止誤刪的保護：
  - 重送或名單重複：剛移入 TRASH 的人（同一請求內，或 10 分鐘內，`TRASH_PERMANENT_DELETE_GRACE_SECONDS` 可調）不會被單筆／批次刪除永久刪除；過了這段時間再刪才會永久刪除。到期自動刪除不受影響。
  - 並行還原：先在 Profile 加 `ldap-admin/pending-delete` 標記，再在同一個資料庫交易內重新確認「只在 TRASH」並刪除帳號；若另一個請求剛把人加回群組就中止並拿掉標記。
  - Profile 刪除失敗：帳號刪除後若 Profile 刪除失敗，標記會留著，後端每輪對帳自動重試。只刪「有標記且 DB 已無此帳號」的 Profile，沒有標記的（例如 `kubeflow-user-example-com`）不會被動到。
- Excel 匯入（`excel()`、`import_lab_user()`）會先去掉 username 與 email 前後空白；之前曾因此建出 ` b1128014` 這類帳號，與 LDAP、Profile 對不上。已存在的這類帳號不會被改動。
- `views.py` 第 1099 行：repo 版本把 `else:` 註解掉，會讓群組成員清單只列出 LDAP 找不到的人；已改回與線上一致。
- `api/migrations/0006_groupdefaultquota_gpu_vendor.py`：線上容器啟動時自動產生、但 repo 沒有的 migration，已補上。
- `Dockerfile.groupshare-overlay`：以線上 `v0.3.01` 為基底只覆蓋上述 Python 檔，前端與套件完全不變。

測試：GroupShare 46 項、NamespaceShare 6 項、後端 26 項全部通過。

## .6（gpunode040）目前狀態

已完成（2026-10-12 由 Mark 執行）：

- `kubectl apply -k cgu/groupshare`、`kubectl apply -k cgu/namespace_share`。webhook 憑證未重簽、caBundle 未中斷，server dry-run 建立 Notebook 正常。
- controller 已標記 `d000018238` 的 6 個舊 Notebook 需重啟（缺 `aid002-a3463`、多 `a2615`）。

.6 線上的 controller 是命名規則修正**之前**的版本；branch 最新版要照下面步驟 2、3 的順序更新。.6 有 4 個含中文的群組會換目錄：`ai1029-a347n`、`aid002-a3463`、`hojjat-ai3026-a2629-2026-01-27-2027-01-02`、`lab`（`王佑中lab`）。2026-10-12 檢查時這 4 個舊目錄都是空的。

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

**.6 要先換後端、再更新 controller（步驟 3）**：後端第一次對帳會先用新規則建好群組目錄；若先換 controller，PodDefault 會立刻指向還不存在的新目錄，這 4 個群組的成員新開 Notebook 會卡在掛載，直到後端換版。

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

確認新目錄已建立（例如 `lab-6179d8fd`、`aid002-a3463-7ef7d056`）：

```bash
kubectl -n ldap exec deploy/backend-deployment -- ls /mnt/groupshare
```

預期第一輪修正 17 個 Profile（移除 DB 已不存在的群組 `徐永真_AID003_3464`、`A2615 深度學習應用`、`楊智淵_AIM128-A2612 進階電腦視覺`，補上 `Generative_AI` 等）並建立 `test103` 目錄；`d000018231`、`kjlin`、`kubeflow-user-example-com` 在 DB 沒有使用者，維持不動。之後應為 `changes=0`。

回復：`kubectl -n ldap set image deploy/backend-deployment backend=docker.io/cguaicadmin/ldap_backend:v0.3.01`（同樣先縮到 0）。

### 3. .6 的 cgu-manifests 合併 branch 並更新 controller / webhook（步驟 2 完成後）

```bash
cd /home/lance/work/cgu-manifests
git fetch origin
git merge origin/groupshare-deploy-fix-20261012
kubectl diff -k cgu/groupshare; kubectl diff -k cgu/namespace_share    # 只應有 runtime ConfigMap 名稱變更
kubectl apply -k cgu/groupshare && kubectl apply -k cgu/namespace_share
bash cgu/groupshare/scripts/check.sh env.ini
```

controller 換版後，掛著舊目錄的 Notebook 會被標記需重啟（`check.sh` 第 6 段）。等這些 Notebook 都重啟過，確認 4 個舊目錄仍是空的再刪除；若使用者在重啟前寫了檔案，搬到對應的新目錄。

**不要只為了 GroupShare 在 .6 跑整個 `apply.sh`**：它會刪除重建 `istio-ingressgateway`，全體使用者會短暫斷線。

### 4. 10.100.1.4（新環境）

新安裝或重新部署走原本流程即可：

```bash
cd <cgu-manifests>
git fetch origin && git merge origin/groupshare-deploy-fix-20261012
cp env.ini.4 env.ini
./apply.sh
```

**10.100.1.4 要先更新 controller、再換後端**（與 .6 相反）：.4 的 Profile 目前都沒有群組 annotation；若先換後端，對帳會寫入群組，而舊版 controller 仍用舊規則，`馬誠佑_lab`、`楊智淵_lab`、`張賢宗_lab`、`林英嘉_lab` 會掛到同一個 `lab` 資料夾。`./apply.sh` 會同時更新兩者，順序沒有問題。

若 10.100.1.4 已經部署過、只想更新 GroupShare（不重跑整個 `apply.sh`）：

```bash
cd <cgu-manifests>                      # 工作目錄內的環境檔已由上次 apply.sh 寫入 .4 的值
git fetch origin && git merge origin/groupshare-deploy-fix-20261012
source env.ini
QNAP_IP="$QNAP_IP" QNAP_MOUNT="$QNAP_MOUNT" bash cgu/groupshare/scripts/bootstrap.sh nfs
bash cgu/groupshare/scripts/bootstrap.sh secrets
bash cgu/groupshare/scripts/bootstrap.sh vwc     # 舊部署第一次升級：保留已注入的 caBundle
kubectl diff -k cgu/groupshare; kubectl diff -k cgu/namespace_share    # 確認 NFS 值是 .4 的
kubectl apply -k cgu/groupshare && kubectl apply -k cgu/namespace_share
bash cgu/groupshare/scripts/bootstrap.sh webhook
bash cgu/groupshare/scripts/check.sh env.ini
```

然後依步驟 2 換後端映像（10.100.1.4 的 deployment 名稱相同）。第一次對帳會同步全部 Profile 的群組並建立群組目錄。

舊版部署留下的範例 Notebook 可以刪除（新版已移除）：

```bash
kubectl -n kubeflow-user-example-com delete notebook default-template-groupshare
```

GroupShare / NamespaceShare 在 10.100.1.4 使用 `10.100.100.31`（`env.ini.4` 已是這個值，維持不變）；NFS provisioner 的 `10.100.1.31` 不受影響。

`check.sh` 重點：第 1 段 NFS ConfigMap 是 `10.100.100.31` / `/AIC_K8s/shared`；第 3 段 `caBundle` 長度大於 0、`inject-ca-from` 為空；第 5 段沒有 `!!`。

## 注意

- 新環境 NFS export 要允許 master（`bootstrap.sh nfs` 在 master 上掛載），master 需安裝 `nfs-common`。
- 舊 Notebook 不會自動換掛載，使用者重啟 Notebook 即生效；`check.sh` 第 6 段列出需重啟的 Pod。
- 程式與部署設定的說明：`cgu/groupshare/README.md`；憑證維護：`cgu/groupshare/docs/certificate-maintenance.md`。
