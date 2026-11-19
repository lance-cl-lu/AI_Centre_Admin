# 後端與計費 monitor 整合交接（2026-11-20）

給：負責 cgu-manifests 與 .4 / .6 部署的人。

## 一句話

後端換成一個同時包含 GroupShare 修正、改 email 修正、費率小數位修正的新 image；計費 monitor 只留 v71，拿掉會 crash 的 v53。**.4 與 .6 都已在 2026-11-20 部署並檢查完畢。** 你要做的是把兩個 repo 的修改合進 `cgu-2.0-2026H3-Lance`，之後從你的 checkout 重跑 `apply.sh` 才不會把這次的修改蓋回去。

## 你要做的事

1. **AI_Centre_Admin**（原始碼）：把 branch `integration-20261120` 合進 `cgu-2.0-2026H3-Lance`。它直接接在你的 branch 後面，可以 fast-forward：

   ```bash
   cd <AI_Centre_Admin>
   git fetch origin
   git checkout cgu-2.0-2026H3-Lance
   git merge --ff-only origin/integration-20261120
   git push origin cgu-2.0-2026H3-Lance
   ```

2. **cgu-manifests**（部署設定）：修改以 patch 檔放在 AI_Centre_Admin 的 `deploy/cgu-manifests-20261120/`（我們沒有 `wycc/cgu-manifests` 的推送權限）。在你的 cgu-manifests checkout 套用：

   ```bash
   cd <cgu-manifests>                       # 例如 .6 的 /home/lance/work/cgu-manifests
   git checkout cgu-2.0-2026H3-Lance
   git status                               # 本機改過的 6 個環境檔不受影響，patch 沒碰它們
   git am <AI_Centre_Admin>/deploy/cgu-manifests-20261120/*.patch
   git push origin cgu-2.0-2026H3-Lance
   ```

   19 個 patch 依序是：10/12 的 GroupShare 修正（原本在 `groupshare-deploy-fix-20261012`，從未合併）、v71 monitor 部署、這次的修改。全部以 `cgu-2.0-2026H3-Lance`（`fab6a2b8`）為基底。

3. **在這兩件事完成前，不要在 .4 / .6 用舊的 checkout 跑 `apply.sh`**：它會把後端 image 換回 `v2610121415`、重新裝回 v53、拿掉後端新加的權限（改 email 會失敗）。

## 為什麼有兩個 repo

- **AI_Centre_Admin 是原始碼**（Django 後端、React 前端、GroupShare / NamespaceShare 程式），後端 image 從這裡建置。
- **cgu-manifests 是整個平台的部署設定**（kustomize、`apply.sh`），只寫要用哪個 image tag。它是整套 Kubeflow 的安裝設定，不適合併進 AI_Centre_Admin。
- GroupShare / NamespaceShare 的程式兩邊都有：以 AI_Centre_Admin 為準，用 `AI_LDAP_admin/groupshare/scripts/export-to-cgu-manifests.sh` 同步；這次兩邊一致。

## 位置

| 項目 | 位置 |
|---|---|
| 後端原始碼 | `lance-cl-lu/AI_Centre_Admin` branch `integration-20261120` |
| 部署設定的修改 | 同一個 branch 的 `deploy/cgu-manifests-20261120/*.patch`（套用後即為 cgu-manifests 的內容） |
| 後端 image | `docker.io/cguaicadmin/ldap_backend:v2611200123`（AI_Centre_Admin `00db3d7`，完整 Dockerfile，含前端） |

**不要用 `v2611200046`**：那版缺 namespace owner 修正，改 email 後 profile controller 會停止處理該使用者。11/11–11/12 的 `v26111x` 三個 tag 也不要用：它們是從 `cgu-2.0-2026H3-Lance` 加未提交修改建置的，沒有 GroupShare 修正。

### 改了哪些檔案

AI_Centre_Admin：

