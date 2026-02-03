# Session Anchors v3 + Recovery Gate 设计文档

> 创建于: 2026-02-03
> 状态: **已完成设计，待实现**
> Oracle 对抗: 3 轮，已收敛

## 问题

OpenCode 会话压缩后，AI 丢失任务框架，只关注最近细节，导致任务部分完成。

## 根因

1. 压缩是有损的 - 默认 prompt 只要求总结"做了什么、在哪、下一步"
2. 近因偏好 - LLM 自然倾向总结最近发生的事
3. 工具输出剪枝 - 压缩前删除旧工具结果，证据偏向最近活动

## 核心思路

> 文件是记忆，锚点是书签，路障是纪律。

需求文档本身是 source of truth。问题不是"信息丢失"，而是"AI 忘了去哪找"。

方案：注入文件指针 + 简要状态 + **强制** AI 在高风险操作前重新阅读。

## 架构概览

```
正常会话
    │
    │ (AI 读取 requirements/ design/ 文件时)
    │ ──→ plugin 追踪: anchorsLRU.add(path)
    │
    ▼
触发压缩 (token overflow)
    │
    ├─ ① 注入 MEMORY.md (已有)
    ├─ ② 注入 Session Anchors Block (~150 tokens)
    ├─ ③ 设置 recovery.required = true
    │
    ▼
Recovery Mode (压缩后)
    │
    ├─ AI 调 read() → 追踪 readFiles
    │   └─ 所有 anchor 已读 → 解除 recovery
    │
    ├─ AI 调 memory-reader → 立即解除 (逃生口)
    │
    ├─ AI 调 write/edit/patch → recovery 未解除？
    │   └─ ❌ BLOCK + 告诉它先读哪些文件
    │
    ├─ AI 调 bash (likely write) → 同上
    │
    ▼
恢复正常会话
```

## 关键知识点

### OpenCode Hook 签名（已验证）

```typescript
// compacting 有 sessionID（必有）— 可直接用于 per-session 状态
"experimental.session.compacting"?: (
  input: { sessionID: string },
  output: { context: string[]; prompt?: string }
) => Promise<void>

// system.transform sessionID 可选（有时调用不传）
"experimental.chat.system.transform"?: (
  input: { sessionID?: string; model: Model },
  output: { system: string[] }
) => Promise<void>

// tool.execute.before 有 sessionID（必有）
"tool.execute.before"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any }
) => Promise<void>
```

来源: `anomalyco/opencode` commit `96fbc309`

## 实现规格

### 1. 状态结构

```typescript
interface SessionAnchorState {
  anchorsLRU: string[]              // 最近读过的 anchor 文件 (LRU, cap 5)
  recovery: RecoveryState | null
  compactionCount: number
}

interface RecoveryState {
  required: true
  anchorPaths: string[]             // 压缩时验证过存在的文件
  readFiles: Set<string>
  activatedAt: number
}

// 存储
const sessionAnchorStates = new Map<string, SessionAnchorState>()

// 清理: 在 session.deleted 事件中删除
```

### 2. 路径标准化（防死锁关键）

```typescript
function canonicalize(rawPath: string, projectRoot: string): string {
  const abs = path.isAbsolute(rawPath) ? rawPath : path.join(projectRoot, rawPath)
  const rel = path.relative(projectRoot, abs)
  if (rel.startsWith('..')) return ''  // 拒绝仓库外路径
  const posix = rel.replace(/\\/g, '/')
  // darwin/win32 用小写比较
  return process.platform === 'darwin' || process.platform === 'win32'
    ? posix.toLowerCase()
    : posix
}
```

### 3. Anchor 模式

```typescript
const ANCHOR_PATTERNS = [
  /^memory-bank\/details\/requirements\//,
  /^memory-bank\/details\/design\//,
  /^memory-bank\/details\/progress\.md$/,
]

function isAnchorPath(canonicalPath: string): boolean {
  return ANCHOR_PATTERNS.some(p => p.test(canonicalPath))
}
```

### 4. Anchor 追踪（tool.execute.before）

```typescript
// 在现有 read 追踪逻辑中扩展
if (readTools.includes(toolLower)) {
  const canonicalPath = canonicalize(targetPath, projectRoot)
  if (isAnchorPath(canonicalPath)) {
    updateLRU(state.anchorsLRU, canonicalPath, 5)
  }
  
  // 同时检查是否满足 recovery
  const recovery = state.recovery
  if (recovery?.required) {
    recovery.readFiles.add(canonicalPath)
    if (recovery.anchorPaths.every(p => recovery.readFiles.has(p))) {
      clearRecovery(sessionID)
    }
  }
}
```

### 5. Compaction Hook

