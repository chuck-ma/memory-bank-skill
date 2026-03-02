# REQ-006: 移除 memory-bank-writer 子 Agent

> 创建于: 2026-03-02  
> 状态: **待实现**  
> 优先级: P1  

---

## 背景

整个设计已发生根本性变化，但代码和文档仍保留着旧的 `memory-bank-writer` 子 Agent 角色。

**原设计（v7.0）**：
- 主 Agent 禁止直接写 `memory-bank/`
- 必须通过 `proxy_task({ subagent_type: "memory-bank-writer" })` 委托专用子 Agent 写入
- Plugin 层面通过 `Write Guard` 强制拦截：非 writer session 写 `memory-bank/` 直接 throw

**新设计目标**：
- 主 Agent 直接写 `memory-bank/`，无需委托
- 移除 writer agent 注册、Write Guard 拦截、相关 skill 规范
- 写入流程简化为：Proposal → 用户确认 → 主 Agent 直接执行

---

## 问题

当前状态存在以下不一致：
1. `plugin/memory-bank.ts` 中 Write Guard 仍然拦截主 agent 写入，强制要求走 writer 子 session
2. `src/cli.ts` 安装时仍注册 `memory-bank-writer` agent 到 `opencode.json`
3. `skills/memory-bank/SKILL.md` 和 `references/writer.md` 仍规定"主 Agent 禁止直接写，必须 delegate"
4. Key Trigger（注入到 omo 配置的 AMENDMENT B）仍要求 `proxy_task({ subagent_type: "memory-bank-writer" })`
5. `/memory-bank-refresh` 命令 front matter 仍是 `agent: memory-bank-writer`
6. REQ-005 的提醒文案中引用了 `memory-bank-writer` 调用方式

---

## 需求描述

### 1. Plugin：移除 Write Guard (`plugin/memory-bank.ts`)

**移除以下内容**：
- `WRITER_AGENT_NAME = "memory-bank-writer"` 常量
- `writerSessionIDs` Set 及其所有操作（`add`、`delete`、`has`）
- `isWriterAllowed()` 函数
- `blockWrite()` 函数及其调用点
- Write Guard 的整个拦截逻辑（在 `tool.execute.before` 中检查 writer session 权限的代码）
- `markParentDocFirstSatisfied()` 函数（它依赖 writer session 追踪）
- agent 注册事件中的 writer session 追踪逻辑

**Doc-First Gate 的 `docFirstSatisfied` 标记逻辑需同步调整**：
- 原逻辑：检测 writer 子 session 实际写入 `memory-bank/` 来标记满足
- 新逻辑：检测主 agent 直接写入 `memory-bank/` 路径（非 writer session，直接在写入行为本身标记）
- 具体：在 `tool.execute.before` 中，当写入路径匹配 `isMemoryBankPath()` 时，直接标记当前 session 的 `docFirstSatisfied = true`

**Doc-First Gate 提醒文案** (`warn` / `block` 模式)：
- 移除 `调用方式: proxy_task({ subagent_type: "memory-bank-writer", ... })`
- 改为：直接写 `memory-bank/` 下的对应文件即可

**plugin 内 prompt 文案**（注入到 system prompt 的写入说明）：
- 移除所有 `proxy_task(subagent_type="memory-bank-writer", ...)` 引用
- 改为直接写文件示例

### 2. CLI 安装：移除 writer agent 注册 (`src/cli.ts`)

**`installPluginToConfig()` 函数**：
- 移除 `writerDefaults` 对象定义
- 移除 `mergeAgent(config.agent["memory-bank-writer"], writerDefaults, "memory-bank-writer")` 调用
- 保留 `memory-reader` agent 的注册（read-only，仍有用）

**`installCommands()` 函数**：
- `/memory-bank-refresh.md` front matter 中的 `agent: memory-bank-writer` 改为不指定 agent（删除该行），让命令在主 agent 下运行

**`injectOmoKeyTrigger()` / `MEMORY_BANK_KEY_TRIGGER` 常量**：
- AMENDMENT B 的 Step W4 On confirmation 部分：
  - 移除 `proxy_task({ subagent_type: "memory-bank-writer", ... })` 调用示例
  - 改为：主 agent 直接用 write/edit 工具写 `memory-bank/` 文件

**`showHelp()` / CLI 文档**：
- 移除 `--model` 选项说明中关于 `memory-bank-writer` 的描述（若有）

### 3. Skill：更新写入规范 (`skills/memory-bank/SKILL.md`)

**写入阶段**（`### 写入阶段`）：
- 移除"主 Agent **禁止直接写入** `memory-bank/`，必须 delegate 给 `memory-bank-writer`"
- 改为：主 Agent 确认后直接用 write/edit 工具写入 `memory-bank/` 对应文件
- 移除 `proxy_task({ subagent_type: "memory-bank-writer", ... })` 调用示例

### 4. Skill 参考文档：重写写入规则 (`skills/memory-bank/references/writer.md`)

本文件名和内容均需调整（或保留文件名兼容性但内容重写）：

**移除**：
- "调用 memory-bank-writer" 的调用方式说明
- "守卫机制"章节（Plugin 层面的 writer-only 限制）
- "职责分离（Auto-Trigger 模式）"中的 writer step
- 所有 `proxy_task({ subagent_type: "memory-bank-writer", ... })` 示例

