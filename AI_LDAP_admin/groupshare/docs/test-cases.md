# GroupShare 測試與驗證

## 自動化測試

執行：

```bash
cd /home/mark/work/AI_Centre_Admin/AI_LDAP_admin/groupshare
python -m unittest discover -s tests -p 'test_*.py'
```

涵蓋：

- Controller 解析：`group: 'A, B,, C ', manager: 'manager', manager-group: 'B, X'`
  - 期望 `groups=['A','B','C']`
  - 期望 `adminGroups=['B']`
  - 期望產生 `X` 的 warning
- Controller 命名：`Lab_Vision! 2023` -> `gs-lab-vision-2023`
- Webhook Rule A：`path: /group/hr_data` 必須拒絕
- Webhook Rule B：NFS path 不在白名單必須拒絕
- Webhook Rule C：非管理者將 `readOnly=false` 必須拒絕
- Webhook Rule D：缺少 `groupshare=enabled` label 必須拒絕

## 整合測試

1. 部署 webhook 並確認 `failurePolicy: Fail`
2. 將 `groupshare-validating-webhook` service 或 deployment 下線
3. 發送 Notebook CREATE 請求
4. 請求應失敗（驗證 fail-closed 生效）