```typescript
"experimental.session.compacting": async (input, output) => {
  const { sessionID } = input  // ✅ sessionID 可用
  
  // A. MEMORY.md（现有，保持 sentinel 逻辑）
  if (!output.context.some(s => s.includes(SENTINEL_OPEN))) {
    const ctx = await buildMemoryBankContext(projectRoot)
    if (ctx) output.context.push(ctx)
  }
  
  // B. Anchor Block（新，独立 sentinel）
  const ANCHOR_SENTINEL = '<memory-bank-anchors>'
  if (!output.context.some(s => s.includes(ANCHOR_SENTINEL))) {
    const anchors = await buildAnchorBlock(sessionID, projectRoot)
    if (anchors) output.context.push(anchors)
  }
  
  // C. 设置 Recovery
  const validPaths = await validateAnchors(sessionID, projectRoot)
  if (validPaths.length > 0) {
    setRecovery(sessionID, validPaths)
  }
  
  // D. 计数
  state.compactionCount++
}
```

### 6. Anchor Block 格式

```markdown
<memory-bank-anchors>
## ⚠️ POST-COMPACTION RECOVERY (MANDATORY)

Compaction occurred. Before high-impact actions, you MUST read:
- memory-bank/details/requirements/REQ-005.md
- memory-bank/details/design/design-index-first.md

Session state (from MEMORY.md Current Focus):
- Goal: v7.0→v7.1 模板升级路径
- In progress: 设计验证
- Remaining: Oracle 审查 → 实现 → 测试

Do NOT proceed with write/edit/patch until anchors are read.
</memory-bank-anchors>
```

### 7. Recovery Gate（tool.execute.before 开头）

```typescript
// 在现有 v7.0 gating 之前
const state = getSessionState(sessionID)
const recovery = state?.recovery

if (recovery?.required) {
  // 阻止 medium/high risk 写操作
  if (writeTools.includes(toolLower)) {
    const riskLevel = assessWriteRisk(toolLower, output.args, projectRoot)
    if (riskLevel !== 'low') {
      throw new Error(
        `[Recovery Gate] Compaction detected. Before proceeding, read:\n` +
        recovery.anchorPaths.map(p => `  read({ filePath: "${p}" })`).join('\n') +
        `\nOr call: proxy_task({ subagent_type: "memory-reader", ... })`
      )
    }
  }
  
  // bash likely-write 也阻止（复用现有启发式）
  if (toolLower === 'bash') {
    const cmd = output.args?.command || ''
    if (isLikelyWriteCommand(cmd) && assessWriteRisk(...) !== 'low') {
      throw new Error(`[Recovery Gate] ...`)
    }
  }
}
```

### 8. Recovery 完成条件

| 条件 | 动作 |
|------|------|
| 所有 anchorPaths 已 read | 解除 recovery |
| 调用 memory-reader subagent | 立即解除（逃生口） |
| anchor 文件在检查时不存在 | 从 anchorPaths 移除 |
| anchorPaths 变空 | 解除 recovery |

### 9. Fallback Anchors

```typescript
const FALLBACK_ANCHORS = [
  'memory-bank/MEMORY.md',
  'memory-bank/details/patterns.md',
]

// 如果没有追踪到任何 anchor，使用默认
function getRequiredAnchors(sessionID: string): string[] {
  const tracked = getSessionState(sessionID)?.anchorsLRU || []
  return tracked.length > 0 ? tracked : FALLBACK_ANCHORS
}
```

## 改动范围

| 改动点 | 估计代码量 |
|--------|-----------|
| 新增状态结构 | ~30 行 |
| Anchor 追踪（扩展 tool.execute.before） | ~40 行 |
| Compaction 注入 + Recovery 设置 | ~60 行 |
| Recovery Gate（tool.execute.before 开头） | ~50 行 |
| 路径标准化工具函数 | ~20 行 |
| **总计** | **~200 行** |

文件: `plugin/memory-bank.ts`

## Oracle 对抗记录

| 轮次 | 挑战 | 结果 |
|------|------|------|
| 1 | "锚点是装饰品，AI 会无视" | 加 Recovery Gate 强制执行 |
| 2 | "compacting 没有 sessionID，需要 workaround" | 查源码证明 sessionID 存在，Oracle 错误 |
| 3 | "路径不匹配会死锁" | 加标准化 + 验证 + 逃生口 |
| 4 | "bash 会绕过" | 复用已有 bash 启发式 |

## 与 SCR（重方案）对比

| 维度 | SCR | Anchors v3 |
|------|-----|------------|
| 耦合度 | 覆盖 compaction prompt | 只用 context[] |
| 可靠性 | 高 | 高（gate 强制） |
| Token | ~900+ | ~150-200 |
| 维护 | 需回归测试 | 加减 anchor |
| sessionID 依赖 | N/A | ✅ 已确认可用 |

## 相关文件

- `plugin/memory-bank.ts` — 实现位置
- `memory-bank/details/design/design-gating-architecture.md` — 已有 v7.0 Gating 机制
- `memory-bank/details/learnings/2026-02-03-opencode-plugin-hooks.md` — Hook 签名知识
