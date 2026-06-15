# GroupShare 使用者掛載路徑指南

平台會透過 `PodDefault/groupshare` 自動掛載：

- 路徑格式：`/mnt/groups/<group_name>`
- 例：`/mnt/groups/ai-team`

使用者建立 Notebook 時不需要選 Configurations，也不需要手動加 `groupshare` label。

## Notebook 端檢查

```bash
df -h | grep /mnt/groups
ls /mnt/groups
```

## 權限行為

- 一般使用者（非 adminGroups）：掛載為只讀（RO）
- 管理群組（adminGroups）：允許讀寫（RW）

## 安全限制

- 不可自定義 `/group*` NFS path
- NFS server 必須與平台一致
- 只允許 `gs-` 白名單 volume
- NFS path 必須落在 namespace 對應的 groupshare 白名單
