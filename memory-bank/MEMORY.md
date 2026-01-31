# Memory Bank Skill

## Project Snapshot

OpenCode 插件，为 AI 编码助手提供项目记忆系统。通过结构化 Markdown 文件持久化项目上下文，解决 AI 对话间"失忆"问题。

**核心价值**：
- **自动读取**：每次会话自动加载项目上下文
- **自动写入**：工作中沉淀发现、决策、经验
- **零初始化**：无需手动 init，随项目推进自动创建

**主要组件**：Plugin (`plugin/memory-bank.ts`) + Skill (`skills/memory-bank/`) + CLI (`src/cli.ts`)

---

## Current Focus

> 更新于: 2026-01-31

**当前焦点**：v6.1.0 统一 Task Tool 架构 - 设计完成

**下一步**：
- [ ] 实现 Plugin keyTrigger（Reader/Writer 检测）
- [ ] 实现 /memory-bank-refresh 命令
- [ ] 更新 reader.md（同步 Task 调用）
- [ ] 更新 writer.md（自动触发 + Proposal 流程）
- [x] v6.1.0 架构决策记录

**阻塞项**：无

---

## Decision Highlights

| 决策 | 日期 | 要点 |
|------|------|------|
| v6.1.0 统一 Task Tool 架构 | 2026-01-31 | Reader/Writer 全部同步 Task，掌控感 > 后台；Writer 自动触发 + Proposal 确认流程 |
| oh-my-opencode keyTrigger 集成 | 2026-01-31 | prompt_append + Oracle 改进（Step 0 措辞、精确递归保护、双 orchestrator、60s TTL），production-ready |
| Skill 与 Plugin 分层互补 | 2026-01-31 | Plugin 提供最小行为闭环，Skill 提供完整规范和 fallback |
| memory-reader 并行子任务 | 2026-01-31 | 解决 AI 不信任摘要问题，后台读取+Evidence 证据链 |
| 合并 writer skill 到 references/ | 2026-01-28 | 避免两个独立 skill 的 manifest 同步问题 |
| patterns.md 主动触发规则 | 2026-01-29 | 技术选型/新模块/架构决策时主动读取 |
| SKILL.md 描述性引用格式 | 2026-01-29 | 用自然语言说明"何时该读"，而非纯表格链接 |

完整技术决策见 [details/patterns.md](details/patterns.md)

---

## Routing Rules

| 场景 | 目标文件 |
|------|----------|
| 技术栈/环境/命令 | [details/tech.md](details/tech.md) |
| 技术决策/代码约定 | [details/patterns.md](details/patterns.md) |
| 完成状态/历史变更 | [details/progress.md](details/progress.md) |
| 设计文档 | [details/design/index.md](details/design/index.md) |
| 需求池 | [details/requirements/index.md](details/requirements/index.md) |
| 经验沉淀 | [details/learnings/index.md](details/learnings/index.md) |
