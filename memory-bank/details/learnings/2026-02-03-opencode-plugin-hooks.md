# OpenCode 插件 Hook 签名与实践

> 日期：2026-02-03 | 版本：v7.1 | 类型：Integration 知识

---

## 关键发现

### Hook 签名（来自 packages/plugin/src/index.ts）

```typescript
// compacting 有 sessionID
"experimental.session.compacting"?: (
  input: { sessionID: string },
  output: { context: string[]; prompt?: string }
) => Promise<void>

// system.transform sessionID 可选（有时调用不传）
"experimental.chat.system.transform"?: (
  input: { sessionID?: string; model: Model },
  output: { system: string[] }
) => Promise<void>

// tool.execute.before 有 sessionID
"tool.execute.before"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any }
) => Promise<void>
```

---

## 重要澄清

**之前的误解**: 认为 `experimental.session.compacting` 没有 sessionID

**实际情况**: 
- `compacting` hook **确实有** `sessionID: string`（必有）
- `system.transform` 的 sessionID 是**可选的**（`sessionID?: string`）
- 在 `llm.ts` 中调用时传了 sessionID
- 在 `agent.ts` 中调用时**没传** sessionID

---

## 社区插件实践

| 插件 | compacting 用法 | 是否用 sessionID |
|------|----------------|-----------------|
| oh-my-opencode | 执行 PreCompact hooks，push context | 用 |
| swarm-tools | 检测 swarm 状态，注入协调指令 | 用于扫描消息 |
| beans-prime | 简单 push `beans prime` 输出 | 未直接用 |

---

## 压缩流程（compaction.ts）

```typescript
// 1. 触发插件 hook
const compacting = await Plugin.trigger(
  "experimental.session.compacting",
  { sessionID: input.sessionID },  // <- sessionID 在这里传入
  { context: [], prompt: undefined }
)

// 2. 构建 prompt
const defaultPrompt = "Provide a detailed prompt for continuing..."
const promptText = compacting.prompt ?? [defaultPrompt, ...compacting.context].join("\n\n")

// 3. 用 prompt 让 LLM 生成压缩摘要
```

---

## output.context vs output.prompt

| 字段 | 作用 | 用法 |
|------|------|------|
| `output.context[]` | 追加到默认 prompt 后面 | `output.context.push("...")` |
| `output.prompt` | **替换**整个默认 prompt | `output.prompt = "..."` |

---

## 对 Session Anchors 实现的影响

| Hook | sessionID | 可靠性 | 用途建议 |
|------|-----------|--------|----------|
| `experimental.session.compacting` | 必有 | 高 | Session Anchors 恢复时机 |
| `experimental.chat.system.transform` | 可选 | 中 | 需要 fallback 处理 |
| `tool.execute.before` | 必有 | 高 | 状态追踪 |

**结论**：可以在 compacting hook 中直接用 sessionID，不需要 Oracle 建议的 pendingRecovery workaround。

---

## 相关链接

- OpenCode 源码: `anomalyco/opencode` (branch: dev)
  - `packages/plugin/src/index.ts` — Hooks 类型定义
  - `packages/opencode/src/session/compaction.ts` — 压缩流程
  - `packages/opencode/src/session/llm.ts` — system.transform 调用
- 社区插件:
  - `code-yeongyu/oh-my-opencode` — claude-code-hooks
  - `joelhooks/swarm-tools` — compaction-hook.ts
