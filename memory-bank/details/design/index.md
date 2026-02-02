# 设计文档索引

| 文档 | 说明 |
|------|------|
| [design-single-entry-migration.md](design-single-entry-migration.md) | 单入口迁移设计：Phase 1 兼容 → Phase 2 搬家 → Phase 3 收口 |
| [design-write-guard.md](design-write-guard.md) | 写入守卫设计：v5.9.0 分段检查改进 |
| [design-writer-delegation.md](design-writer-delegation.md) | 写入流程职责分离：主 Agent 只传诉求，Writer 自主判断写入目标 |
| [design-memory-first-v2.md](design-memory-first-v2.md) | Memory-first V2：极简注入 + 职责分离 |
| [design-dir-cleanup.md](design-dir-cleanup.md) | 目录清理机制：Writer 写入时自动检查并清理 |
| [design-organize.md](design-organize.md) | 整理记忆设计：AI 自动分析文件分类 |
| [design-reminder-types.md](design-reminder-types.md) | 提醒类型设计：INIT/UPDATE 提醒类型与去重规则 |
| [design-auto-commit.md](design-auto-commit.md) | 自动提交设计：Memory Bank 自动提交机制 |
| [design-archive.md](design-archive.md) | 归档功能设计：归档触发条件与流程 |
| [design-transparency.md](design-transparency.md) | 读写透明设计：读写透明性与提示机制 |
| [testing-locally.md](testing-locally.md) | 本地测试指南：如何在本项目测试插件 |
| [design-gating-architecture.md](design-gating-architecture.md) | v7.0 Gating 架构：Plugin Runner + 写前拦截 + Reader 去 subagent |
| [design-index-first-architecture.md](design-index-first-architecture.md) | v7.1 Index-First + Direct-First 架构：意图驱动路由 + 两层读取协议 |
