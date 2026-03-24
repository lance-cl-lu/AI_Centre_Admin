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
- volume 名稱固定加前綴 `gs-`

範例：`Lab_Vision! 2023` -> `gs-lab-vision-2023`

## Controller 產物

每個 Profile namespace 會維護一個 `PodDefault/groupshare`：

- `selector.matchLabels.groupshare=enabled`
- `volumes[].nfs.path` 由 `NFS_PATH/<sanitized_group>` 產生（例如 `NFS_PATH=/kflow_dev/shared`）
- `mountPath=/mnt/groups/<sanitized_group>`
