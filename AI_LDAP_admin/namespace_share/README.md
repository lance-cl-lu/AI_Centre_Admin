# NamespaceShare for Kubeflow

NamespaceShare 的目標：
讓同一個 Kubeflow Profile namespace 底下開出的所有 Notebook，自動共享同一個 namespace 專屬資料夾。

需求：
- 保留原本的 GroupShare
- 另外再提供每個 namespace 一份共用資料夾
- 同 namespace 的多台 Notebook 都要看到同一個 NFS 路徑

## NamespaceShare 在做什麼

1. Controller 讀 Profile，自動產生/更新 PodDefault
- 每個 Profile namespace 一個 `PodDefault/namespace-share`
- selector 沿用 `groupshare=enabled`
- Notebook 只要帶 `groupshare=enabled`，就會同時吃到 GroupShare 與 NamespaceShare
- 掛載點是 `/mnt/namespaces/<namespace>`
- NFS 實體路徑是 `NFS_PATH/<namespace>`，本次設定為 `/kflow_dev/shared/_namespaces/<namespace>`

2. Backend 自動建立 namespace share 目錄
- `api/namespace_share_storage.py` 提供 `ensure_namespace_share_directory()`
- `api/views.py` 在 `create_profile()` 時自動建立 `/kflow_dev/shared/_namespaces/<namespace>`
- 因此新建立的 Profile namespace 會自動有 namespace share 目錄

3. Webhook 做最小相容
- 原本的 GroupShare webhook 會檢查受管 NFS volume
- 因為 NamespaceShare 也是同一類 managed NFS volume，所以 webhook 需要認得 `PodDefault/namespace-share`
- 本次只做最小修改：合併 `groupshare` 與 `namespace-share` 兩份白名單
- NamespaceShare 的 volume 允許 RW
- GroupShare 原本的 admin / non-admin 規則維持不變

4. 既有 namespace backfill
- 既有 Profile namespace 不會因為 backend 更新而自動補歷史資料夾
- 所以本次已針對現有 80 個 Profile namespace 批次 backfill
- 實際結果：`TOTAL=80 / CREATED=78 / EXISTING=2 / ERRORS=0`

## 路徑與權限規則

- NamespaceShare mount path
  - `/mnt/namespaces/<namespace>`

- NamespaceShare NFS path
  - `/kflow_dev/shared/_namespaces/<namespace>`

- 權限
  - NamespaceShare 是 namespace 自己的共用資料夾，預期為 RW
  - GroupShare 是否可寫，仍然由 `manager-group` 決定

## 跟 GroupShare 的關係

這套功能雖然是新資料夾 `namespace_share/`，但不是完全獨立於既有系統之外。

有兩個必要接點：
- `api/`
  - 新增 `namespace_share_storage.py`
  - 在 `views.py:create_profile()` 補一個自動建目錄呼叫
- `groupshare/webhook/`
  - 讓既有 validating webhook 也能接受 `namespace-share` 的 managed NFS volume

也就是說：
- 主體實作放在新資料夾 `namespace_share/`
- 舊的 `groupshare controller` 沒有被重構
- 只有 webhook 做了最小相容修改

## 資料夾說明

- `controller/`
  - `app.py`: NamespaceShare Controller 主程式
  - `parser.py`: namespace sanitize、NFS path、volume name 命名邏輯

- `deploy/`
  - `controller-rbac.yaml`: controller 權限
  - `controller-configmap.yaml`: NamespaceShare 專用 NFS 設定
  - `controller-code-configmap.yaml`: 內嵌 controller 程式碼
  - `controller-deployment.yaml`: controller 部署

- `tests/`
  - `controller/test_parser.py`: sanitize/path/volume name 測試

## 本次實際改到的 repo 區塊

- `namespace_share/`
  - 新增整套 controller / deploy / tests

- `api/`
  - `api/namespace_share_storage.py`
  - `api/views.py`
  - `api/tests.py`

- `groupshare/`
  - `groupshare/webhook/app.py`
  - `groupshare/webhook/rules.py`
  - `groupshare/tests/webhook/test_rules.py`
  - `groupshare/deploy/webhook-code-configmap.yaml`

