# v7.1 Index-First + Direct-First 架构设计

> 日期：2026-02-02 | 来源：wechat_context 知识库设计启示 + Oracle 三轮讨论共识

---

## 设计来源

本设计受 **wechat_context** 项目知识库实现的启发。该项目的核心设计：

1. **Core Concept 注入**：将根索引 `_index.md` 直接注入到 system prompt，包含：
   - 维度路由规则（by-workflow vs by-topic）
   - 高频 Quick Answers（可直接回答，无需工具调用）
   - 使用规则与触发指引

2. **按需加载**：非核心内容通过递归 drill-down 获取
   - Two-Head Decision：content_judge（当前内容是否足够）+ router（该下钻到哪）

3. **关键洞察**：不需要 MCP Reader，让 LLM 直接读文件就够了

---

## 核心问题

### 问题 1：Agent 不知道该读哪个文件

当前 Routing Rules 是**主题导向**的：
```
| 场景 | 目标文件 |
| 技术栈/环境/命令 | details/tech.md |
| 技术决策/代码约定 | details/patterns.md |
```

Agent 的困惑：*"我想改注入逻辑，这属于'技术栈'还是'技术决策'？"*

结果：**猜错文件 or 幻觉出不存在的路径**

### 问题 2：Reader 调用开销大，但不调又容易幻觉

- 调 memory-reader：一次 subagent = 额外 10-20s + token 开销
- 不调：agent 自己读可能读错、读漏、或编造信息

### 问题 3：MEMORY.md 的内容策略不清晰

- 什么该放 L1（始终注入）？
- 什么该放 L2（按需加载）？
- 优化目标是"小"还是"有用"？

---

## 核心共识

经过与 Oracle 三轮挑战讨论，达成以下共识：

1. **L1 要有用而不只是小** — 优化目标是 `min(固定注入 + 期望 drill)`
2. **两层足够** — 不强推 details/index.md，用 glob 兜底
3. **Reader 去强依赖** — 小读取直接读，大读取用 reader
4. **信息密度三段式** — 结论优先 + 边界条件 + 指针
5. **分层注入用确定性触发** — 不做"复杂度判断"

---

## 解决方案

### 1. Routing Rules（意图驱动）

**改变**：从"主题导向"改为"行动导向"

| 你想做什么 | 读这些文件 |
|------------|-----------|
| 改注入内容/截断预算 | `plugin/memory-bank.ts` |
| 改写前拦截/GUARD_MODE | `details/design/design-gating-architecture.md` |
| 做发布/安装/常用命令 | `details/tech.md` + `README.md` |
| 不确定文件名 | 先 `glob` 再读 |

**本质**：把"判断主题"的心智负担从 agent 转移到文档设计者。Agent 只需匹配意图，不用分类。

### 2. Drill-Down Protocol（两层读取协议）

定义一个**确定性的流程**，避免"要么全用 reader，要么乱读"：

```
Step 1: 自己直接读 1-3 个文件（快、便宜、够用就停）
           ↓ 不够
Step 2: 调 memory-reader（并行读多个 + 输出结构化证据）
           ↓ 
Step 3: 回答时必须给引用路径（防止幻觉）
```

**本质**：日常小任务不触发 reader，省开销；复杂任务才升级，保证质量。

**memory-reader 确定性触发条件**（不用"复杂度"判断）：
- ✅ 用户明确要求"引用/依据/证据/给出处"
- ✅ 需要输出 conflicts（怀疑文档过时、实现与记忆可能矛盾）
- ✅ 需要跨多个 details 汇总成一个 context pack
- ✅ 目标文件数 > 3 或预估总行数 > 300

### 3. Reader 去强依赖

| 场景 | 策略 |
|------|------|
| 小读取（1-3 个短文件） | 主 agent 直接 `read/glob/grep` |
| 大读取（跨文件汇总/证据链/冲突检测） | `proxy_task(memory-reader)` |

**理由**：
- memory-reader 的核心价值是并行、结构化输出、隔离上下文污染
- 不是每次读取都需要这些能力
- 小读取用 subagent 反而增加调度开销

### 4. Gating 门槛调整

| 当前 | 改进后 |
|------|--------|
| 读过 MEMORY.md 就算满足 | 高风险写前必须读 `patterns.md` 或调用过 `memory-reader` |

**理由**：MEMORY.md 是 L1 概览，不保证包含实现约束。`patterns.md` 才是约束集合。

