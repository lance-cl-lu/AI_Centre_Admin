# GroupShare / NamespaceShare 移轉到 120.126.23.6 紀錄

最後更新：2026-06-14（Asia/Taipei）

本文記錄如何把原本 `120.126.23.25` 上的 GroupShare 與 NamespaceShare 功能移轉到 `120.126.23.6`，以及本次實際改動、驗證結果與後續維運注意事項。

## 1) 結論

`120.126.23.6` 目前已啟用以下功能：

- `groupshare-controller`
- `namespace-share-controller`
- `groupshare-validating-webhook`
- 既有 Profile 的 GroupShare annotations backfill
- 既有 group / namespace 的 NFS 目錄 backfill

目前 `.6` GroupShare / NamespaceShare 部署時使用的 NFS 設定：

- GroupShare：`10.100.4.71:/public`
- NamespaceShare：`10.100.4.71:/public/_namespaces`
- Kubernetes NFS provisioner namespace：`k8s-nfs-storage`
- Kubernetes NFS provisioner deployment：`nfs-client-provisioner`

注意：`.6` 上 `showmount -e 10.100.4.71` 顯示的 export canonical path 是 `/Public`，provisioner 也使用 `/Public`。實測 `/Public` 與 `/public` 目前都可以 mount 到同一批內容，但 `/Public/shared` 與 `/public/shared` 目前不存在，不能直接使用。

## 2) 本次新增或產生的檔案

### 備份

在 `.6` 上建立移轉前備份：

```bash
/home/mark/groupshare-migration-backup-20260614-172723
```

備份內容包含移轉前叢集中的 backend deployment、Profiles、StorageClass、NFS provisioner，以及原本不存在的 GroupShare / NamespaceShare 資源查詢結果。

### Migration manifest 目錄

本次沒有直接修改原始 repo 內的 `groupshare/deploy` 或 `namespace_share/deploy` YAML。

為了避免把 `.6` 專用 NFS 設定直接寫回共用原始碼，先建立一份 migration copy：

```bash
/home/mark/groupshare-migration-20260614-172755
```

這個目錄內有從下列 repo 目錄複製出來的 manifest：

```bash
/home/mark/work/AI_Centre_Admin/AI_LDAP_admin/groupshare
/home/mark/work/AI_Centre_Admin/AI_LDAP_admin/namespace_share
```

實際套用到 `.6` 的是 migration 目錄中的 YAML，不是原始 repo 內的 YAML。

### 本文件

新增文件：

```bash
/home/mark/work/AI_Centre_Admin/AI_LDAP_admin/groupshare/docs/migration-to-120-126-23-6.md
```

## 3) 針對 `.6` 修改過的設定

### GroupShare controller config

在 migration copy 的 `groupshare/deploy/controller-configmap.yaml` 中調整：

```yaml
NFS_SERVER: "10.100.4.71"
NFS_PATH: "/public"
NFS_NAMESPACE: "k8s-nfs-storage"
NFS_DEPLOYMENT: "nfs-client-provisioner"
```

### NamespaceShare controller config

在 migration copy 的 `namespace_share/deploy/controller-configmap.yaml` 中調整：

```yaml
NFS_SERVER: "10.100.4.71"
NFS_PATH: "/public/_namespaces"
NFS_NAMESPACE: "k8s-nfs-storage"
NFS_DEPLOYMENT: "nfs-client-provisioner"
```

### 為什麼不是沿用 `.25` 的 NFS path

`.25` 原本使用的設定是：

```text
120.126.23.7:/kflow_dev/shared
120.126.23.7:/kflow_dev/shared/_namespaces
```

但 `.6` 已經有既有 backend NFS mount：

```text
10.100.4.71:/public -> /mnt/groupshare
```

且 `.6` 叢集內已存在 NFS provisioner：

```text
namespace: k8s-nfs-storage
deployment: nfs-client-provisioner
NFS_SERVER: 10.100.4.71
NFS_PATH: /Public
```

所以本次移轉選擇配合 `.6` 既有 NFS server 與 backend mount，使用 `10.100.4.71:/public`。

後續若要統一成 NFS export 的 canonical path，建議改成：

