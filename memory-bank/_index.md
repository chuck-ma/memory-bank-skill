# Memory Bank 索引

| path | title | summary | updated | size |
|------|-------|---------|---------|------|
| brief.md | 项目概述 | OpenCode 插件，项目记忆系统 | 2026-01-27 | 32 |
| tech.md | 技术栈 | TypeScript + Bun + OpenCode Plugin API | 2026-01-23 | 55 |
| active.md | 当前焦点 | v5.18.0 Writer 调用方式迁移 | 2026-01-30 | 55 |
| patterns.md | 技术决策与约定 | Skill 结构、patterns 触发规则、SKILL.md 引用格式 | 2026-01-29 | 51 |
| docs/testing-locally.md | 本地测试指南 | 如何在本项目测试插件而不影响全局配置 | 2026-01-27 | 62 |
| docs/design-organize.md | 整理记忆设计 | AI 自动分析文件分类，给出迁移和新建目录建议 | 2026-01-27 | 138 |
| docs/design-dir-cleanup.md | 目录清理机制设计 | 简化版：Writer 写入时自动检查并清理 | 2026-01-28 | 215 |
| docs/design-auto-commit.md | 自动提交设计 | Memory Bank 自动提交机制设计文档 | 2026-01-23 | 157 |
| docs/design-archive.md | 归档功能设计 | 归档 active.md 的触发条件与流程 | 2026-01-23 | 93 |
| docs/design-transparency.md | 读写透明设计 | 读写透明性与提示机制设计 | 2026-01-23 | 130 |
| docs/design-reminder-types.md | 提醒类型设计 | INIT/UPDATE 提醒类型与去重规则 | 2026-01-23 | 123 |
| docs/design-write-guard.md | 写入守卫设计 | v5.9.0：分段检查改进 | 2026-01-29 | 285 |
| docs/design-memory-first-v2.md | Memory-first V2 | 已实现：极简注入 + 职责分离 | 2026-01-28 | 58 |
| docs/design-writer-delegation.md | 写入流程职责分离 | 主 Agent 只传诉求，Writer 自主判断写入目标 | 2026-01-28 | 72 |
| requirements/REQ-001-archive.md | 归档需求 | Memory Bank 归档功能需求 | 2026-01-23 | 21 |
| learnings/bugs/2026-01-28-bun-registry-sync-delay.md | Bun Registry 同步延迟 | 刚发布的版本需 `bun pm cache rm` 才能安装 | 2026-01-28 | 30 |
| learnings/bugs/2026-01-27-opencode-cache-inconsistency-crash.md | 缓存版本不一致崩溃 | OpenCode 缓存版本不一致导致 Bun segfault | 2026-01-27 | 58 |
| learnings/bugs/2026-01-15-memory-bank-update-forgotten.md | 更新遗忘问题 | Todo 驱动工作流遗漏 Memory Bank 沉淀 | 2026-01-15 | 44 |
| learnings/integrations/2026-01-29-skill-references-structure.md | Skill references 目录结构验证 | 验证 references/ 符合官方规范 | 2026-01-29 | 35 |
| learnings/integrations/2026-01-29-progressive-disclosure.md | Progressive Disclosure 设计理念 | 渐进式披露：入口层路由，详情层兑现；索引质量 = 路由信息 | 2026-01-29 | 60 |
