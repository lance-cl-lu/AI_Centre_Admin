# GroupShare for Kubeflow (v1, no quota)

目標：
讓 Kubeflow Notebook 可以自動看到「自己群組的共享資料夾」，同時避免使用者繞過規則亂掛 NFS。

2026-09-09 線上憑證維護入口：[憑證自動續期、熱載入與年度維護文件](docs/certificate-maintenance.md)。目前使用穩定 CA、400 天服務憑證、提前 60 天自動續期及兩個 webhook 副本。

## GroupShare 在做什麼

1. Account Manager 會把群組資訊寫進 Profile annotation
- `group`: 這個 namespace 可以看到哪些群組資料
- `manager`: 角色欄位（`user` 或 `manager`）
- `manager-group`: 哪些群組在這個 namespace 內可用 RW 權限

2. Controller 讀 Profile，自動產生/更新 PodDefault
- 每個 Profile namespace 一個 `PodDefault/groupshare`
- `PodDefault/groupshare` 使用空 selector `{}`，Profile namespace 內的 Notebook 會預設被注入掛載
- 掛載點是 `/mnt/groups/<group>`
- NFS 實體路徑是 `NFS_PATH/<group>`（例如 `NFS_PATH=/Public/shared`）

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
  - `tls_reload.py`: 每次 TLS 握手載入最新完整憑證，更新失敗時保留有效 context
  - `Dockerfile`: webhook 映像建置檔

- `deploy/`
  - `controller-rbac.yaml`: controller 權限
  - `controller-configmap.yaml`: GroupShare 專用 NFS 設定（例如 `NFS_SERVER`、`NFS_PATH`）
  - `controller-deployment.yaml`: controller 部署
  - `webhook-rbac.yaml`: webhook 權限
  - `webhook-deployment.yaml`: webhook 部署
  - `webhook-service.yaml`: webhook service
  - `validating-webhook-configuration.yaml`: admission 規則與 `failurePolicy: Fail`
  - `webhook-serving-certificate.yaml`、`webhook-ca-issuer.yaml`: 現行 TLS certificate 與 CA Issuer
  - `webhook-certificate.yaml`: 舊 SelfSigned 憑證，僅保留供回復使用
  - `webhook-tls-runtime-configmap.json`: 有版本且不可變更的線上 webhook 程式碼
  - `webhook-tls-runtime-patch.yaml`: 切換既有 Deployment 至熱載入版本
  - `webhook-tls-probes-patch.yaml`: 健康檢查及熱載入失效時的重啟保護
  - `webhook-certificate-monitoring.yaml`: HTTPS、重新載入、期限及監測失聯告警
  - `notebook-template-groupshare.yaml`: 舊版標籤式範例模板，現行自動掛載流程不再依賴它

- `tests/`
  - `controller/test_app.py`: PodDefault selector 與既有 selector 更新測試
  - `controller/test_parser.py`: 解析與命名測試
  - `webhook/test_rules.py`: Rule A/B/C 測試

- `docs/`
  - `profile-annotation-spec.md`: annotation 格式與轉換規則
  - `groupshare-mount-guide.md`: 使用者視角掛載說明
  - `test-cases.md`: 測試案例與整合驗證步驟
  - `certificate-maintenance.md`: 憑證故障修復、續期驗證與年度維護流程

## 現在的驗證狀態

2026-09-09：31 項測試通過，包含 12 次連續熱載入；已實際部署並以 cmctl 觸發憑證及私鑰續期，兩個副本不重啟即可提供新憑證。完整現場驗收紀錄見憑證維護文件。

## 快速測試

```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin/groupshare
python -m unittest discover -s tests -p 'test_*.py'
python -m py_compile controller/app.py controller/parser.py webhook/app.py webhook/rules.py
```

## 建議上線順序

1. 先依憑證維護文件完成 CA Secret、信任 bundle 與遷移前置作業。既有 SelfSigned 部署必須先完成新舊信任重疊，不可直接覆蓋 webhook 設定。

2. 已完成信任遷移後，套用資源：
```bash
kubectl apply -f deploy/controller-rbac.yaml
kubectl apply -f deploy/controller-configmap.yaml
kubectl apply -f deploy/controller-code-configmap.yaml
kubectl apply -f deploy/controller-deployment.yaml
kubectl apply -f deploy/webhook-rbac.yaml
kubectl apply -f deploy/webhook-ca-issuer.yaml
kubectl apply -f deploy/webhook-serving-certificate.yaml
kubectl apply -f deploy/webhook-tls-runtime-configmap.json
kubectl apply -f deploy/webhook-deployment.yaml
kubectl -n kubeflow patch deployment groupshare-validating-webhook --type=strategic --patch-file deploy/webhook-tls-probes-patch.yaml
kubectl apply -f deploy/webhook-service.yaml
kubectl apply -f deploy/validating-webhook-configuration.yaml
kubectl apply -f deploy/webhook-pdb.yaml
kubectl apply -f deploy/webhook-certificate-monitoring.yaml
```

線上沿用既有依賴映像，以不可變更的 ConfigMap 發布程式碼。修改程式碼時需產生新 ConfigMap 名稱並更新 Deployment；不要原地修改已發布的不可變更 ConfigMap。