```text
GroupShare: 10.100.4.71:/Public
NamespaceShare: 10.100.4.71:/Public/_namespaces
```

不要直接改成 `10.100.4.71:/Public/shared`，因為 2026-06-14 實測 `/Public/shared` 不存在，mount 會回報 `No such file or directory`。

## 4) 套用的 Kubernetes manifest

GroupShare controller：

```bash
kubectl apply -f groupshare/deploy/controller-rbac.yaml
kubectl apply -f groupshare/deploy/controller-configmap.yaml
kubectl apply -f groupshare/deploy/controller-code-configmap.yaml
kubectl apply -f groupshare/deploy/controller-deployment.yaml
```

NamespaceShare controller：

```bash
kubectl apply -f namespace_share/deploy/controller-rbac.yaml
kubectl apply -f namespace_share/deploy/controller-configmap.yaml
kubectl apply -f namespace_share/deploy/controller-code-configmap.yaml
kubectl apply -f namespace_share/deploy/controller-deployment.yaml
```

GroupShare validating webhook：

```bash
kubectl apply -f groupshare/deploy/webhook-rbac.yaml
kubectl apply -f groupshare/deploy/webhook-code-configmap.yaml
kubectl apply -f groupshare/deploy/webhook-certificate.yaml
kubectl apply -f groupshare/deploy/webhook-deployment.yaml
kubectl apply -f groupshare/deploy/webhook-service.yaml
kubectl apply -f groupshare/deploy/validating-webhook-configuration.yaml
```

注意：webhook deployment 啟動後，應等 Flask app 實際開始 listen 再套用 `ValidatingWebhookConfiguration`。這個 deployment 目前會在 pod startup 時執行 `pip install`，所以 pod 變成 Ready 不代表 webhook 一定已經可接 admission request。

## 5) Backfill 做了什麼

### GroupShare 目錄

從 `.6` Django DB 讀出既有 group，排除 `root` 後，在 NFS 上建立 group share 目錄。

範例：

```text
/mnt/groupshare/test100
/mnt/groupshare/aic-dev
/mnt/groupshare/trash
/mnt/groupshare/aim128-a2612
```

### NamespaceShare 目錄

從 `.6` 叢集讀出既有 Kubeflow Profiles，為每個 Profile 建立 namespace share 目錄：

```text
/mnt/groupshare/_namespaces/<profile-name>
```

### Profile annotations

從 `.6` Django DB 的 user / group 關係產生 Profile annotations，並 patch 到對應 Kubeflow Profile。

主要欄位：

```yaml
metadata:
  annotations:
    group: "<csv groups>"
    manager: "user 或 manager"
    manager-group: "<csv groups>"
```

Backfill 後狀態：

```text
profiles: 223
profiles_with_group: 217
missing Django user profile: 23
```

`missing Django user profile` 代表 DB 裡有 user 但叢集裡沒有對應 Profile，因此沒有 patch 對象。

## 6) 驗證結果

Deployment 狀態：

```text
kubeflow/groupshare-controller            1/1 Ready
kubeflow/namespace-share-controller       1/1 Ready
kubeflow/groupshare-validating-webhook    1/1 Ready
```

PodDefault 數量：

```text
groupshare PodDefault:        223
namespace-share PodDefault:   223
```

Notebook namespace coverage：

```text
notebook_namespaces: 162
missing_policy: none
```

代表目前有 notebook 的 namespace 都已經有 `groupshare` 與 `namespace-share` PodDefault。

Webhook smoke test：

- 正確的 GroupShare read-only 加 NamespaceShare read-write 設定可以通過。
- 錯誤 NFS server，例如 `1.2.3.4`，會被 webhook 擋下。
- 沒有 `groupshare` label 的 Notebook 若宣告 NFS volume，仍會被 webhook 依白名單與 RW 權限檢查。
- 非管理者嘗試把 GroupShare volume 設成 `readOnly: false`，會被 webhook 擋下。

NFS smoke test：

- `10.100.4.71:/public/test100` 可以正常掛載為 read-only。
- `10.100.4.71:/public/_namespaces/lance` 可以正常掛載為 read-write。
- `10.100.4.71:/Public` 可以正常掛載，且內容與 `/public` 相同。
- `10.100.4.71:/Public/shared` 與 `10.100.4.71:/public/shared` 目前都無法掛載，server 回覆 `No such file or directory`。
- namespace share 實際寫入、讀取、刪除測試成功。
- group share read-only 模式寫入失敗，符合預期。

