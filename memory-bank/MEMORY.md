# Memory Bank Skill

<!-- MACHINE_BLOCK_START -->
<!-- MEMORY_BANK_TEMPLATE:v7.1 -->

## Project Snapshot
- **结论**: OpenCode 插件 + Skill + CLI，通过结构化 Markdown 持久化项目上下文，解决 AI 对话间"失忆"问题
- **边界**: 本文件只保留仍影响当下实现的信息；详细内容在 `memory-bank/details/`
- **指针**: 核心实现 `plugin/memory-bank.ts`；Skill 入口 `skills/memory-bank/SKILL.md`；CLI `src/cli.ts`

## Current Focus
> 更新于: 2026-02-13

- **当前焦点**: REQ-006 Writer 轻量化改造 — 去 subagent，主 agent 直写
- **下一步**:
  - [ ] 实现 Plugin 改造
  - [ ] Skill 更新
  - [ ] CLI 更新
  - [ ] 发版
- **阻塞项**: 无

## Decision Highlights (Still Binding)

> 只保留"仍影响当前实现"的决策。完整历史见 `memory-bank/details/patterns.md`。

| 决策 | 日期 | 对实现的直接约束 |
|------|------|-----------------|
| Writer 轻量化：去 subagent 直写 | 2026-02-13 | 主 agent 直接写 memory-bank/，Plugin 注入 writing guideline（advisory），.md 硬限制保留，bash 写仍阻止 |
| v7.1 Index-First + Direct-First | 2026-02-02 | 意图驱动路由 + direct-first 读取 + patterns.md gating 门槛 |
| v7.0 Gating 架构 | 2026-02-01 | Plugin 写前拦截 + Writer 保留 subagent（安全边界） |
| Skill 与 Plugin 分层互补 | 2026-01-31 | Plugin 提供最小行为闭环，Skill 提供完整规范和 fallback |
| Writer 自动触发 + Proposal | 2026-01-31 | 写入前必须 Proposal → 用户确认 → Writer 执行 |

## Routing Rules（意图驱动）

按"你想做什么"选择 1-3 个最相关的文件读取。

### 通用意图

| 意图 | 目标文件 |
|------|----------|
| 了解技术栈/命令/环境 | `memory-bank/details/tech.md` |
| 查看技术决策/约定 | `memory-bank/details/patterns.md` |
| 查看进度/最近变更 | `memory-bank/details/progress.md` |
| 查找设计文档 | `memory-bank/details/design/index.md` |
| 查找需求文档 | `memory-bank/details/requirements/index.md` |
| 查找踩坑经验 | `memory-bank/details/learnings/index.md` |
| 不确定文件名 | 先 `glob("memory-bank/details/**/*.md")` 再读 |

### 项目特定意图（按需添加）

| 意图 | 目标文件 |
|------|----------|
| 改注入逻辑/截断/Protocol | `plugin/memory-bank.ts` |
| 改写前拦截/Gating | `memory-bank/details/design/design-gating-architecture.md` |
| 改 v7.1 架构设计 | `memory-bank/details/design/design-index-first-architecture.md` |
| 改压缩后恢复机制 | `memory-bank/details/design/design-session-anchors.md` |
| 改 CLI 安装逻辑 | `src/cli.ts` |

## Drill-Down Protocol

1. **先用 MEMORY.md 给出可执行结论**；需要证据/细节时再按路由 drill-down
2. **默认 direct read 1-3 个 details/ 文件**（读够就停）
3. **升级条件**：需要证据链/冲突检测/跨文件汇总 → 调用 `memory-reader`
4. **反幻觉**：未读到/未写明的信息 = 未知，不要补全
5. **回答时必须给引用指针**（至少 1-2 个文件路径）

## Write Safety Rules

- 主 agent 直接 write/edit 写入 `memory-bank/`，Plugin 注入 writing guideline（advisory）
- 仅允许 `.md` 文件（硬限制保留）
- Bash 写入 memory-bank/ 仍阻止（只允许 write/edit 等结构化工具）
- 写入前必须 Proposal → 用户确认
- 禁止写入任何敏感信息（API key、token、密码、私钥）

## Top Quick Answers

> 最多 8 条；必须可验证；每条给文件指针。过期就删。

1. Q: 如何安装？
   A: `bunx memory-bank-skill install` → 详见 `README.md`

2. Q: 插件加载失败？
   A: 运行 `bunx memory-bank-skill doctor` 诊断 → 详见 `README.md#常见问题`

3. Q: Gating 模式有哪些？
   A: off / warn（默认）/ block → 详见 `memory-bank/details/patterns.md` v7.0 节

4. Q: 写入流程是什么？
   A: Proposal → 用户确认 → 主 agent 直接 write/edit 执行 → 详见 `skills/memory-bank/references/writer.md`

<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
<!-- USER_BLOCK_END -->