| 檔案 | 內容 |
|---|---|
| `AI_LDAP_admin/api/groupshare_reconcile.py`、`AI_LDAP_admin/api/management/commands/reconcile_groupshare.py` | GroupShare 依 DB 對帳 |
| `AI_LDAP_admin/api/views.py`：`update_profile_owner_email()`、`change_user_info()` | 改 email 同步 Profile owner、namespace `owner`、namespaceAdmin |
| `AI_LDAP_admin/cluster-role.yaml` | 後端權限 |
| `frontend/src/components/Home.js` | 費率可輸入 5 位以上小數 |
| `frontend/src/api/prometheus.js` | 首頁拿掉「舊版」資料來源 |
| `AI_LDAP_admin/groupshare/`、`AI_LDAP_admin/namespace_share/` | GroupShare / NamespaceShare controller 與 webhook 原始碼 |
| `deploy/cgu-manifests-20261120/` | cgu-manifests 的 patch 與本文件 |

cgu-manifests（套用 patch 後）：

| 檔案 | 內容 |
|---|---|
| `example/kustomization.yaml` | 後端 image `v2611200123` |
| `common/dex/overlays/ldap-backend/cluster-role.yaml` | 後端權限，與 AI_Centre_Admin 那份相同 |
| `cgu/monitor/kustomization.yaml`、`cgu/monitor/v71/` | 只留 v71；說明在 `cgu/monitor/v71/README.md` |
| `cgu/groupshare/`、`cgu/namespace_share/`、`apply.sh`、`preserve_live_state.py` | 10/12 的 GroupShare 修正 |
| `docs/handoff-20261120.md` | 本文件 |

`cgu-2.0-2026H3-Lance` 原有的 `repair_share_directories` 與群組成員清單修正都保留。

## 內容

### 後端

- **GroupShare 修正**（10/12 起 .4、.6 上的 `v2610121415` 就是這些）：依 DB 對帳 Profile 群組、中文群組資料夾加 hash、TRASH 防誤刪、Excel 匯入去空白。說明見 `AI_LDAP_admin/groupshare/docs/deploy-handoff-20261012.md`。
- **改 email 時同步 Kubernetes**：原本只改 LDAP / Django，使用者會失去自己 namespace 的權限。現在依序更新 Profile `spec.owner.name`、namespace 的 `owner` annotation、`namespaceAdmin` RoleBinding 的 subject 與 `user` annotation，再改 LDAP / Django。namespace `owner` 一定要跟著改：Kubeflow profile controller 只在它等於 Profile owner 時才處理該 Profile，否則改配額不生效、刪除 Profile 會卡在 finalizer。中途失敗可重試。
- **後端 ClusterRole 新增三條**：namespaces `get` / `patch`；`namespaceAdmin` RoleBinding `get` / `update`；ClusterRole `kubeflow-admin` 的 `bind`（Kubernetes 更新 binding 時會檢查越權，後端本身沒有 kubeflow-admin 的權限）。後端仍不能新增 RoleBinding。
- **首頁費率可輸入 5 位以上小數**；拿掉首頁「舊版」資料來源（v53）。

### 計費 monitor

- **v53 移除**：節點上有沒有 tag 的 image 時會 crash（kubernetes 12.0.1），.4、.6 各自用不同手動補丁撐著；費率寫死 2 / 10。首頁、fair scheduler、Grafana 都只需要 v71（v71 也輸出 Grafana 用的舊指標名稱）。
- **v71 自己的 ServiceMonitor**（原本靠 v53 的被抓取）。
- **累積費用從 Prometheus 接續**：`namespace_*_cost*` 只在記憶體裡，重啟時改讀本叢集 Prometheus 裡 v71 自己過去 30 天的最高值。
- 費率不變：兩個費率 ConfigMap 由 `preserve_live_state.py` 保留線上值（兩台都是 CPU 0.03 / GPU 0.7）。.6 的 v71 程式內建備用費率原本是 2.0 / 10.0，這次一併改為 0.03 / 0.7。
- Grafana 的 notebook 用量圖原本把 v53 與 v71 重複相加，現在數字才正確（約為原本的一半）。

### 測試

後端 32、GroupShare 48、NamespaceShare 6、前端 8、monitor 22，全部通過（後端在 image 內以 Python 3.11 執行）。改 email 另在 .4 以暫時的 Profile 與最小權限實測，再於兩台以線上後端實測。

## 部署紀錄（2026-11-20）

兩台步驟相同，依序：

