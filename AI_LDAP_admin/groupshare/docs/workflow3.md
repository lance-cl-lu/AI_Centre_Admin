# GroupShare 端到端工作流（完整版）

最後更新：2026-03-15（Asia/Taipei）

這份文件描述「從 Account Manager 操作，到 Notebook 最終掛載成功」的完整資料流，給新工程師快速接手用。

## 1) 系統角色與責任

1. Account Manager backend（`AI_LDAP_admin/api/views.py`）
- 管理使用者、群組、權限（Django DB + LDAP）
- 寫入/更新 Kubeflow Profile annotation

2. GroupShare Controller（`groupshare/controller/app.py`）
- 週期掃描所有 Profile（預設每 20 秒）
- 依 annotation 生成或更新 `PodDefault/groupshare`

3. GroupShare Validating Webhook（`groupshare/webhook/app.py` + `rules.py`）
- 攔截 Notebook CREATE/UPDATE
- 驗證 NFS volume/path/server 與 RW 權限是否合法

## 2) annotation 欄位定義（現行）

- `group`: 該使用者可見群組清單（CSV）
- `manager`: 角色字串（`user` 或 `manager`）
- `manager-group`: 該使用者可 RW 的群組清單（CSV）

補充：
- Controller 讀管理群組時優先 `manager-group`，若缺值才 fallback 舊資料 `manager`（且 `manager` 不是 `user/manager` 時才當群組）。

## 3) 情境 A: 新增一位新使用者（`adduser`）

入口：`POST /api/ldap/user/add/` -> `adduser()`。

### 3.1 backend 內部流程

1. 驗證唯一性
- 檢查 Profile owner email 是否已存在（`check_email`）
- 檢查 Django `username` / `email` 是否重複
- LDAP 若有同名舊 entry 會先刪除

2. 寫 Django 與群組
- 建立 `User`
- `user.groups.add(lab)`
- 建立 `UserDetail`：
  - lab manager -> `permission=1`
  - 一般成員 -> `permission=2`

3. 寫 LDAP
- 建立 user entry
- 把 user 加入該 lab 的 `memberUid`

4. 建立 Profile（`create_profile()`）
- 呼叫 `build_groupshare_annotations()` 產生：
  - `group`（使用者所有非 root 群組）
  - `manager-group`（群組中 permission=1 的子集合）
- 呼叫 `resolve_manager_role()` 產生 `manager`（`user/manager`）
- 寫入 Profile `metadata.annotations`：
  - `group`, `manager`, `manager-group`, `cpu`, `gpu`, `memory`
- 同步 Profile `resourceQuotaSpec.hard`

### 3.2 這一步完成後的狀態

1. Django：`User`、`UserDetail`、`UserGPUQuotaType` 已建立。
2. LDAP：user entry 與 group membership 已存在。
3. Kubeflow：Profile 已建立且帶三個 Groupshare annotation。
4. 但 Notebook 掛載規則還要等 Controller 下一輪同步（最多約一個 `POLL_SECONDS` 週期）。

## 4) 情境 B: 既有使用者加入/移出群組

### 4.1 加入群組（`add_user_to_lab`）

入口：`POST /api/ldap/lab/insert/` -> `add_user_to_lab()`。

1. 寫 `UserDetail`（admin=1 或 user=2）
2. `user.groups.add(lab)`
3. 呼叫 `sync_profile_groupshare_annotations(user_obj)`
4. `sync_profile_groupshare_annotations()` 會重算並回寫：
- `group`
- `manager-group`
- `manager`（強制正規化為 `user/manager`）

### 4.2 移出群組（`remove_user_from_lab` / `remove_multiple_user_from_lab`）

1. 移除 Django 群組與 `UserDetail`
2. 若使用者已無任何群組，走 `deleteUserModel()`（使用者資源刪除路徑）
3. 若還有其他群組，呼叫 `sync_profile_groupshare_annotations()`，把 Profile annotation 同步到最新