### 5. MEMORY.md 新模板结构

```
# Project Memory

## Project Snapshot
- 结论（一句话）+ 边界 + 指针

## Current Focus
- 结论（当前焦点）+ 下一步 3 条 + 阻塞项
- 保持极短，完成记录放 progress.md

## Decision Highlights (Still Binding)
- 只保留"仍影响当前实现"的决策
- 完整历史归档到 patterns.md

## Routing Rules（意图驱动）
- 按"你现在要做什么"选 1-3 个文件
- 每条规则：意图触发 → 目标文件
- 找不到文件名时先 glob

## Drill-Down Protocol
- Step 1: Direct read 1-3 个 details
- Step 2: 需要证据链/冲突/跨文件 → memory-reader
- Step 3: 对外回答必须给引用指针

## Write Safety Rules
- 主 agent 禁止直接写 memory-bank/
- 只能通过 memory-bank-writer 写入
- 写入前必须 Proposal → 确认

## Top Quick Answers（限量 8 条）
- 高频问题 → 最短可执行答案 + 指针
- 过期就删或改指针
```

---

## 实施变更清单

### Plugin 行为变更

| 变更点 | 具体改动 |
|--------|----------|
| 注入内容 | 仍注入 MEMORY.md verbatim，但 MEMORY.md 本身按新模板重构 |
| Protocol 文案 | `drill_down` 改为 direct-first；`gating` 写明 patterns.md 门槛 |
| Gating 满足条件 | 从"读过 MEMORY.md 就行"改为"读过 patterns.md 或调用过 memory-reader" |
| 错误提示 | 统一为"请先执行: read({ filePath: 'memory-bank/details/patterns.md' })" |

### Skill 规范变更

| 文件 | 变更 |
|------|------|
| SKILL.md | 默认 direct-first；memory-reader 定位为"升级路径" |
| reader.md | 开头加"Direct-first 读取流程"；memory-reader 触发条件写成确定性 |
| writer.md | 初始化模板用新结构；不强制创建 details/*/index.md |

---

## 工作量估算

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 重写 MEMORY.md | Quick (<1h) | P0 |
| 更新 Plugin Protocol 文案 | Short (1-4h) | P0 |
| 调整 Gating 满足条件 | Short (1-4h) | P1 |
| 更新 SKILL.md/reader.md/writer.md | Short (1-4h) | P1 |
| **合计** | **Medium (1-2d)** | |

---

## 设计原则回顾

### 两层足够原则

当前结构已经是 `MEMORY.md → details/*.md`，只有两层。

**不强推 details/index.md 的理由**：
- wechat_context 需要递归索引是因为知识库很深（by-topic → professional-knowledge → pcos → ...）
- 我们的 memory-bank 结构扁平得多
- 用 `glob` 可以兜底找文件名

**触发条件**（才加 index.md）：
- details/ 文件数 > 8 或主题明显分叉
- 维护者开始"找不到该读哪个"

### 信息密度三段式

每段内容都按：**结论优先 + 边界条件 + 指针**

示例：
```markdown
## Project Snapshot
- **结论**：这是一个 OpenCode 插件 + Skill + CLI 组合，用结构化 Markdown 持久化项目上下文
- **边界**：本文件只保留"仍影响当下实现决策"的信息
- **指针**：核心实现 `plugin/memory-bank.ts`；Skill 入口 `skills/memory-bank/SKILL.md`
```

### 确定性触发 vs 复杂度判断

**不做"复杂度判断"的理由**：
- 判断错误的代价很高
- 用确定性规则（关键词/操作类型/文件数阈值）更稳定
- 误判可控且可解释

---

## Oracle 讨论要点摘录

### 关于 L1 体积

> 你对"L1 要有用而不只是小"的挑战是对的：优化目标应该是最小化"总 token = 固定注入 + 期望 drill-down"，而不是把 MEMORY.md 机械压到 400–800 tokens。

### 关于 Reader 保留

> 把"去 subagent 化"改为"去强制依赖 subagent"：小读取主 agent 直接读；大读取继续用 memory-reader 做并行+YAML+evidence/conflicts。

### 关于 Quick Answers

> L1 可以有 Quick Answers，但必须"限量 + 可证据化 + 强制指向 source-of-truth"。一旦 L1 塞了太多"操作性建议"，很快会和代码/决策不一致。

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-02-02 | 初稿：基于 wechat_context 启示 + Oracle 三轮讨论达成设计共识 |
