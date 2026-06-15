# GroupShare 修正進度報告（二）

日期：2026-03-15（Asia/Taipei）

## 1) 本次工作目的
- 修正先前將 `manager` 當成管理群組清單使用的語意衝突。
- 保留原有業務邏輯：`manager` 只能是角色（`user` / `manager`）。
- 將管理群組權限正式遷移到 `manager-group`，並確保部署與文件一致。

## 2) 本次實作內容
- backend（`api/views.py`）
  - `create_profile()`：
    - `manager` 寫回角色值
    - `manager-group` 寫入管理群組清單
  - `replace_profile_user()`：
    - `manager` 更新角色值
    - `manager-group` 更新管理群組清單
  - `sync_profile_groupshare_annotations()`：
    - 僅同步 `group` + `manager-group`
    - 不覆寫 `manager` 角色欄位
  - 新增 `get_manager_groups_from_annotations()`：
    - 讀取順序 `manager-group` -> legacy `manager`
    - 若值為 `user/manager` 則視為角色，不當作群組

- controller（`groupshare/controller`）
  - `app.py` 改為透過 `parse_manager_groups()` 取得管理群組
  - `parser.py` 新增 `parse_manager_groups()` 與 `ROLE_MARKERS`

- deploy（`groupshare/deploy/controller-code-configmap.yaml`）
  - 已同步為與 `groupshare/controller/app.py`、`groupshare/controller/parser.py` 完全一致

- tests（`groupshare/tests/controller/test_parser.py`）
  - 新增 4 組測試：
    - 優先讀 `manager-group`
    - fallback legacy `manager`
    - 忽略角色字串 `manager`

- docs
  - `groupshare/README.md`
  - `groupshare/docs/profile-annotation-spec.md`
  - `groupshare/docs/test-cases.md`
  - `groupshare/docs/workflow.md`（保留舊內容，僅在開頭補本次摘要）

## 3) 欄位定義（定案）
- `group`: 使用者所屬群組清單（CSV）
- `manager`: 角色欄位（`user` / `manager`）
- `manager-group`: 可 RW 的管理群組清單（CSV）

## 4) 成效
- 避免破壞既有 `manager` 角色判斷邏輯。
- GroupShare 權限解析改為語意清楚的 `manager-group`。
- 兼容歷史資料（legacy `manager`）以降低切換風險。
- 程式碼、部署模板、測試、文件已同步。

## 5) 驗證結果
- `python -m unittest discover -s tests -p 'test_*.py'`：17 tests 全部通過
- `python -m py_compile api/views.py groupshare/controller/app.py groupshare/controller/parser.py`：通過

## 6) 建議上線順序
```bash
kubectl apply -f groupshare/deploy/controller-rbac.yaml
kubectl apply -f groupshare/deploy/controller-configmap.yaml
kubectl apply -f groupshare/deploy/controller-code-configmap.yaml
kubectl apply -f groupshare/deploy/controller-deployment.yaml
kubectl apply -f groupshare/deploy/webhook-rbac.yaml
kubectl apply -f groupshare/deploy/webhook-code-configmap.yaml
kubectl apply -f groupshare/deploy/webhook-certificate.yaml
kubectl apply -f groupshare/deploy/webhook-deployment.yaml
kubectl apply -f groupshare/deploy/webhook-service.yaml
kubectl apply -f groupshare/deploy/validating-webhook-configuration.yaml
```
