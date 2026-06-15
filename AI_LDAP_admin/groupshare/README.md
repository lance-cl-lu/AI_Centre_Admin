# GroupShare for Kubeflow (v1, no quota)

目標：
讓 Kubeflow Notebook 可以自動看到「自己群組的共享資料夾」，同時避免使用者繞過規則亂掛 NFS。

## GroupShare 在做什麼

1. Account Manager 會把群組資訊寫進 Profile annotation
- `group`: 這個 namespace 可以看到哪些群組資料
- `manager`: 角色欄位（`user` 或 `manager`）
- `manager-group`: 哪些群組在這個 namespace 內可用 RW 權限

2. Controller 讀 Profile，自動產生/更新 PodDefault
- 每個 Profile namespace 一個 `PodDefault/groupshare`
- `PodDefault/groupshare` 使用空 selector `{}`，Profile namespace 內的 Notebook 會預設被注入掛載
- 掛載點是 `/mnt/groups/<group>`
- NFS 實體路徑是 `NFS_PATH/<group>`（例如 `NFS_PATH=/kflow_dev/shared`）

3. Webhook 擋繞過
- 擋掉使用者自己宣告 `/group*` 路徑
- 擋掉不在白名單的 NFS volume/path/server
- 擋掉不屬於 `manager-group` 的使用者把 volume 改成 RW
- Notebook 只要宣告 NFS volume，就會依 PodDefault annotation 白名單檢查

## 資料夾說明

- `controller/`
  - `app.py`: GroupShare Controller 主程式
  - `parser.py`: annotation 解析、sanitize、命名邏輯
  - `Dockerfile`: controller 映像建置檔

- `webhook/`
  - `app.py`: Validating Admission Webhook API
  - `rules.py`: Rule A/B/C 驗證核心
  - `Dockerfile`: webhook 映像建置檔

- `deploy/`
  - `controller-rbac.yaml`: controller 權限
  - `controller-configmap.yaml`: GroupShare 專用 NFS 設定（例如 `NFS_SERVER`、`NFS_PATH`）
  - `controller-deployment.yaml`: controller 部署
  - `webhook-rbac.yaml`: webhook 權限
  - `webhook-deployment.yaml`: webhook 部署
  - `webhook-service.yaml`: webhook service
  - `validating-webhook-configuration.yaml`: admission 規則與 `failurePolicy: Fail`
  - `webhook-certificate.yaml`: TLS certificate 資源
  - `notebook-template-groupshare.yaml`: 舊版標籤式範例模板，現行自動掛載流程不再依賴它

- `tests/`
  - `controller/test_app.py`: PodDefault selector 與既有 selector 更新測試
  - `controller/test_parser.py`: 解析與命名測試
  - `webhook/test_rules.py`: Rule A/B/C 測試

- `docs/`
  - `profile-annotation-spec.md`: annotation 格式與轉換規則
  - `groupshare-mount-guide.md`: 使用者視角掛載說明
  - `test-cases.md`: 測試案例與整合驗證步驟

## 現在的驗證狀態

已完成：
- Python 單元測試（17 tests）通過
- Python 語法編譯檢查通過
- `kubectl apply --dry-run=client` 全部通過
- `kubectl apply --dry-run=server` 全部通過

尚未做（正式上線前）：
- 實際 `kubectl apply` 到目標叢集
- 確認 cert-manager 可正常注入 webhook `caBundle`

## 快速測試

```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin/groupshare
python -m unittest discover -s tests -p 'test_*.py'
python -m py_compile controller/app.py controller/parser.py webhook/app.py webhook/rules.py
```

## 建議上線順序

1. 套用資源（本版本採 `python:3.11-slim + ConfigMap`，不需先建私有映像）
```bash
kubectl apply -f deploy/controller-rbac.yaml
kubectl apply -f deploy/controller-configmap.yaml
kubectl apply -f deploy/controller-code-configmap.yaml
kubectl apply -f deploy/controller-deployment.yaml
kubectl apply -f deploy/webhook-rbac.yaml
kubectl apply -f deploy/webhook-code-configmap.yaml
kubectl apply -f deploy/webhook-certificate.yaml
kubectl apply -f deploy/webhook-deployment.yaml
kubectl apply -f deploy/webhook-service.yaml
kubectl apply -f deploy/validating-webhook-configuration.yaml
```

2. 可選：若要正式產品化，再改成自建映像
- 用 `controller/Dockerfile`、`webhook/Dockerfile` 建置映像
- 更新 `deploy/*-deployment.yaml` 的 image
