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

- `kustomization.yaml`: 唯一部署入口（`kubectl apply -k`）。程式碼以 `configMapGenerator` 產生帶內容雜湊的不可變更 ConfigMap，程式一改就自動換名並滾動更新，不需重建映像。
- `deploy/`
  - `controller-rbac.yaml`: controller 權限（含標記待重啟 Notebook Pod 所需的 pods/events/notebooks 權限）
  - `controller-configmap.yaml`: GroupShare 專用 NFS 設定（`NFS_SERVER`、`NFS_PATH`）；controller 以此為準，provisioner Deployment 只是備用來源
  - `controller-deployment.yaml`: controller 部署（環境值由 cgu-manifests 的 apply.sh 依 env.ini 改寫）
  - `controller-runtime-patch.yaml`: 讓 controller 從產生的 ConfigMap 執行程式碼
  - `webhook-rbac.yaml`、`webhook-service.yaml`、`webhook-deployment.yaml`、`webhook-pdb.yaml`: webhook（2 副本、TLS 熱載入、健康檢查）
  - `validating-webhook-configuration.yaml`: admission 規則與 `failurePolicy: Fail`；`caBundle` 由 cainjector 從 trust Secret 注入，manifest 內不可設定
  - `webhook-serving-certificate.yaml`、`webhook-ca-issuer.yaml`: 現行 TLS certificate 與 CA Issuer
  - `webhook-certificate-monitoring.yaml`: 監測與告警；由 `scripts/bootstrap.sh webhook` 在有 Prometheus Operator CRD 時套用
  - `webhook-certificate.yaml`: 舊 SelfSigned 憑證，僅保留供回復使用，不在 kustomization 內
  - `notebook-template-groupshare.yaml`: 舊版標籤式範例模板，不在 kustomization 內

- `scripts/`
  - `bootstrap.sh nfs|webhook`: kustomize 無法表達的前置作業（NFS 根目錄、webhook CA 與 trust Secret）；可重複執行，不覆蓋既有物件
  - `check.sh`: 部署後唯讀檢查，含「需重啟才會套用新掛載」的 Notebook Pod 清單
  - `export-to-cgu-manifests.sh`: 把本目錄同步到 cgu-manifests（本 repository 為唯一來源）

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

## 部署

正式環境由 cgu-manifests 的 `apply.sh` 部署，它會依序執行 `scripts/bootstrap.sh nfs`、整體 kustomize、`scripts/bootstrap.sh webhook` 與 `scripts/check.sh`。只更新 GroupShare 時：

```bash
bash groupshare/scripts/export-to-cgu-manifests.sh /path/to/cgu-manifests   # 先同步程式與 manifest
cd /path/to/cgu-manifests                                                     # env 值已由 apply.sh 依 env.ini 寫入
kubectl diff -k cgu/groupshare; kubectl diff -k cgu/namespace_share           # 確認差異
kubectl apply -k cgu/groupshare && kubectl apply -k cgu/namespace_share
bash cgu/groupshare/scripts/check.sh env.ini
```

不要只為 GroupShare 執行整個 `apply.sh`：它會刪除並重建 `istio-ingressgateway`，造成全體使用者短暫斷線。

## 群組變更與既有 Notebook

Kubernetes 無法修改執行中 Pod 的 volume，PodDefault 只在建立 Pod 時注入。controller 每輪比對 Notebook Pod 實際的群組掛載與目前 PodDefault，不一致時在 Pod 加上 `groupshare.kubeflow.org/restart-required` annotation，並對 Notebook 發出 `GroupShareRestartRequired` Event（Kubeflow 的 Notebook 詳細頁可見）。它不會重啟任何 Pod；使用者下次停止再啟動 Notebook 即套用新掛載，`/home/jovyan` 的檔案不受影響。

群組資料由後端定期對帳（`api/groupshare_reconcile.py`，預設每 600 秒，`GROUPSHARE_RECONCILE_INTERVAL_SECONDS=0` 可停用），補正 Profile annotations 並建立缺少的群組與 namespace 目錄。手動執行：`python manage.py reconcile_groupshare --dry-run`。

線上沿用既有依賴映像，以 kustomize 產生的不可變更 ConfigMap 發布程式碼；不要原地修改已發布的 ConfigMap。
