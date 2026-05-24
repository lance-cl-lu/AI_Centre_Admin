# GroupShare 維運與部署 Workflow

最後更新：2026-03-15（Asia/Taipei）

## 1) 功能總覽（先理解這三層）

1. Account Manager backend 寫 Profile annotation
- `group`: 使用者可見群組（CSV）
- `manager`: 角色（`user` / `manager`）
- `manager-group`: 可 RW 的管理群組（CSV）

2. GroupShare Controller 自動同步 PodDefault
- 讀每個 namespace 的 Profile annotation
- 產生/更新 `PodDefault/groupshare`
- 注入 `/mnt/groups/<group>` NFS 掛載

3. Validating Webhook 擋不合法 Notebook
- 禁止繞過白名單 NFS 掛載
- 非管理群組禁止改成 RW
- 要求 `groupshare=enabled` 才能使用 GroupShare volume

## 2) 重要路徑

- `groupshare/controller/app.py`: Controller 主流程
- `groupshare/controller/parser.py`: annotation 解析（含 `manager-group` fallback）
- `groupshare/webhook/app.py`: Admission Webhook 入口
- `groupshare/webhook/rules.py`: Rule A/B/C/D
- `groupshare/deploy/*.yaml`: k8s 部署模板（目前為 ConfigMap 掛 code）

## 3) 日常改版流程（Code Change）

在 `AI_LDAP_admin/groupshare` 目錄操作。

1. 先本機驗證
```bash
python -m unittest discover -s tests -p 'test_*.py'
python -m py_compile controller/app.py controller/parser.py webhook/app.py webhook/rules.py
```

2. 套用部署檔
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

2.1 如果這次有改 `AI_LDAP_admin/api/views.py`（Profile annotation 寫入邏輯）
```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin
kubectl apply -f full-stack-deployment.yaml
kubectl -n ldap rollout status deployment/backend-deployment --timeout=180s
```

2.2 如果這次有改 backend 程式且需要發新映像（建議）
```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin

# 建議用新 tag，不要覆蓋舊 tag
export BACKEND_IMAGE=docker.io/cguaicadmin/ldap_backend
export BACKEND_TAG=v0.2.41

docker login
docker build -t ${BACKEND_IMAGE}:${BACKEND_TAG} . --no-cache
docker push ${BACKEND_IMAGE}:${BACKEND_TAG}
```

2.3 把叢集 backend 切到新映像（兩種方式擇一）

方式 A（較快，建議）：
```bash
kubectl -n ldap set image deployment/backend-deployment backend=${BACKEND_IMAGE}:${BACKEND_TAG}
kubectl -n ldap rollout status deployment/backend-deployment --timeout=300s
```
註：方式 A 會讓叢集先更新，但不會自動改 repo 裡的 `full-stack-deployment.yaml`，之後記得回寫新 tag。

方式 B（維持 YAML 為單一真相）：
```bash
# 先把 full-stack-deployment.yaml 的 image 改成新 tag，再 apply
kubectl apply -f full-stack-deployment.yaml
kubectl -n ldap rollout status deployment/backend-deployment --timeout=300s
```

3. 觀察 rollout 狀態
```bash
kubectl -n kubeflow rollout status deployment/groupshare-controller --timeout=180s
kubectl -n kubeflow rollout status deployment/groupshare-validating-webhook --timeout=180s
```

4. 驗證 Pod 是否健康
```bash
kubectl -n kubeflow get pods -l app=groupshare-controller
kubectl -n kubeflow get pods -l app=groupshare-validating-webhook
kubectl -n kubeflow logs deploy/groupshare-controller --tail=100
kubectl -n kubeflow logs deploy/groupshare-validating-webhook --tail=100
```

## 4) `rollout` 是什麼？可不可以刪？

`rollout` 是 Kubernetes 觀察/觸發 Deployment 更新的機制。

- `kubectl rollout status ...`: 看這次更新是否完成（建議保留）
- `kubectl rollout restart ...`: 強制重啟 Pod（在 code 走 ConfigMap 掛載時非常有用）

結論：不要把 rollout 流程整段刪掉，至少保留 `rollout status`。
若你更新了 ConfigMap 裡的程式碼，但 Pod 沒重建，新的 Python 程式通常不會自動 reload，建議手動重啟：

```bash
kubectl -n kubeflow rollout restart deployment/groupshare-controller
kubectl -n kubeflow rollout restart deployment/groupshare-validating-webhook
```

## 5) Crash / 異常處理流程

1. 先看 Pod 與事件
```bash
kubectl -n kubeflow get pods | grep groupshare
kubectl -n kubeflow describe pod <pod-name>
```

2. 看 logs
```bash
kubectl -n kubeflow logs <controller-pod-name> --tail=200
kubectl -n kubeflow logs <webhook-pod-name> --tail=200
```

3. 常見原因
- RBAC 不足：`forbidden` 相關錯誤
- `NFS_PATH` / `NFS_SERVER` 設定不一致
- cert-manager 未正常注入 webhook 憑證
- Deployment 可啟動但仍跑舊 code（忘記 rollout restart）

4. 快速復原
- 先把對應 `deploy/*.yaml` 改回前一版並 `kubectl apply`
- 再執行 `kubectl rollout restart` + `kubectl rollout status`
- 若 backend 新映像有問題：`kubectl -n ldap rollout undo deployment/backend-deployment`

## 6) 驗證清單（上線後）

1. Controller 日誌有 `Created/Updated PodDefault` 訊息
2. Profile namespace 中存在 `PodDefault/groupshare`
3. Notebook 加上 `groupshare=enabled` 能正常掛載 `/mnt/groups/*`
4. 非 admin 群組把 volume 改成 `readOnly: false` 會被 webhook 擋下
5. webhook 憑證 ready（`groupshare-webhook-tls` secret 存在）

## 7) 與 README 的分工

- `README.md`: 架構與專案導覽（給第一次看的人）
- `docs/workflow.md`（本文件）: 日常維運與故障處理步驟（給 on-call/接手工程師）
