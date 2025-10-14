# Repository Guidelines
此 monorepo 支援 AI Centre 管理平台，涵蓋 Django 後端、React 管控台與多個 Kubernetes 控制器；下列指引協助新成員快速上手。

## 專案結構與模組配置
- `AI_LDAP_admin/`：Django REST 後端與部署 YAML，編譯後的單頁介面存放於 `frontend/`。
- `frontend/`：Create React App 原始碼，`src/components/` 內含 UI 模組，`context/` 管理共享狀態，`icons/` 供建置使用。
- `controller101/`：Go 撰寫的 Pod 清理控制器，附 Dockerfile 與 `mycontroll.yaml`。
- `QNAPController/`：負責 NAS 清理的 Go 服務，佈署為獨立 Deployment。
- `dex_connector/`、`ldap-helm.yaml` 與 `assets/`：整合 Dex/OpenLDAP 的設定檔與共用素材。

## 建置、測試與開發指令
- `python -m venv .venv && source .venv/bin/activate && pip install -r AI_LDAP_admin/requirements.txt`：建立後端虛擬環境。
- `python AI_LDAP_admin/manage.py runserver 0.0.0.0:8000`：以 SQLite 啟動 Django。
- `cd frontend && npm install && npm start`：啟動 React 開發伺服器；`npm run build` 後請執行 `AI_LDAP_admin/update.sh` 同步模板與靜態檔。
- `cd controller101 && go build ./... && go test ./...`（`QNAPController/` 同理），完成後以 `make docker` 重建並套用 Kubernetes 描述檔。
- `kubectl apply -f full-stack-deployment.yaml -n ldap --dry-run=client`：部署前進行驗證。

## 程式風格與命名
- Python 採四空白縮排與 PEP 8 匯入順序，視圖函式維持 snake_case，序列化類別採 CamelCase；提交前請執行 `django-admin check`。
- JavaScript 使用函式型元件，檔名 PascalCase、hooks 為 camelCase，沿用既有 Tailwind 工具類別。
- Go 程式碼一律 `gofmt ./...`，封包名稱保持單數，紀錄訊息採結構化格式。
- YAML 檔維持兩格縮排並註記 namespace 假設，敏感資訊以 Secret 管理，不進版控。

## 測試準則
- Django 測試置於各 app 的 `tests/`，以 `python AI_LDAP_admin/manage.py test` 覆蓋 LDAP 同步流程。
- React 測試與元件同層（`<Component>.test.js`），使用 `npm test -- --watchAll=false` 確保可重複。
- Go 控制器撰寫 `_test.go` 搭配 fake client，發布映像前需通過 `go test ./...`。
- Kubernetes 清單請以 `kubectl apply --dry-run=client -f <file>` 驗證並在 PR 記錄預期結果。

## 提交與 PR 指南
- Commit 以簡短祈使句描述，例如 `Add assets`、`Update controller image`，一次聚焦單一變更。
- PR 需說明影響面、連結議題、標註修改的 Kubernetes 資源，並在 UI 或行為調整時附截圖或日誌。
- 若調整環境變數、Docker tag 或權限設定，請列出部署與回滾步驟，必要時邀請營運同仁審閱。

## 部署注意事項
- `AI_LDAP_admin/Makefile docker` 會重建前端資產、打包 `cguaicadmin/backend_dev` 並重新套用 `full-stack-deployment.yaml`。
- `controller101/Makefile` 重建 Pod-killer 映像後套用 `mycontroll.yaml`，推送前請更新標籤。
- Dex 設定預設 `ldap` 命名空間，憑證或帳密維持於 Secret，提交前務必去識別。
