# GroupShare 與 NamespaceShare 使用說明書

版本日期：2026-06-15

## 1. 功能總覽

GroupShare 與 NamespaceShare 都是提供 Notebook 使用者共用檔案的功能。使用者建立或啟動 Notebook 後，系統會自動把可用的共用資料夾掛載到 Notebook 內，不需要自行設定 NFS，也不需要手動填寫 volume。

兩者差異如下：

| 功能 | 用途 | Notebook 內路徑 | 寫入權限 |
| --- | --- | --- | --- |
| GroupShare | 同一群組成員共用資料 | `/mnt/groups/<group-name>` | 一般 user 唯讀；manager 可寫入自己管理的群組 |
| NamespaceShare | 同一 namespace 內共用資料 | `/mnt/namespaces/<namespace>` | 該 namespace 內的 Notebook 可寫入 |

系統目前使用的共用儲存來源為 NFS server `120.126.23.7`。GroupShare 的資料位於 `/kflow_dev/shared` 底下；NamespaceShare 的資料位於 `/kflow_dev/shared/_namespaces` 底下。

## 2. GroupShare

GroupShare 依照使用者 Profile 上的群組設定，自動掛載群組資料夾。Profile 內的 `group` 欄位可以有一個或多個群組，使用逗號分隔，例如：

```text
AIG_Test,AITA
```

Notebook 內會看到：

```text
/mnt/groups/aig-test
/mnt/groups/aita
```

群組名稱會自動轉成小寫，非英數字元會轉成 `-`。例如 `AIG_Test` 會變成 `aig-test`。

### 2.1 User 權限

一般 user 可以讀取所屬群組的 GroupShare 資料夾，但不能寫入。適合用來讀取共用教材、範例資料、模型、參考檔案，或由 manager 維護的共同資料。

在 Notebook Terminal 內可以測試：

```bash
ls /mnt/groups
ls /mnt/groups/aig-test
touch /mnt/groups/aig-test/test.txt
```

一般 user 執行 `touch` 時如果出現 `Permission denied`，代表權限正常，因為該群組資料夾是唯讀。

### 2.2 Manager 權限

manager 可以寫入自己管理的群組資料夾。Profile 需要同時設定：

```text
manager: manager
manager-group: AIG_Test
```

若使用者同時屬於多個 group，但只管理其中一個 group，只有被列在 `manager-group` 的群組會是可寫入，其他群組仍是唯讀。

範例：

```text
group: AIG_Test,AITA
manager: manager
manager-group: AIG_Test
```

Notebook 內權限會是：

| 路徑 | 權限 |
| --- | --- |
| `/mnt/groups/aig-test` | manager 可讀寫 |
| `/mnt/groups/aita` | 唯讀 |

manager 可在 Notebook Terminal 測試：

```bash
echo "hello" > /mnt/groups/aig-test/test.txt
cat /mnt/groups/aig-test/test.txt
```

注意：這裡的 manager 是 GroupShare 資料夾寫入權限，不代表一定可以管理 Kubeflow namespace 成員或修改其他人的 Notebook。

## 3. NamespaceShare

NamespaceShare 是每個 namespace 專屬的共用資料夾。系統會為每個 Profile namespace 自動建立一個掛載點：

```text
/mnt/namespaces/<namespace>
```

例如 namespace 是 `wycctest1`，Notebook 內會看到：

```text
/mnt/namespaces/wycctest1
```

NamespaceShare 預設為可讀寫，適合放同一 namespace 內多台 Notebook 都會使用的資料，例如專案資料、暫存輸出、共用程式碼或多人協作檔案。

在 Notebook Terminal 內可以測試：

```bash
ls /mnt/namespaces
echo "hello" > /mnt/namespaces/wycctest1/test.txt
cat /mnt/namespaces/wycctest1/test.txt
```

## 4. 建立 Notebook 時可以調整的設定

使用者在 Kubeflow Notebook 建立頁面可以調整下列設定：

