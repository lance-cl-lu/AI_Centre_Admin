# GroupShare 修正進度報告（給資深工程師）

日期：2026-03-15（Asia/Taipei）

## 1) 這次完成的事
- 已部署 backend 新版：`docker.io/cguaicadmin/ldap_backend:v0.2.40`。
- 已重啟 `ldap/backend-deployment` 並確認 rollout 完成（`1 updated / 1 ready`）。
- 已執行一次性 backfill，補齊所有既有 Profile 的 `group/manager` annotation。
- 已補齊即時同步：`add_user_to_lab`、`remove_user_from_lab`、`remove_multiple_user_from_lab` 成功後會立即刷新 Profile annotation。
- 已把部署檔同步：`full-stack-deployment.yaml` image 更新為 `v0.2.40`。

## 2) 為什麼一定要重部署 backend
- GroupShare controller 只會讀 `Profile.metadata.annotations.group/manager`，不會自己去 Account Manager DB 算群組。
- 真正把 `group/manager` 寫進 Profile 的邏輯在 backend：
  - `build_groupshare_annotations()`：`api/views.py:365`
  - `create_profile()`：`api/views.py:410`
  - `replace_profile_user()`：`api/views.py:572`
- 如果不重部署，叢集仍跑舊版 `v0.2.38`，annotation 會維持舊行為（`manager=user/manager` 字串），controller 仍會報 ignored。

## 3) 後端程式變更重點（已上線）
- 新增 helper：用 DB 真實資料算 annotation
  - `group` = 使用者實際所屬群組（排除 `root`）。
  - `manager` = `group` 與 `UserDetail.permission=1` 的交集。
- `create_profile()` 寫入
  - `group`, `manager`（新欄位語意）
  - `manager-role`（保留舊角色字串相容）
- `replace_profile_user()` 改為 update annotation（不整包覆蓋），並同步 `group/manager`。
- 新增 `sync_profile_groupshare_annotations()`（`api/views.py:605`）：
  - 專門在「群組成員異動」後，立即重算並回寫 `group/manager`。
  - 先用 email 找 Profile，找不到則 fallback 用 username 當 profile 名稱。

## 4) 一次性 backfill 結果
- backfill 前：`profiles=79 non_empty_group=0 non_empty_manager=78`
- backfill 後：`profiles=79 non_empty_group=77 non_empty_manager=18`
- 實際更新：`profiles_total=79 updated=78 unchanged=1 user_not_found=2`

### 具體例子（已驗證）
- `a001`：`group='test001'`, `manager=''`
- `a004`：`group='test001'`, `manager='test001'`（同群組管理者）
- `lance2`：`group='AIG'`, `manager='AIG'`
- `aictest001`：`group='TRASH,test002,test003,test004,test005,test006,test007'`, `manager=''`

### 你關心的「找不到」清單
- 找不到對應 Account Manager 使用者（`user_not_found=2`）：
  - `aictest0031`（owner email 也是對不到 DB）
  - `kubeflow-user-example-com`（owner `user@example.com` 對不到 DB）
- Profile 指向不存在 namespace：`0` 筆（全部 namespace 都存在）
- Profile annotation 內含 DB 不存在群組：`0` 筆
- `manager` 不在同 profile 的 `group` 內：`0` 筆

## 5) 新增 group/manager 現在會不會被偵測到
結論：會，但要看你走哪條 Account Manager API 路徑。

### 會自動生效的路徑
- 新增帳號（`adduser`）：
  - `api/views.py:1034` 呼叫 `create_profile()`。
  - 當下就把新 `group/manager` 寫進 Profile annotation
  - controller 每 20 秒輪詢一次 Profile（`groupshare/controller/app.py:27`, `:188-200`）
  - 讀到 annotation 改變就更新 PodDefault（`app.py:126-187`）

- 編輯使用者資訊/權限（`change_user_info`）：
  - `api/views.py:1343` -> `replace_profile_user()`
  - 會重算 `group/manager` 後寫回 Profile
  - controller 之後會同步到 PodDefault

- 群組加人（`add_user_to_lab`）：
  - `api/views.py:1630` 成功後呼叫 `sync_profile_groupshare_annotations()`
  - `group/manager` 會即時更新到 Profile annotation

- 群組移除單一使用者（`remove_user_from_lab`）：
  - `api/views.py:1956` 在使用者尚有其他群組時，會呼叫 `sync_profile_groupshare_annotations()`
  - 若該使用者已無群組，走既有 `deleteUserModel()`（刪 user/profile）

- 群組批次移除使用者（`remove_multiple_user_from_lab`）：
  - `api/views.py:2030` 逐一移除後，對仍保留帳號者呼叫 `sync_profile_groupshare_annotations()`

### 目前仍要注意的邊界
- 這次重點補的是「群組成員異動 API」即時同步，不是背景排程掃 DB。
- 若有其他未走到上述 API 的資料修補動作，仍建議執行一次 backfill 作保險。

## 6) Controller 端驗證重點
- manager/group 解析邏輯：
  - `parse_csv_list()`、`intersect_groups()` 在 `groupshare/controller/parser.py:5-31`
- 舊錯誤來源是 `manager` 用 `user/manager` 字串，`intersect_groups()` 會判定不在 group 內並 warning。
- backfill 後近期 log 已觀察到持續 `Synced Profile ... no changes`，且近 10 分鐘 warning 計數為 0。

## 7) 部署與驗證指令（本次實際使用）
```bash
docker build -t cguaicadmin/ldap_backend:v0.2.40 .
docker push cguaicadmin/ldap_backend:v0.2.40
kubectl set image deployment/backend-deployment backend=docker.io/cguaicadmin/ldap_backend:v0.2.40 -n ldap
kubectl rollout restart deployment/backend-deployment -n ldap
kubectl rollout status deployment/backend-deployment -n ldap --timeout=300s
kubectl get profiles -o json
kubectl logs -n kubeflow deploy/groupshare-controller -c controller --since=10m
```

## 8) 第二階段驗證（本次新增）
- 程式部署後，已在 Pod 內確認新 helper 與呼叫點存在：
  - `grep -n 'sync_profile_groupshare_annotations' /code/api/views.py`
  - 命中 `def` 與 4 個呼叫點（add/remove 相關）
- controller 近 5 分鐘 warning 計數：`0`

## 9) 回滾方式（必要時）
```bash
kubectl set image deployment/backend-deployment backend=docker.io/cguaicadmin/ldap_backend:v0.2.39 -n ldap
kubectl rollout status deployment/backend-deployment -n ldap --timeout=300s
```
