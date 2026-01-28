# Memory Bank 写入守卫设计

> 状态：**已实现 (v5.6.0)** | 创建时间：2026-01-28 | 更新：2026-01-28

---

## 问题

AI 写入 `memory-bank/` 时可能跳过检查步骤，导致重复文档。

**目标**：只有专用 Writer Agent 能写入，主 agent 必须 delegate。

**定位**：这是**策略守卫**，用于防止意外违规，不是安全边界。

---

## 核心设计

### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                      Main Agent                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. 检测到需要更新 memory-bank                            │ │
│  │ 2. delegate_task(agent="memory-bank-writer", ...)       │ │
│  │ 3. 直接写入 → 被 Plugin 拦截阻止                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                 Memory Bank Writer Agent                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ • 独立 Session（有 parentID）                           │ │
│  │ • 加载 memory-bank-writer skill                         │ │
│  │ • 内置 Glob-before-write 逻辑                           │ │
│  │ • 写入 memory-bank/** → Plugin 放行                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 核心原则

| 原则 | 说明 |
|------|------|
| **上下文隔离** | Writer agent 独立 session，不污染主 agent |
| **规则内置** | Glob 检查逻辑在 skill 里，不依赖 AI 自觉 |
| **强制执行** | Plugin 层面拦截，无法绕过 |

---

## 技术基础

### Session 层级

```typescript
// Sub-agent 的 session 有 parentID
export type Session = {
    id: string;
    parentID?: string;  // 主 agent 无此字段，sub-agent 有
};
```

### Agent 识别

```typescript
// message.updated 事件包含 agent 名称
event.type === "message.updated"
event.properties.info.agent === "memory-bank-writer"
```

### Tool 拦截

```typescript
// tool.execute.before 只有 sessionID，无 agent
"tool.execute.before": (input: {
    tool: string;
    sessionID: string;
    callID: string;
}, output: { args: any; })
```

---

## 实现方案

### Plugin 状态

```
sessionsById: Map<sessionID, { parentID?: string }>
writerSessionIDs: Set<sessionID>  // 白名单
agentBySession: Map<sessionID, string>
```

### 事件处理流程

```
Event: session.created
    │
    ▼
记录 sessionsById[id] = { parentID }
    │
    ▼
Event: message.updated (role=assistant)
    │
    ▼
读取 agent = message.agent
    │
    ├─ agent === "memory-bank-writer"
    │  且 sessionsById[sessionID].parentID 存在
    │      │
    │      ▼
    │  writerSessionIDs.add(sessionID)
    │
    └─ 其他 → 忽略
```

### 写入拦截流程

```
tool.execute.before
    │
    ▼
tool 是 Write/Edit ?
    │ 否 → 放行
    ▼ 是
目标是 memory-bank/** ?
    │ 否 → 放行
    ▼ 是
sessionID 在 writerSessionIDs 中 ?
    │ 是 → 放行
    ▼ 否
throw Error("memory-bank 写入受限，请 delegate 到 memory-bank-writer")
```

---

## Writer Agent 规格

### Agent 定义

| 属性 | 值 |
|------|------|
| 名称 | `memory-bank-writer` |
| 类型 | Sub-agent（通过 delegate_task 调用） |
| Session | 独立（有 parentID） |
| Skill | `memory-bank-writer` skill |

### Skill 内置规则

1. **写入前必须 Glob 检查**
   - `docs/design-*.md` → Glob 查找相似文件
   - 找到 → 更新现有文件
   - 未找到 → 创建新文件

2. **输出写入计划**
   - 列出将要创建/更新的文件
   - 等待确认（可选）

3. **更新索引**
   - 写入后自动更新 `_index.md`

### 调用方式

```
delegate_task(
    subagent_type="memory-bank-writer",
    load_skills=["memory-bank-writer"],
    prompt="更新设计文档：... 内容 ..."
)
```

---

## 边界情况

### 首次初始化

| 场景 | 处理 |
|------|------|
| 项目无 `memory-bank/` | 允许首次创建（检测目录不存在时放行） |
| 或 | 主 agent 首次也必须 delegate |

**推荐**：保持一致，首次也 delegate。

### Race Condition

| 场景 | 处理 |
|------|------|
| Writer 写入时还没收到 message.updated | 首次写入被阻止 |
| **解决** | Writer skill 首条消息后再写入，或接受一次重试 |

### 用户手动调用

| 场景 | 处理 |
|------|------|
| 用户直接 `/memory-bank-writer` | 允许（session 会有 parentID） |

---

## 不需要的组件

| 之前考虑 | 结论 |
|----------|------|
| Git pre-commit hook | ❌ Plugin 已足够 |
| 参数签名/token | ❌ 用 session 识别更可靠 |
| 只警告不阻止 | ❌ 强制阻止更有效 |

---

## 组件清单

| 组件 | 位置 | 作用 |
|------|------|------|
| Plugin 状态管理 | `plugin/memory-bank.ts` | 跟踪 session 和 writer 白名单 |
| `tool.execute.before` hook | `plugin/memory-bank.ts` | 拦截非 writer 的写入 |
| Writer Skill | `skills/memory-bank-writer/` | 定义写入规则 |
| Agent 配置 | `opencode.json` 或 `AGENTS.md` | 注册 writer agent |

---

## 接口参考

| 接口 | 来源 | 用途 |
|------|------|------|
| `Session.parentID` | `@opencode-ai/sdk/types` | 识别 sub-agent |
| `Message.agent` | `@opencode-ai/sdk/types` | 获取 agent 名称 |
| `tool.execute.before` | `@opencode-ai/plugin` | 拦截工具调用 |
| `event` hook | `@opencode-ai/plugin` | 监听 session/message 事件 |

---

## 工作量

| 任务 | 估时 |
|------|------|
| Plugin 状态管理 + event 处理 | 1h |
| `tool.execute.before` 拦截逻辑 | 1h |
| Writer Skill 定义 | 1h |
| 测试 | 1h |
| **总计** | **4h** |

---

## 已知限制

> **重要**：这是策略守卫，用于防止意外违规，不是安全边界。

### 文件写入工具守卫（Write/Edit/MultiEdit/apply_patch）

| 已解决 | 说明 |
|--------|------|
| ✅ Symlinks | 使用 `realpath` 解析，检查 lexical + physical 路径 |
| ✅ 大小写 | macOS/Windows 自动使用大小写不敏感比较 |
| ✅ 多文件工具 | MultiEdit、apply_patch 支持多路径提取 |
| 文件类型 | 只允许 `.md` 文件写入 |

### Bash 守卫（启发式）

| 限制 | 说明 |
|------|------|
| 变量间接 | `DIR=memory-bank; rm -rf "$DIR"` 无法检测 |
| Eval/脚本 | `eval`, `bash -c`, 外部脚本无法检测 |
| 字符串拼接 | `rm -rf mem$var` 无法检测 |
| cd 后操作 | `cd memory-bank && rm file` 无法检测 |
| Python 等 | 只检测 `python.*open`，其他语言未覆盖 |

### 已覆盖的 Bash 写入操作

| 类别 | 检测模式 |
|------|---------|
| 重定向 | `>`, `>>`, `<<` |
| 管道写入 | `\|` (因为可接 tee) |
| 文件操作 | `cp`, `mv`, `rm`, `mkdir`, `touch`, `tee` |
| 编辑器 | `sed -i`, `perl -i/-p` |

### 允许的只读操作

| 命令 | 说明 |
|------|------|
| `ls`, `cat`, `head`, `tail`, `less`, `more` | 读取文件 |
| `grep`, `rg`, `ag`, `find`, `tree` | 搜索文件 |
| `wc`, `file`, `stat` | 文件信息 |
| `git *` | 所有 git 命令 |

---

## 实现状态

| 组件 | 状态 | 位置 |
|------|------|------|
| Session 状态管理 | ✅ | `plugin/memory-bank.ts` |
| event hook 处理 | ✅ | `session.created`, `message.updated` |
| Write/Edit/MultiEdit/apply_patch 拦截 | ✅ | `tool.execute.before` |
| Bash 启发式检查 | ✅ | `tool.execute.before` |
| Late registration | ✅ | 防 race condition |
| `.md` 文件限制 | ✅ | 只允许写入 markdown |
| realpath symlink 解析 | ✅ | lexical + physical 路径检查 |
| 大小写不敏感 (macOS/Win) | ✅ | 自动检测平台 |
| 多文件路径提取 | ✅ | MultiEdit, apply_patch |
| Writer Skill | ✅ | `skill/memory-bank-writer/` |

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-01-28 | 初始设计：简单拦截 + 警告 |
| 2026-01-28 | 重构：独立 Writer Agent + Session 白名单 |
| 2026-01-28 | 实现完成：Write/Edit 拦截 + Bash 启发式 + Late registration |
| 2026-01-28 | v2 改进：realpath symlink 解析 + 大小写不敏感 + MultiEdit/apply_patch 支持 |
| 2026-01-28 | v5.7.1: 修复 Bash 文件名误判 |
| 2026-01-28 | v5.7.3: 放行所有 git 命令 |
| 2026-01-28 | v5.7.4-5.7.7: CLI 自动注册 writer agent + --model 参数 |
| 2026-01-28 | v5.8.0: 修复 skill 路径（skill/ → skills/） |
