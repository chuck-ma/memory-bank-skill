# 设计文档索引

## 现行设计（v7.x）

| 文档 | 说明 |
|------|------|
| [design-gating-architecture.md](design-gating-architecture.md) | v7.0 Gating 架构：Plugin Runner + 写前拦截 |
| [design-index-first-architecture.md](design-index-first-architecture.md) | v7.1 Index-First + Direct-First 架构：意图驱动路由 + 两层读取协议 |
| [design-index-first-implementation.md](design-index-first-implementation.md) | v7.1 Index-First 实现方案：迁移/初始化/Gating/Protocol 详细设计 |
| [design-template-upgrade.md](design-template-upgrade.md) | v7.0 → v7.1 模板升级：Append-Only 策略 + 版本检测 |
| [design-session-anchors.md](design-session-anchors.md) | Session Anchors v3：压缩后恢复机制 + Recovery Gate（待实现） |
| [testing-locally.md](testing-locally.md) | 本地测试指南：如何在本项目测试插件 |

## 历史设计（Legacy）

> 以下文档为历史版本设计，可能与当前实现不一致。仅供参考。

| 文档 | 说明 | 状态 |
|------|------|------|
| [design-single-entry-migration.md](design-single-entry-migration.md) | 单入口迁移设计 | v6.x，已由 v7.1 模板替代 |
| [design-write-guard.md](design-write-guard.md) | 写入守卫设计 | v5.9.0，部分逻辑沿用 |
| [design-writer-delegation.md](design-writer-delegation.md) | 写入流程职责分离 | v6.x，部分逻辑沿用 |
| [design-memory-first-v2.md](design-memory-first-v2.md) | Memory-first V2 | v6.x，已由 v7.1 替代 |
| [design-dir-cleanup.md](design-dir-cleanup.md) | 目录清理机制 | v6.x |
| [design-organize.md](design-organize.md) | 整理记忆设计 | v6.x |
| [design-reminder-types.md](design-reminder-types.md) | 提醒类型设计 | v6.x，提醒链路当前禁用 |
| [design-auto-commit.md](design-auto-commit.md) | 自动提交设计 | 未实现 |
| [design-archive.md](design-archive.md) | 归档功能设计 | v6.x |
| [design-transparency.md](design-transparency.md) | 读写透明设计 | v6.x |
