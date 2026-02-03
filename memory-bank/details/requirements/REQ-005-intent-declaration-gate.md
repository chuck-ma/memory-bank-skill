# REQ-005: 文档先行机制 (Doc-First Gate)

> 创建于: 2026-02-03
> 状态: **Design Finalized (Oracle 3 轮对抗 + dogfood 反馈，已收敛)**
> 优先级: P1
> Oracle 审查: 2026-02-03，3 轮对抗
> 更新: 2026-02-03，dogfood 发现默认 off 导致 Gate 形同虚设，改为默认 warn + 前置存在检查

## 核心理念

> **任何变更之前，都要先有文档沉淀。**
> 即便改动很简单，只有几个字，也需要记录。

先在 Memory 里沉淀，明确做什么、为什么、怎么做，然后才动手。

## 问题背景

当前 Gating 机制检查"是否读过上下文"，但没有检查"是否先沉淀了工作内容"。

**现象**：
- AI 读了 patterns.md 就开始动手
- 不清楚自己在修 Bug 还是做 Feature 还是重构
- 做完后不知道该往哪个 Memory Bank 分类沉淀
- 工作缺乏主线，事事无回应

**根因**：
- Gating 只检查"读"，不检查"写文档"
- 没有强制"文档先行"的机制

## 用户故事

> 作为一个使用 Memory Bank 的开发者，
> 我希望 AI 在写代码时收到一个"文档先行"的提醒，
> 建议它先用 MemoryWriter 沉淀工作内容，
> 并把文档沉淀作为第一优先级的 todo。
>
> 这个提醒是**建议性的 warning**，跟配置走。

---

## Oracle 共识（必须遵循）

### 共识 1. 检测机制：实际写入而非调用意图

**问题**：`tool.execute.before` 只能看到 `proxy_task` 调用，看不到 writer 是否写成功。

**共识**：
- ❌ 不检测 `proxy_task(subagent_type="memory-bank-writer")` 调用
- ✅ 检测 writer 子 session 的**实际写入行为**
- 复用现有机制：`writerSessionIDs` 追踪 + `isMemoryBankPath()` 判断
- 标记时机：在 Write Guard 判定"writer agent 写入允许"之后标记（非 hook 入口处）
- 通过 `parentID` 关联回父 session，标记其当前 gatingKey 的 `docFirstSatisfied`

**父 session 关联兜底**：
- 如果父 session 的 `lastUserMessageKey` 尚未设置，存入 session 级 `pendingDocFirstSatisfied=true`
- 下次该 session 创建新的 gatingKey 时，自动继承 pending 状态

### 共识 2. 触发规则：代码文件专用模式

**问题**：`TRACKABLE_FILE_PATTERNS` 包含 .md/.json/.yaml/.css 等，触发过于宽泛。

**共识**：
- ❌ 不直接复用 `TRACKABLE_FILE_PATTERNS`
- ✅ 定义独立的 `DOC_FIRST_FILE_PATTERNS`（仅代码文件）

```typescript
const DOC_FIRST_FILE_PATTERNS = [
  /\.py$/, /\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/,
  /\.go$/, /\.rs$/, /\.vue$/, /\.svelte$/,
]
```

**不包含**：.md, .json, .yaml, .yml, .toml, .css, .scss, .html（这些是配置/文档/样式，不要求文档先行）

### 共识 3. 配置独立：新增 DOC_FIRST_MODE

**共识**：
- ✅ 新增环境变量 `MEMORY_BANK_DOC_FIRST_MODE`
- 可选值：`off` | `warn`（**默认**）| `block`
- 独立于 `MEMORY_BANK_GUARD_MODE`，互不干扰

### 共识 4. Gate 顺序与防冲突

**执行顺序**：
```
tool.execute.before:
1. Recovery Gate     — 压缩后必须重读 anchor（最高优先级）
2. Read Gate         — 必须读过 patterns.md
3. Doc-First Gate    — 建议/要求先写文档（本需求）
4. Write Guard       — memory-bank/ 写权限控制
```