測試用 pod 已刪除，沒有留下測試資源。

## 7) 新 user / group 自動套用的行為

`.6` backend image 內已包含以下程式：

```text
/code/api/groupshare_storage.py
/code/api/namespace_share_storage.py
```

backend 內也已經有呼叫這些功能的程式碼，用於：

- 建立 group 時建立 GroupShare 目錄。
- 建立 Profile / namespace 時建立 NamespaceShare 目錄。
- 使用者群組異動時同步 Profile annotations。

已驗證 backend service account 具備 patch Kubeflow Profile 的權限：

```text
system:serviceaccount:ldap:backend-service-account can patch profiles.kubeflow.org
```

也已驗證 backend pod 內使用專案既有的 in-cluster auth 修正邏輯後，可以讀取 `.6` 叢集 Profiles。

本次沒有建立假的 LDAP / Django user 或 group 留在正式系統內。既有資料已完成 backfill，新資料則會依照 backend 現有邏輯處理。

## 8) 其他工程師提到的疑慮

### 固定 IP 或 hard-coded path

這次不能直接把 `.25` 的 manifest 原封不動套到 `.6`，原因是 `.25` 和 `.6` 的 NFS server、NFS path、NFS provisioner namespace 都不同。

最容易出問題的固定值：

```text
NFS_SERVER
NFS_PATH
NFS_NAMESPACE
NFS_DEPLOYMENT
ValidatingWebhookConfiguration service name / namespace / path
```

如果這些值仍指向 `.25` 或 `.25` 的 NFS，controller 可能會產生錯誤 PodDefault，notebook pod 也可能因 NFS mount 失敗而起不來。

### manifest 是不是只要放到 groupshare/deploy

不是。

這套功能分成兩個目錄：

```text
groupshare/deploy
namespace_share/deploy
```

GroupShare controller 和 webhook 在 `groupshare/deploy`。

NamespaceShare controller 在 `namespace_share/deploy`。

所以只放或只套 `groupshare/deploy` 不會完成 NamespaceShare。

### `.6` 是否已經有 NFS server 和 path

是，`.6` 目前 GroupShare / NamespaceShare 部署使用的是：

```text
10.100.4.71:/public
```

但 NFS server 對外 export 顯示的是：

```text
10.100.4.71:/Public
```

也就是說，`/Public` 是目前看到的 canonical export path；`/public` 則是 backend 與本次 share 部署沿用的 path，實測也可 mount 到同一批資料。

backend pod 內掛載位置是：

```text
/mnt/groupshare
```

NamespaceShare 則使用同一個 NFS 底下的子目錄：

```text
10.100.4.71:/public/_namespaces
```

目前沒有看到可用的 `10.100.4.71:/Public/shared`。若希望 share 功能放在 `/Public/shared`，需要先在 NFS server 上建立該目錄並確認 export / permission，再同步修改 backend mount、controller ConfigMap、PodDefault 產生邏輯與 webhook 白名單。

### `TRASH` group

`.6` DB 內有不少 user 屬於 `TRASH` group。Backfill 會依照 `.6` DB 的真實 group membership 寫入 annotations，所以這些 user 會得到 `TRASH` group share。

這不是 migration 額外新增的規則，而是根據目前 `.6` DB 狀態產生。

### GroupShare read-write 權限

GroupShare 是否能以 read-write 掛載，取決於 admission request 裡的 Kubernetes `userInfo.groups` 是否有對應 manager group。

用 `kubernetes-admin` 做 dry-run 時，不會被視為一般 Kubeflow 使用者或 group manager，所以 read-write GroupShare 測試會被 webhook 擋下，這是預期行為。

正式使用者登入時，需要確認 Kubeflow auth flow 仍會正確帶出 group 資訊。

### Notebook label

2026-06-15 起，GroupShare 與 NamespaceShare PodDefault 改成空 selector：

```yaml
selector: {}
```

