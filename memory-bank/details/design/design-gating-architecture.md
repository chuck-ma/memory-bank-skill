# v7.0 Gating 架构设计

> 创建于: 2026-02-01
> 状态: 已实现（v7.0），部分行为被 v7.1 覆盖（见下方漂移说明）
>
> **⚠️ v7.1 漂移说明**：本文档是 v7.0 原始设计。以下行为已被 v7.1 实现覆盖：
> - **捕获工具**：原设计 read/glob → 实现仅 `read`
> - **满足条件**：原设计 patterns.md 或 MEMORY.md → 实现仅精确匹配 `memory-bank/details/patterns.md`（case-insensitive）或调用 `memory-reader`
> - **风险评估**：原设计 multi-file = high → 实现 multi-file = medium, sensitive-path = high
> - **实现代码**：见 `plugin/memory-bank.ts` 的 `assessWriteRisk()` 和 gating 逻辑
> - **最新行为规范**：见 `memory-bank/details/patterns.md` v7.1 节

## 设计背景

### 核心问题

1. **触发逻辑太弱**：当前依赖 prompt 规则（keyTrigger），AI 经常忽略
2. **太耦合 OpenCode 配置**：需要 oh-my-opencode.json、agents.sisyphus.prompt_append 等
3. **Reader/Writer 两个 subagent 可能冗余**：规范已在 Skill 里

### 设计目标

- 提高触发可靠性：从"靠 AI 自觉"升级为"系统强制"
- 减少配置耦合：默认靠 Plugin 独立工作
- 简化架构：去掉不必要的 subagent

## 架构概览

### 三层分离

```
┌──────────────────────────────────────────────────────────────────┐
│                        Plugin (Runner)                            │
│  职责：                                                           │
│  • 注入 MEMORY.md 到 system prompt                                │
│  • Gating: 在写工具执行前检查是否读过上下文                         │
│  • 检测写入时机，触发 Proposal 提醒                                │
│  • 维护 writer session guard（已有）                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                          Skill                                    │
│  职责：                                                           │
│  • 规范"怎么做"（读什么文件、写什么内容、Proposal 格式）             │
│  • 主 agent 直接按 Skill 读取 details/（无需 reader subagent）     │
│  • Proposal → mb:write → 调用 writer                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    memory-bank-writer (保留)                      │
│  职责：                                                           │
│  • 唯一允许写 memory-bank/ 的 agent                               │
│  • 特权执行器：工具集可控、行为可控、guard 可控                     │
│  • 安全边界：主 agent 永久无权写，writer 有 guard 豁免              │
└──────────────────────────────────────────────────────────────────┘
```

### 角色分工

| 组件 | 职责 | 关键能力 |
|------|------|----------|
| Plugin Runner | "何时必须做" | 触发与护栏 |
| Skill | "怎么做" | 规范与格式 |
| Writer | "安全地执行" | 权限分层 |

## Gating 机制实现

### 核心思想

在 AI 尝试"写代码"之前，Plugin 检查它是否已经"读过上下文"。如果没读就写 → 拦截。

```
用户消息 → AI 思考 → AI 调用 edit/write → Plugin 拦截检查 → 通过/阻止
                                              ↑
                                        "你读过 patterns.md 吗？"
```

### 状态追踪

每个 user message 一个 key，记录这轮读了哪些文件：

```typescript
interface MessageState {
  readFiles: Set<string>           // 已读取的 memory-bank/ 文件
  contextSatisfied: boolean        // 是否满足最低上下文要求
}

const messageStates = new Map<string, MessageState>()
```

### 捕获读操作

在 `tool.execute.before` 中，当 AI 调用 read 读取 memory-bank/ 下的文件时，记录下来：

```typescript
// 捕获读操作
if (tool === "read") { // v7.0 原设计：read/glob；v7.1 实现：仅 read
  const targetPath = output.args?.filePath || output.args?.path
  if (isMemoryBankPath(targetPath)) {
    const state = getMessageState(messageKey)
    state.readFiles.add(targetPath)
    
    // v7.1 实现：仅精确匹配 patterns.md（case-insensitive）
    if (targetPath.toLowerCase() === "memory-bank/details/patterns.md") {
      state.contextSatisfied = true
    }
  }
}
```

### 拦截写操作

当 AI 调用 edit/write/apply_patch 时，检查是否已读过上下文：

```typescript
const writeTools = ["edit", "write", "apply_patch", "multiedit"]
if (writeTools.includes(tool.toLowerCase())) {
  const state = getMessageState(messageKey)
  const riskLevel = assessRisk(tool, output.args)
  
  if (!state.contextSatisfied) {
    if (riskLevel === "high") {
      // 高风险：直接阻止
      // v7.1: 仅建议 patterns.md，不再建议 MEMORY.md
      throw new Error(
        `[Memory Bank Gating] 检测到高风险写操作，但本轮未读取项目上下文。\n` +
        `请先执行: read({ filePath: "memory-bank/details/patterns.md" })\n` +
        `或调用: proxy_task({ subagent_type: "memory-reader", ... })`
      )
    } else if (guardMode === "warn") {
      // 低风险 + warn 模式：只记录警告，不阻止
      log.warn("写操作未读上下文", { tool, messageKey })
    }
  }
}
```