- backend deployment
  - `full-stack-deployment.yaml`
  - backend image 更新到 `docker.io/cguaicadmin/ldap_backend:v0.2.43`

## 現在的驗證狀態

已完成：
- Python 單元測試通過
- Python 語法編譯檢查通過
- `namespace-share-controller` 已部署上線
- `groupshare-validating-webhook` 已更新
- backend 已 build / push / rollout 到 `v0.2.43`
- 現有 80 個 Profile namespace 已 backfill 完成

已做過的 live 驗證：
- `b1144209`
  - GroupShare: `/mnt/groups/marktest` 唯讀
  - NamespaceShare: `/mnt/namespaces/b1144209` 可寫

- `mark`
  - Profile annotation 為 `group=marktest`、`manager-group=marktest`
  - GroupShare: `/mnt/groups/marktest` 可寫
  - NamespaceShare: `/mnt/namespaces/mark` 可寫
  - 額外用兩台臨時 Notebook 做交叉驗證
    - Notebook A 寫進 GroupShare / NamespaceShare
    - Notebook B 可讀到
    - 再反向由 Notebook B 寫入
    - Notebook A 可讀到

## 快速測試

```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin
python -m unittest api.tests groupshare.tests.webhook.test_rules namespace_share.tests.controller.test_parser
python -m py_compile \
  api/views.py \
  api/tests.py \
  api/namespace_share_storage.py \
  groupshare/webhook/app.py \
  groupshare/webhook/rules.py \
  namespace_share/controller/app.py \
  namespace_share/controller/parser.py \
  namespace_share/tests/controller/test_parser.py
```

Notebook 內可直接這樣測 `namespace_share`：

```bash
pwd
ls -ld /mnt/namespaces/<namespace>
mount | grep /mnt/namespaces/<namespace>
ls -la /mnt/namespaces/<namespace>
df -h /mnt/namespaces/<namespace>
echo namespace-write-test > /mnt/namespaces/<namespace>/ns-write-test.txt
cat /mnt/namespaces/<namespace>/ns-write-test.txt
rm -f /mnt/namespaces/<namespace>/ns-write-test.txt
```

## 建議上線順序

1. 套用 NamespaceShare controller 資源

```bash
kubectl apply -f namespace_share/deploy/controller-rbac.yaml
kubectl apply -f namespace_share/deploy/controller-configmap.yaml
kubectl apply -f namespace_share/deploy/controller-code-configmap.yaml
kubectl apply -f namespace_share/deploy/controller-deployment.yaml
```

2. 更新 GroupShare webhook code configmap 並 restart

```bash
kubectl apply -f groupshare/deploy/webhook-code-configmap.yaml
kubectl -n kubeflow rollout restart deployment/groupshare-validating-webhook
```

3. 更新 backend image

```bash
docker build -t docker.io/cguaicadmin/ldap_backend:v0.2.43 .
docker push docker.io/cguaicadmin/ldap_backend:v0.2.43
kubectl apply -f full-stack-deployment.yaml
kubectl -n ldap rollout status deployment/backend-deployment --timeout=300s
```

4. 若是舊叢集，補做一次 backfill

```bash
kubectl -n ldap exec <backend-pod> -- sh -lc 'cd /code && python - <<\"PY\"
from kubernetes import client, config
from api.namespace_share_storage import ensure_namespace_share_directory

config.load_incluster_config()
co = client.CustomObjectsApi()
profiles = co.list_cluster_custom_object(group=\"kubeflow.org\", version=\"v1\", plural=\"profiles\")
for item in profiles.get(\"items\", []):
    namespace = ((item.get(\"metadata\") or {}).get(\"name\") or \"\").strip().lower()
    if namespace:
        ensure_namespace_share_directory(namespace)
PY'
```

## 重要注意事項

- NamespaceShare 掛載成立的前提是：
  - PodDefault 已存在
  - `/kflow_dev/shared/_namespaces/<namespace>` 實體目錄已存在

- 新 namespace 會自動建目錄
- 舊 namespace 需要一次性 backfill
- 本次已經完成現有 Profile namespace 的 backfill，所以目前叢集上的既有 namespace 都已上線這個功能