| 設定 | 說明 |
| --- | --- |
| Notebook name | Notebook 名稱 |
| Namespace | Notebook 建立在哪個 namespace |
| Server type | Jupyter、VSCode-like、RStudio-like 類型 |
| Image | 選擇系統提供的映像檔，也可輸入自訂 image |
| ImagePullPolicy | `IfNotPresent`、`Always`、`Never` |
| CPU | CPU request；系統會依設定計算 CPU limit |
| Memory | Memory request；系統會依設定計算 memory limit |
| GPU | GPU vendor 與張數，例如 NVIDIA |
| Workspace Volume | Notebook 主要工作目錄，預設掛在 `/home/jovyan` |
| Data Volumes | 額外新增或掛載 PVC |
| Affinity | 可選節點類型，例如 A5000 或 MIG |
| Shared Memory | 是否啟用 `/dev/shm` shared memory |
| Configurations | 額外 PodDefault 設定；GroupShare 與 NamespaceShare 不需要手動選 |
| Environment | 環境變數設定 |

GroupShare 與 NamespaceShare 不需要使用者在建立 Notebook 時手動設定。使用者不需要在 Configurations 選 `groupshare` 或 `namespace-share`，也不需要手動加 `groupshare` label；系統會透過 PodDefault 自動套用 GroupShare 與 NamespaceShare。

## 5. 進入 Notebook 後如何使用

1. 進入 Kubeflow Dashboard。
2. 選擇自己的 namespace。
3. 進入 Notebooks 頁面。
4. 建立新的 Notebook，或啟動既有 Notebook。
5. 按 Connect 進入 Notebook。
6. 開啟 Terminal 或檔案瀏覽器。
7. 到下列路徑查看共用資料：

```text
/mnt/groups
/mnt/namespaces
```

常用指令：

```bash
# 查看所有 GroupShare 掛載
ls -lah /mnt/groups

# 查看所有 NamespaceShare 掛載
ls -lah /mnt/namespaces

# 查看目前使用者
whoami

# 測試 NamespaceShare 寫入
echo "test" > /mnt/namespaces/<namespace>/write-test.txt

# 測試 GroupShare 寫入，只有 manager 對 manager-group 可成功
echo "test" > /mnt/groups/<group-name>/write-test.txt
```

在 Python 內也可以直接讀寫：

```python
from pathlib import Path

group_path = Path("/mnt/groups/aig-test")
namespace_path = Path("/mnt/namespaces/wycctest1")

print(list(group_path.iterdir()))

(namespace_path / "result.txt").write_text("hello\n")
print((namespace_path / "result.txt").read_text())
```

## 6. 設定變更後何時生效

GroupShare 的群組與 manager 設定來自 Profile annotation，例如 `group`、`manager`、`manager-group`。NamespaceShare 則依照 namespace 自動產生。

如果管理者剛修改過使用者的 group 或 manager 設定，已經在執行中的 Notebook 不一定會立即更新掛載。建議使用者：

1. 停止 Notebook。
2. 重新啟動 Notebook。
3. 若仍未出現掛載，重新建立 Notebook。

## 7. 常見問題

### 看不到 `/mnt/groups` 或 `/mnt/namespaces`

請先確認 Notebook 是用目前系統的 Notebook 建立頁面建立，並且不是很早以前建立的舊 Notebook。若仍看不到，停止後重新啟動 Notebook。

### GroupShare 可以讀但不能寫

這通常代表使用者是一般 user，不是該群組的 manager。只有 `manager-group` 對應的群組會給 manager 寫入權限。

### manager 對某個 group 還是不能寫

請確認：

1. Profile 的 `group` 有包含該群組。
2. Profile 的 `manager` 是 `manager`。
3. Profile 的 `manager-group` 有包含該群組。
4. 使用者登入身分的群組資訊也包含該群組。
5. Notebook 已重新啟動或重新建立。

### NamespaceShare 可以給誰用

只要使用者能在該 namespace 建立或使用 Notebook，就會看到該 namespace 的 NamespaceShare 掛載。它是 namespace 內共用，不是跨 namespace 共用。

### 不要手動新增 NFS volume

系統有安全檢查，會擋下未授權的 NFS server、NFS path、volume name，或不符合讀寫權限的 NFS volume。使用者應透過系統自動產生的掛載路徑使用共用資料。

## 8. 建議使用方式

GroupShare 適合放群組共用、由 manager 維護的資料。一般 user 讀取資料即可，避免誤改共同檔案。

NamespaceShare 適合放同一 namespace 內多台 Notebook 要共同使用或共同產出的資料。若需要跨群組共用，請使用 GroupShare 並由管理者設定對應 group。
