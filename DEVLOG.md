# Development Log

## 2026-05-26 — Merge `origin/cgu-2.0-2026H1-Vress0` into `merge/cgu-2.0-2026H3-patten-into-lance`

### Merge Conflict 解決摘要

#### `.gitignore`
- **策略**：保留 HEAD 版本
- HEAD 版本更完整，包含 `AI_LDAP_admin/venv/`、`package-lock.json`、`node_modules/`、`frontend/build_old/` 等規則

#### `frontend/src/components/Home.css`
- **策略**：兩支都保留
- HEAD 新增：`.usage-detail-title`、`.usage-detail-table` 樣式
- 遠端新增：`.live-usage-card`、`.live-usage-grid`、`.live-usage-item`、`.live-usage-cpu/memory/gpu`、`.live-usage-chart` 等即時資源監控 UI 樣式（含 `@media(max-width: 768px)` RWD）

#### `frontend/src/components/Home.js`
- **策略**：兩支都保留，JSX 區塊取遠端版本
- **State 合併**：
  - HEAD 的 `usageLeaders` / `usageLeadersLoading` / `usageLeadersError` / `namespaceMetricService` states 保留
  - 遠端的 `liveUsage` / `liveUsageHistory` / `liveUsageLoading` / `liveUsageError` / `liveUsageAbort` / `liveUsageMockIndex` states 保留
- **Effect / memo 合併**：
  - HEAD 的 `namespaceMetricServiceOption`、欄位標籤常數、`rangeUsageSegments` memo、`usageLeaders` useEffect 保留
  - 遠端的 `loadLiveUsage` useCallback 保留
- **JSX**：取遠端版本，新增即時資源監控 Card（`SparklineCard` 元件）並啟用 Kubeflow 連結 Card（HEAD 版本原本被注解）

#### `frontend/src/components/List/Tree.js`
- **策略**：兩支都保留
- HEAD 修正：箭頭 `onClick` 加入 `e.stopPropagation()` 防止點擊冒泡觸發 `navigate('/lab')`
- 遠端新增：`isExpanded` 考量關鍵字搜尋狀態（有關鍵字時強制展開）
- 合併結果：`onClick={(e) => { e.stopPropagation(); toggleGroup(user.group_dn); }}` + `<ArrowIcon expanded={isExpanded} />`

#### `frontend/src/components/User.js`
- **策略**：保留 HEAD 版本
- HEAD 版本保有 expiry date 功能（日期選擇器、剩餘天數顯示、顏色警示），遠端版本移除了此區塊

---

## 2026-05-26 — K8s API 認證修正（`AI_LDAP_admin/api/views.py`）

### 問題背景
Kubernetes Python client v36+ 將 in-cluster token 存於 `cfg.api_key['authorization']`，
但 `auth_settings()` 只讀 `api_key['BearerToken']`，導致 API 呼叫以 `system:anonymous` 身份送出，回傳 403。

### 修正方式
新增 `_fix_incluster_auth_v36(cfg)` helper，將 `api_key['authorization']` 複製到 `api_key['BearerToken']`。
所有 K8s API 建立改用 per-request `client.Configuration()` 物件，避免 thread 共用全域 config 的問題。

### 修正函式列表
| 函式 | 修正前 | 修正後 |
|------|--------|--------|
| `change_notebooks_metadata` | `config.load_incluster_config()` + `client.CustomObjectsApi()` | `_make_k8s_custom_objects_api_views()` |
| `replace_profile_user` | `client.CustomObjectsApi()` (全域) | `_make_k8s_custom_objects_api_views()` |
| `replace_profile_user_delete_date` | 全域 config block | `_make_k8s_custom_objects_api_views()` |
| `sync_profile_groupshare_annotations` | `client.CustomObjectsApi()` (全域) | `_make_k8s_custom_objects_api_views()` |
| `get_notebook_yaml` | `client.CustomObjectsApi()` + `client.CoreV1Api()` (全域) | 兩者皆改用 per-request helpers |
| `upload_notebook_yaml` | `client.CoreV1Api()` + `client.CustomObjectsApi()` (全域) | 兩者皆改用 per-request helpers |

### 修正前後關鍵差異
```python
# 修正前（有問題）
config.load_incluster_config()  # 寫入全域 config
api = client.CustomObjectsApi()  # 讀全域 config → BearerToken 空白 → 403

# 修正後
api, _ = _make_k8s_custom_objects_api_views()
# 內部：cfg = client.Configuration()
#        config.load_incluster_config(client_configuration=cfg)
#        _fix_incluster_auth_v36(cfg)  # 複製 authorization → BearerToken
#        api_client = client.ApiClient(configuration=cfg)
#        return client.CustomObjectsApi(api_client=api_client)
```