1. 備份（見「回復」）。
2. `kubectl apply -f common/dex/overlays/ldap-backend/cluster-role.yaml`
3. 後端：縮到 0 → `set image ... ldap_backend:v2611200123` → 回到 1（SQLite 在 NFS 上，避免新舊 Pod 同時寫）。管理平台停約 1–2 分鐘，Notebook 不受影響。
4. monitor：`kustomize build cgu/monitor/v71 | python3 preserve_live_state.py | kubectl apply -f -`
5. 確認 v71 log 出現 `Loaded cost bootstrap for N namespaces` 後，刪除 v53：ServiceMonitor `node-resource-monitor`、Deployment `node-resource-monitor`、Service `prom-app`（.6 另有 `node-resource-monitor`）、ServiceAccount `prom-service-account`、ClusterRole / ClusterRoleBinding `node-access(-binding)`、.4 的 ConfigMap `node-resource-monitor-fix`。

| | .4 | .6 |
|---|---|---|
| 後端換版 | 01:26–01:27 | 01:39–01:41 |
| GroupShare 對帳 | 62 Profile，changes=0 | 159 Profile，changes=0 |
| v71 接續累積費用 | 89 namespace | 178 namespace，套用前後數值相同 |
| v53 刪除 | 01:32 | 01:45 |

## 部署後檢查結果（兩台都通過）

- 管理平台網頁提供新前端（`main.42de90f7.js`），費率欄位可輸入任意小數，沒有「舊版」選項。
- 後端無 Traceback；`reconcile_groupshare --dry-run` 為 `changes=0`。
- 新開 Notebook（.4 `test001`、.6 `mtest`，測完刪除）：Running，Jupyter API 200，workspace 可寫，GroupShare / NamespaceShare 自動掛載且可讀寫。原本執行中的 Notebook 數量不變（.4 4 個、.6 6 個）。
- 改 email（以線上後端、暫時 Profile 測試，測完刪除）：Profile owner、namespace owner、RoleBinding subject 與 annotation 都換成新 email；新 email 有權限、舊 email 沒有；之後改配額有生效；刪除 Profile 正常完成。
- Prometheus：cgu namespace 只剩 `prom-app-v71` 一個 target 且 up；`cgu_monitor_legacy_bootstrap_success = 1`；累積費用持續增加、沒有歸零；recording rule `cgu:namespace_billable_gpu_cards_total` 正常；fair scheduler 正常。
- 已知、與這次無關：兩台的 kube-controller-manager、kube-etcd、kube-proxy、kube-scheduler target 過去 7 天一直是 down（kubeadm 預設只聽 127.0.0.1）。

改 email 的 LDAP / Django 部分沿用原有程式，沒有另外測。第一次在管理介面改真實使用者的 email 後，可用下面確認：

```bash
kubectl get profile <ns> -o jsonpath='{.spec.owner.name}'
kubectl get ns <ns> -o jsonpath='{.metadata.annotations.owner}'
kubectl -n <ns> get rolebinding namespaceAdmin -o jsonpath='{.subjects[*].name} {.metadata.annotations.user}'
```

## 回復

部署前的備份在兩台的 `/home/mark/deploy-20261120/backup/`：

| 檔案 | 內容 |
|---|---|
| `backend-deployment.yaml` | 後端 Deployment（image `v2610121415`） |
| `backend-cluster-role.yaml` | 後端 ClusterRole |
| `v53-objects.yaml` | v53 的所有物件，含兩台各自的手動補丁 |
| `cgu-namespace-all.yaml`、`monitor-cluster*.yaml` | cgu namespace 與 monitor 權限的完整備份 |

- 後端：縮到 0 → image 換回 `docker.io/cguaicadmin/ldap_backend:v2610121415` → 回到 1。ClusterRole 多的規則留著無害。
- v53：`kubectl create -f v53-objects.yaml`（若有衝突，先移除檔內的 `resourceVersion` / `uid`）。v71 回到上一版：`git show f0d59581:cgu/monitor/v71/prom_v2.py` 等，或 `kubectl -n cgu delete servicemonitor node-resource-monitor-v71` 後由 v53 的 ServiceMonitor 抓取。
- 兩台 Prometheus 都沒有 PVC：以上步驟都不會重建 Prometheus；若 Prometheus pod 被重建，計費歷史會消失。

## 這次沒有包含

- PVCViewer `share-fix-20261021`：11/11 會議決定分享連結必須登入且屬於該 namespace，該版本是公開分享，不要合併。
- Pending Pod 計費、MPS slot 以整張卡計費：照現況，未修改。