### 风险评估

```typescript
// v7.0 原设计（下方代码）。v7.1 实现已修改，见 plugin/memory-bank.ts assessWriteRisk()
function assessRisk(tool: string, args: any): "high" | "medium" | "low" {
  const targetPath = args.filePath || args.path || ""
  
  // 安全路径 = 低风险（v7.1 新增）
  const safePatterns = [/\.md$/, /\.txt$/, /\.json$/]
  if (safePatterns.some(p => p.test(targetPath))) return "low"
  
  // 多文件写 = 中风险（v7.0 原设计为 high，v7.1 降级为 medium）
  if (tool === "multiedit") return "medium"
  if (tool === "apply_patch" && countPatchFiles(args.patch) > 1) return "medium"
  
  // 敏感路径 = 高风险
  const sensitivePatterns = [
    /^src\/auth\//,
    /^src\/security\//,
    /package\.json$/,
    /tsconfig\.json$/,
    /docker\//,
    /infra\//,
    /\/plugin\/.*\.ts$/,  // v7.1 新增：插件源码
  ]
  if (sensitivePatterns.some(p => p.test(targetPath))) return "high"
  
  // 单文件普通修改 = 中风险（v7.1：非安全路径默认 medium）
  return "medium"
}
```

## 场景演示

### 场景 1：AI 没读就写（被拦截）

```
用户: "把 Redux 改成 Zustand"

AI 思考: 我来改代码
AI 调用: edit({ filePath: "src/store/index.ts", ... })

Plugin: ❌ 阻止！
   "检测到高风险写操作，但本轮未读取项目上下文。
    请先执行: read({ filePath: "memory-bank/details/patterns.md" })"

AI: 好的，我先读取上下文
AI 调用: read({ filePath: "memory-bank/details/patterns.md" })

Plugin: ✓ 记录已读，contextSatisfied = true

AI 调用: edit({ filePath: "src/store/index.ts", ... })

Plugin: ✓ 已读过上下文，放行
```

### 场景 2：低风险写（只警告）

```
用户: "加个 console.log"

AI 调用: edit({ filePath: "src/utils/helper.ts", ... })

Plugin: ⚠️ 警告（不阻止）
   log.warn("写操作未读上下文，但风险较低")

AI: 继续执行...
```

## 配置项

```
MEMORY_BANK_GUARD_MODE=off   # 只做注入与写保护（最轻）
MEMORY_BANK_GUARD_MODE=warn  # 默认档；仅提醒，不拦截
MEMORY_BANK_GUARD_MODE=block # 仅对高风险写拦截
```

**启用条件**：由 `MEMORY_BANK_GUARD_MODE` 环境变量控制（off/warn/block），默认 warn。不检查 memory-bank/ 目录是否存在。

> **注意**：v7.1 实现中，warn 模式也会对 medium 风险发出用户可见警告（不仅限于 high）。详见 `plugin/memory-bank.ts` 和 `memory-bank/details/patterns.md`。

## 与 prompt 规则的对比

| prompt 规则 | Plugin gating |
|-------------|---------------|
| "请先读上下文再写代码" | 在 tool.execute.before 硬拦截 |
| AI 可能忽略/遗忘 | AI 无法绕过（工具调用被阻止） |
| 靠 AI 自觉 | 系统强制 |

**关键洞察**：AI 可以忽略 prompt 里的规则，但无法绕过 throw Error() 的工具拦截。

## Reader 去 subagent 化

### 之前
```typescript
proxy_task({ subagent_type: "memory-reader", prompt: "..." })
```

### 之后
- 主 agent 直接用 read/glob/grep 按 Skill 规范读取
- Plugin gating 确保"写之前至少读过"
- 减少 agent 调用开销

## Writer 保留 subagent 的理由

Oracle 在讨论中强调：Writer 不是为了"写 Markdown 更方便"，而是**安全边界**。

如果改成"mb:write 后解锁主 agent 写"：
- 需要实现解锁窗口生命周期
- 需要实现解锁作用域控制
- 需要防绕过机制
- 需要防 prompt injection

**结论**：保留 writer subagent 比实现复杂的权限系统成本更低、更安全。

## Oracle 讨论记录摘要

经过四轮讨论，核心结论：

1. **中控 Runner 怎么实现？** → Plugin 内的策略引擎，不需要另一个 Agent 或 MCP
2. **Reader 需要 subagent 吗？** → 不需要，主 agent 直接读，Plugin 做 gating
3. **Writer 需要 subagent 吗？** → 必须保留，它是安全边界
4. **如何减少配置耦合？** → oh-my-opencode keyTrigger 降级为可选增强
5. **极简替代方案的问题？** → 预注入会污染，mb:write 解锁会打穿边界

**一句话总结**：
> "在任何写工具执行前，如果本轮没读过 memory-reader 且写入风险高，则阻止写入并给出唯一下一步。"
>
> **v7.1 更正**：满足条件已收紧为"读过 `memory-bank/details/patterns.md`（精确路径）或调用了 `memory-reader`"。