**豁免规则**：
- Doc-First Gate 不阻止写 `memory-bank/` 路径（避免死锁）
- Doc-First Gate 不阻止 Recovery 解锁操作

**防双重提醒**：
- 如果 Read Gate 已在本消息轮次发出 warning（`warnedThisMessage=true`），Doc-First Gate 的 warn 不再叠加
- 避免同一次写操作收到两条提醒

### 共识 5. 已知限制（v1 范围外）

以下场景 v1 不处理，明确为 out-of-scope：
- **Bash 写入绕过**：`sed -i`, `echo >`, generators 等通过 bash 的写操作不触发 Doc-First
- **写入成功确认**：`tool.execute.before` 无法确认写入是否真正成功，接受"被允许的写入"语义

### 共识 6. 前置检查：memory-bank 存在性（dogfood 反馈）

**问题**：默认 `off` 时 Doc-First Gate 形同虚设，改为 `warn` 后对没有 memory-bank 的项目会"提醒了但没法满足"。

**共识**：
- ✅ Doc-First Gate 触发前，先检查 `memory-bank/` 目录是否存在
- **不存在** → 不发 Doc-First 提醒，改为发"建议初始化 Memory Bank"提醒（复用 `initReminderFired`，session 内只提醒一次）
- **存在** → 正常走 Doc-First 流程
- 提醒内容：`"项目尚未启用 Memory Bank，建议运行 /memory-bank-refresh 初始化"`
- 复用现有 `checkMemoryBankExists()` + `memoryBankExistsCache` 缓存机制（无额外 IO 开销）

---

## 需求描述

### 1. 行为定义

| DOC_FIRST_MODE | 行为 |
|----------------|------|
| `off` | 不提醒 |
| `warn` | 写代码文件时发出 warning，建议先写文档（不阻止）（**默认**） |
| `block` | 写代码文件时阻止，要求先写文档 |

### 2. 文档分类

| 工作类型 | 文档位置 | 文件命名示例 |
|----------|----------|-------------|
| Bug 修复 | `learnings/` | `2026-02-03-token-expiry-bug.md` |
| 新功能 | `requirements/` | `REQ-xxx.md` |
| 重构/优化 | `design/` | `design-xxx.md` |
| 配置/依赖 | `progress.md` 或 `patterns.md` | 追加记录 |

### 3. 触发条件

**何时触发**：
- AI 尝试写入匹配 `DOC_FIRST_FILE_PATTERNS` 的文件（代码文件）
- 且目标路径**不在** `memory-bank/` 下
- 且 `memory-bank/` 目录存在（前置检查）
- 且本消息轮次 `docFirstSatisfied = false`
- 且 `DOC_FIRST_MODE != off`
- 且 Read Gate 未在本轮发出 warning（`warnedThisMessage = false`，防双重提醒）

**何时跳过**：
- `DOC_FIRST_MODE = off`
- `memory-bank/` 目录不存在（改为发"建议初始化"提醒，session 内一次）
- 写入非代码文件
- 写入 `memory-bank/` 路径
- 本轮已 satisfied
- Read Gate 已发出 warning（由 Read Gate 覆盖）

### 4. 实现流程

```
AI 调用 write/edit/patch
    │
    ├─ [Recovery Gate] 压缩恢复检查（已有）
    │
    ├─ [Read Gate] 上下文检查（已有）
    │       如果 warned → 标记 warnedThisMessage，Doc-First 不再叠加
    │
    ├─ [Doc-First Gate] ← 默认启用（warn）
    │   ├─ DOC_FIRST_MODE = off → 跳过
    │   ├─ memory-bank/ 不存在 → 发"建议初始化"提醒（session 内一次，复用 initReminderFired）→ 跳过
    │   ├─ 目标是 memory-bank/ → 跳过
    │   ├─ 不匹配 DOC_FIRST_FILE_PATTERNS → 跳过
    │   ├─ docFirstSatisfied = true → 跳过
    │   ├─ warnedThisMessage = true → 跳过（Read Gate 已提醒）
    │   ├─ docFirstWarned = true → 跳过（本轮已提醒过）
    │   │
    │   ├─ warn → ⚠️ 发 warning，标记 docFirstWarned
    │   └─ block → ❌ throw Error
    │
    └─ [Write Guard] memory-bank/ 写权限控制（已有）
            └─ writer session 写 memory-bank/ 成功 → 标记父 session docFirstSatisfied
```

