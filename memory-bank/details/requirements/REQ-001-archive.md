# REQ-001: Memory Bank 归档功能

## Status
Accepted

## Summary
为 Memory Bank 增加归档能力，将 `active.md` 中已完成/已落地内容移入归档文件，保持自动加载上下文精简，同时保留历史追溯。

## Acceptance Criteria
- [ ] 当 `active.md` 超过 120 行或已完成条目超过 20 条时，触发归档（已完成条目按 `- [x]` 统计）
- [ ] 归档文件写入 `memory-bank/archive/active_YYYY-MM.md`
- [ ] `active.md` 仅保留当前焦点、下一步、阻塞项、最近 30 天变更
- [ ] 归档文件加入 `memory-bank/_index.md`

## Notes
插件提醒暂不实现；归档由 AI 在更新 Memory Bank 时执行。

## History
| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-01-23 | 创建需求 | - |
