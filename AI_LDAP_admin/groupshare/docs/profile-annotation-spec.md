# Profile Annotation 規範指南

GroupShare 以 `Profile.metadata.annotations` 為單一真理來源。
`group` 與 `manager-group` 由 Account Manager UI 維護並回寫到 Profile annotations。

## Annotation 欄位

- `group`: 使用者所屬群組清單，逗號分隔
- `manager`: 使用者角色（`user` 或 `manager`）
- `manager-group`: 具管理權限的群組清單，逗號分隔

範例：

```yaml
metadata:
  annotations:
    group: "A, B,, C "
    manager: "manager"
    manager-group: "B, X"
```

## 解析規則

1. Split & Trim：以 `,` 分割並移除前後空白
2. Remove Empty：移除空字串
3. Deduplicate：去除重複
4. Intersect：`adminGroups = intersect(groups, manager_groups)`
5. manager-group 中若不存在於 group，記錄 warning 並忽略

## 命名轉換規則

群組名稱在系統中會轉成安全 token：

- 轉小寫
- 非 `a-z0-9-` 字元轉為 `-`
- 連續 `-` 合併
- 去除頭尾 `-`
- 名稱含中文等非 ASCII 字元、轉換後為空，或超過 60 字元時，後面加上完整名稱 UTF-8 的 SHA-256 前 8 碼（`<token>-<hash>`；轉換後為空則為 `g-<hash>`），避免不同群組對應到同一個資料夾
- volume 名稱固定加前綴 `gs-`（總長不超過 63）

範例：

| 群組名稱 | token | volume |
|---|---|---|
| `Lab_Vision! 2023` | `lab-vision-2023` | `gs-lab-vision-2023` |
| `馬誠佑_lab` | `lab-7a249574` | `gs-lab-7a249574` |
| `楊智淵_lab` | `lab-4bd4114e` | `gs-lab-4bd4114e` |
| `王佑中教授實驗室` | `g-c4be5913` | `gs-g-c4be5913` |

後端（`api/groupshare_storage.groupshare_group_token`）、controller（`parser.group_token`）與 webhook（`rules.group_token`）必須使用同一規則，三邊測試共用同一組範例。

## Controller 產物

每個 Profile namespace 會維護一個 `PodDefault/groupshare`：

- `spec.selector={}`，代表套用到該 Profile namespace 內所有 Notebook
- `volumes[].nfs.path` 由 `NFS_PATH/<token>` 產生（例如 `NFS_PATH=/Public/shared`）
- `mountPath=/mnt/groups/<token>`