所以 notebook 不需要在 create Notebook 時選 Configurations，也不需要 notebook pod template 帶舊版 `groupshare` label。

既有 notebook 若在舊 selector 時期建立且沒有掛載 share，套用新版 controller 後通常需要停止再啟動，必要時重建 notebook，讓 Kubeflow 重新產生 pod。

### Webhook 啟動方式

目前 webhook deployment 和 `.25` 一樣，使用 `python:3.11-slim`，啟動時再 `pip install` dependencies。

風險：

- pod 變 Ready 和 Flask app 實際 listen 之間可能有短暫時間差。
- PyPI 或網路異常時，pod 啟動可能失敗。
- dependency version 如果沒有完全 pin 住，未來重啟可能遇到版本變動。

建議後續把 webhook 包成固定 image，並加入 readiness probe。

### 2026-06-15 dev24 API server certificate 修復

`groupshare-controller`、`namespace-share-controller`、`groupshare-validating-webhook` 與 Calico 曾在 2026-06-15 10:30-10:37（Asia/Taipei）左右出現：

```text
certificate verify failed: certificate has expired
```

原因不是 GroupShare/NamespaceShare 的 PodDefault 或 webhook certificate，而是 Kubernetes service 有兩個 API server endpoint：

```text
120.126.23.24:6443
120.126.23.25:6443
```

其中 `120.126.23.24`（node `dev24`）仍提供已於 `2026-06-09T07:01:43Z` 過期的 kube-apiserver serving certificate。Pod 內元件隨機打到 `.24` 時會驗證失敗，因此 Notebook create / controller sync / Calico CNI 會間歇性失敗。

處理方式：

1. 透過 dev24 臨時 privileged maintenance pod 備份 `/etc/kubernetes`：

```text
/etc/kubernetes.backup-before-cert-renew-20260615-025812
```

2. 在 dev24 執行：

```bash
kubeadm certs renew all
```

3. 重啟 dev24 上的 static control-plane containers：

```text
etcd-dev24
kube-apiserver-dev24
kube-controller-manager-dev24
kube-scheduler-dev24
```

修復後確認：

```text
120.126.23.24:6443 notAfter=Jun 15 02:58:13 2027 GMT
120.126.23.25:6443 notAfter=Dec 27 20:48:44 2026 GMT
```

## 9) 維運檢查指令

以下指令建議在 `.6` 上使用：

```bash
export KUBECONFIG=/etc/kubernetes/admin.conf

kubectl -n kubeflow get deploy groupshare-controller namespace-share-controller groupshare-validating-webhook
kubectl -n kubeflow get pods -l app=groupshare-controller
kubectl -n kubeflow get pods -l app=namespace-share-controller
kubectl -n kubeflow get pods -l app=groupshare-validating-webhook

kubectl -n kubeflow logs deploy/groupshare-controller --tail=100
kubectl -n kubeflow logs deploy/namespace-share-controller --tail=100
kubectl -n kubeflow logs deploy/groupshare-validating-webhook --tail=100

kubectl get validatingwebhookconfiguration groupshare-validating-webhook
kubectl -n kubeflow get certificate groupshare-webhook-cert
kubectl -n kubeflow get svc,endpoints groupshare-webhook
```

檢查 PodDefault 數量：

```bash
kubectl get poddefaults -A | grep -E 'groupshare|namespace-share' | wc -l
kubectl get poddefaults -A | grep groupshare
kubectl get poddefaults -A | grep namespace-share
```

檢查某個 namespace 的 PodDefault：

```bash
kubectl -n <profile-namespace> get poddefault groupshare -o yaml
kubectl -n <profile-namespace> get poddefault namespace-share -o yaml
```

## 10) 回復方式

若需要暫停 webhook enforcement：

```bash
kubectl delete validatingwebhookconfiguration groupshare-validating-webhook
```

若需要移除 controller：

```bash
kubectl -n kubeflow delete deployment groupshare-controller
kubectl -n kubeflow delete deployment namespace-share-controller
```

若需要恢復移轉前狀態，先查閱：

```bash
/home/mark/groupshare-migration-backup-20260614-172723
```

恢復前要確認是否要保留 migration 後建立的 NFS 目錄與 Profile annotations，避免誤刪正式資料。