## 5) 情境 C: 編輯使用者資訊與權限（`change_user_info`）

入口：`POST /api/user/change/` -> `change_user_info()`。

1. 先更新 LDAP 的姓名/信箱
2. 更新 Django `User`
3. 更新 Profile quota（`replace_profile`）
4. 逐群組更新 permission（`UserDetail`）
5. 每次迴圈呼叫 `replace_profile_user()`，會把下列 annotation 一併更新：
- `group`
- `manager`
- `manager-group`
- `cpu/gpu/memory`

## 6) Controller 怎麼把 Profile 轉成掛載規則

入口：`GroupshareController.run()` 每 20 秒掃一次 Profile。

1. 讀 `Profile.metadata.annotations`
- `groups_raw = annotations["group"]`
- `managers_raw = parse_manager_groups(annotations)`

2. 做權限交集
- `admin_groups = intersect(groups, managers)`，只允許「在 group 清單內」的管理群組生效

3. 產生 `PodDefault/groupshare`
- volume 名稱：`gs-<sanitize(group)>`
- 掛載點：`/mnt/groups/<sanitize(group)>`
- NFS 實體路徑：`<NFS_PATH>/<sanitize(group)>`（例如 `/kflow_dev/shared/marktest`）
- 非 admin 群組：`readOnly=true`
- admin 群組：`readOnly=false`

4. 寫入 PodDefault annotation（給 webhook 用）
- `groupshare.kubeflow.org/nfs-server`
- `groupshare.kubeflow.org/allowed-volumes`
- `groupshare.kubeflow.org/admin-groups`
- `groupshare.kubeflow.org/allowed-paths`
- `groupshare.kubeflow.org/hash`

5. 若 hash 沒變，controller 會略過 patch（避免無效更新）。

## 7) Webhook 怎麼決定 Notebook 放行或拒絕

入口：Notebook `CREATE/UPDATE` -> `/validate`。

1. 讀 namespace 的 `PodDefault/groupshare` annotation 當 policy。
2. 套 Rule A/B/C：
- Rule A: 禁止直接使用 `/group*` 路徑
- Rule B: server、volume name、path 必須在白名單
- Rule C: 非 admin 不可把 volume 或 volumeMount 改成 RW

3. 任一規則不符就 deny（admission reject）。

## 8) 最終「成功」會長怎樣

### 8.1 Profile annotation（範例）

```yaml
metadata:
  annotations:
    group: "lab-a,lab-b"
    manager: "manager"
    manager-group: "lab-a"
```

### 8.2 PodDefault（範例重點）

```yaml
metadata:
  name: groupshare
  annotations:
    groupshare.kubeflow.org/allowed-volumes: "gs-lab-a,gs-lab-b"
    groupshare.kubeflow.org/admin-groups: "gs-lab-a"
spec:
  selector: {}
```

### 8.3 Notebook 行為（範例）

1. Notebook 不需要額外選 Configurations 或 label
2. Notebook 最終會有 `/mnt/groups/lab-a`、`/mnt/groups/lab-b` 掛載
3. `lab-a` 可 RW，`lab-b` 會是 RO（依 `manager-group` 決定）

## 9) 交接時最重要的檢查點

1. backend API 有沒有真的更新 Profile annotation（看 `kubectl get profile <name> -o yaml`）
2. controller 有沒有把新 annotation 轉成 PodDefault（看 controller log 與 PodDefault YAML）
3. webhook 是否依 PodDefault 規則拒絕非法 Notebook（看 webhook log）
4. Notebook 實際掛載權限是否符合預期（RO/RW）

## 10) 部署/回滾流程

部署與回滾指令請搭配：
- `docs/workflow.md`（維運版）
- `groupshare/README.md`

目前 backend 叢集基準 image（2026-03-15）：
- `docker.io/cguaicadmin/ldap_backend:v0.2.41`