**保留/调整**：
- 触发时机表（保留，逻辑不变）
- Proposal 流程（Step 1/2 保留，Step 3 改为主 agent 直接执行写入）
- Refresh 流程（保留，但执行者从 writer 变为主 agent）
- 写入规则（MEMORY.md 更新规则、详情文件写入规则、二级索引规则）
- 区块分离规范（保留）
- 禁止行为和安全护栏（保留）

### 5. README：更新安装说明 (`README.md`)

**"安装做了什么？"表格**：
- 移除 `注册 Agent | 添加 memory-bank-writer agent（用于写入守卫）` 行
- 保留 `memory-reader` agent 的说明（如有）

### 6. 项目 Memory Bank：更新记忆 (`memory-bank/MEMORY.md`)

**Write Safety Rules 区块**：
- 移除 "主 agent **禁止**直接写 `memory-bank/`（Plugin 强制拦截）"
- 移除 "只能通过 `proxy_task(subagent_type="memory-bank-writer")` 写入，且仅允许 `.md`"
- 改为：主 agent 可直接写 `memory-bank/`，写入前需用户确认，仅允许 `.md`

**Decision Highlights 表格**：
- 移除或更新 "v7.0 Gating 架构" 条目中的 "Writer 保留 subagent（安全边界）"
- 移除 "Writer 自动触发 + Proposal" 条目（或更新为"写入确认"不再依赖 writer）

**Top Quick Answers**：
- Q4 "写入流程是什么？"：移除 `→ memory-bank-writer 执行` 部分，改为 `→ 主 Agent 直接写入`

### 7. REQ-005 提醒文案 (`memory-bank/details/requirements/REQ-005-intent-declaration-gate.md`)

**第 6 节"提醒内容"**：
- `warn` 模式和 `block` 模式中的 `调用方式: proxy_task({ subagent_type: "memory-bank-writer", ... })`
- 改为：直接使用 write/edit 工具写对应文件

---

## 影响范围汇总

| 文件 | 变更类型 | 关键内容 |
|------|----------|----------|
| `plugin/memory-bank.ts` | 删除 + 修改 | 移除 Write Guard、writerSessionIDs、blockWrite；调整 docFirstSatisfied 标记逻辑 |
| `src/cli.ts` | 删除 + 修改 | 移除 writer agent 注册；更新 Key Trigger；更新命令 front matter |
| `skills/memory-bank/SKILL.md` | 修改 | 写入阶段改为主 agent 直接写 |
| `skills/memory-bank/references/writer.md` | 重写 | 移除 writer agent 调用模式；保留写入规则本身 |
| `README.md` | 修改 | 移除 writer agent 注册行 |
| `memory-bank/MEMORY.md` | 修改 | 更新 Write Safety Rules、Decision Highlights、Quick Answers |
| `memory-bank/details/requirements/REQ-005-...` | 修改 | 提醒文案中移除 writer 调用示例 |

---

## 验收标准

1. [ ] 主 agent 可以直接写 `memory-bank/` 下的 `.md` 文件，不会被 Plugin 拦截
2. [ ] `bunx memory-bank-skill install` 不再往 `opencode.json` 中注册 `memory-bank-writer` agent
3. [ ] Key Trigger（AMENDMENT B）的 W4 步骤改为主 agent 直接写文件
4. [ ] `/memory-bank-refresh` 命令不再指定 `agent: memory-bank-writer`
5. [ ] SKILL.md 和 writer.md 中无 `proxy_task({ subagent_type: "memory-bank-writer" })` 引用
6. [ ] Doc-First Gate 的 `docFirstSatisfied` 标记仍能正常工作（改为检测主 agent 直接写 memory-bank/）
7. [ ] Doc-First Gate 的提醒文案不再引用 `memory-bank-writer` 调用方式
8. [ ] README 安装说明移除 writer agent 行
9. [ ] `plugin/memory-bank.ts` 中无 `WRITER_AGENT_NAME`、`writerSessionIDs`、`blockWrite` 残留
10. [ ] 现有读取逻辑（自动注入 MEMORY.md、Read Gate、Recovery Gate、memory-reader）不受影响

---

## 实现注意事项

- **Doc-First `docFirstSatisfied` 的新逻辑**：原来靠 writer 子 session 写 memory-bank/ 后"回调"父 session。改为：在 `tool.execute.before` 中，若当前 session 写入路径匹配 `isMemoryBankPath()`，则直接在当前 session 的 gatingState 上设置 `docFirstSatisfied = true`。`markParentDocFirstSatisfied` 和 `pendingDocFirstSatisfied` 机制可一并移除。
- **`memory-reader` 保留**：仅移除 writer，reader 逻辑不动。
- **plugin 中残留的 prompt 文案**：搜索 `memory-bank-writer` 关键词确认全部清除。

---

## 相关文档

- `plugin/memory-bank.ts` — 实现位置（Write Guard、writerSessionIDs）
- `src/cli.ts` — 安装逻辑（writer agent 注册、Key Trigger）
- `skills/memory-bank/references/writer.md` — 当前 writer 规范
- `memory-bank/details/design/design-gating-architecture.md` — Gating 架构设计（实现后更新）