### 5. 状态追踪

```typescript
interface MessageGatingState {
  // 已有字段
  readFiles: Set<string>
  contextSatisfied: boolean
  warnedThisMessage: boolean
  
  // Doc-First 新增
  docFirstSatisfied: boolean    // writer 实际写入了 memory-bank/
  docFirstWarned: boolean       // 本轮已发出 doc-first 提醒
}

// Session 级别兜底（处理 parentKey 竞态）
interface SessionMeta {
  // ...已有字段...
  pendingDocFirstSatisfied: boolean  // 新增：等待关联到具体 gatingKey
}
```

### 6. 提醒内容

**warn 模式**：
```
⚠️ [Doc-First] 建议先沉淀工作文档再写代码。

请用 MemoryWriter 先记录你要做什么，并作为第一优先级 todo：
• 修 Bug / 踩坑 → learnings/YYYY-MM-DD-xxx.md
• 新功能 / 需求 → requirements/REQ-xxx.md
• 重构 / 优化 → design/design-xxx.md
• 简单变更 → 追加到 progress.md

调用方式：proxy_task({ subagent_type: "memory-bank-writer", ... })
```

**block 模式**：
```
❌ [Doc-First Gate] 请先沉淀工作文档再写代码。

请用 MemoryWriter 先记录你要做什么：
• 修 Bug / 踩坑 → learnings/YYYY-MM-DD-xxx.md
• 新功能 / 需求 → requirements/REQ-xxx.md
• 重构 / 优化 → design/design-xxx.md
• 简单变更 → 追加到 progress.md

调用方式：proxy_task({ subagent_type: "memory-bank-writer", ... })
写完文档后再执行代码修改。
```

---

## 验收标准

1. [ ] 新增 `MEMORY_BANK_DOC_FIRST_MODE` 环境变量（off/warn/block，**默认 warn**）
2. [ ] `DOC_FIRST_MODE=warn`（默认）：写代码文件且未写 MB 文档，发出 warning（不阻止）
3. [ ] `DOC_FIRST_MODE=block`：写代码文件且未写 MB 文档，阻止执行
4. [ ] `DOC_FIRST_MODE=off`：不触发 Doc-First 提醒
5. [x] 检测 writer session 的**实际写入**（在 Write Guard 允许后标记）
6. [x] 使用独立的 `DOC_FIRST_FILE_PATTERNS`（仅代码文件），不复用 TRACKABLE 或 assessWriteRisk()
7. [x] 写 `memory-bank/` 路径时跳过（避免死锁）
8. [x] Gate 执行顺序：Recovery → Read → Doc-First → Write Guard
9. [x] Read Gate warned 时不叠加 Doc-First warning（防双重提醒）
10. [x] 提醒每条用户消息最多一次（`docFirstWarned`）
11. [x] 父 session 关联兜底：`pendingDocFirstSatisfied` 处理竞态
12. [x] 独立于 `MEMORY_BANK_GUARD_MODE`
13. [ ] 前置检查 `memory-bank/` 存在性：不存在时发"建议初始化"提醒（session 内一次）
14. [ ] 复用 `initReminderFired` + `checkMemoryBankExists()` 缓存

---

## 已知限制（v1 scope）

- Bash 写入（sed -i, echo >, generators）不触发 Doc-First
- 写入成功确认受限于 `tool.execute.before` 语义（接受"被允许的写入"）

## 相关文档

- `memory-bank/details/design/design-gating-architecture.md` — 现有 Gating 设计
- `memory-bank/details/patterns.md` — v7.0/v7.1 Gating 决策记录
- `plugin/memory-bank.ts` — 实现位置
