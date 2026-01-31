# Memory Bank Reader 规则

> 此文档定义 Memory Bank 的读取规则。

## 调用方式

使用 `proxy_task`（Task tool）同步调用 memory-reader：

```typescript
proxy_task({
  subagent_type: "memory-reader",
  description: "Memory Bank context read",
  prompt: "Goal: Load minimum repo context needed for the user request.\nConstraints:\n- Read memory-bank/MEMORY.md first.\n- Then read relevant files under memory-bank/details/ as needed.\n- Do NOT read secrets (.env, *.pem, *.key).\n- Max 10 files total.\nOutput: ONE YAML block with selected_files, evidence, conflicts, context_pack.\n\nUser request:\n{user_question}"
})
```

## 触发规则

**如果 oh-my-opencode keyTrigger 已注入**：
- keyTrigger 会在 Phase 0 自动触发 Reader
- 本文档作为完整规范参考

**如果 keyTrigger 不存在（Fallback）**：
- 当用户问题涉及项目上下文时，手动调用 memory-reader
- 触发条件见下方表格

### 触发条件

| 触发 | 场景 |
|------|------|
| ✅ | 用户问题涉及项目具体背景（技术栈、架构、历史决策） |
| ✅ | 用户问"为什么这样做"、"之前怎么处理的" |
| ✅ | 用户工作在特定模块，可能有已记录的模式 |
| ✅ | 即将做非平凡修改，需要仓库约定/约束 |
| ❌ | 简单追问（"继续"、"好的"） |
| ❌ | 通用编程问题（与项目无关） |
| ❌ | 用户明确说"不需要上下文"或"skip memory-bank" |
| ❌ | 问题是关于 Memory Bank 本身 |

---

## 消费契约

memory-reader 返回四层结构，主 Agent 应按以下方式消费：

### 1. Context Summary（直接使用）

```yaml
project: "..."
current_focus: "..."
key_tech_stack: ["...", "..."]
key_constraints: ["...", "..."]
```

**用法**：直接作为项目背景，无需验证。

### 2. Evidence（可信凭证）

```yaml
evidence:
  - claim_id: C1
    claim: "项目使用 Bun 运行时"
    path: "memory-bank/details/tech.md"
    mtime: "2026-01-31T00:00:00+08:00"
    quote: "Runtime: Bun 1.2.x"
```

**用法**：
- 主 Agent 可引用 `claim_id` 作为决策依据
- 若需验证，直接读取 `path` 检查 `quote`
- `mtime` 用于判断信息新鲜度

### 3. Conflicts Detected（冲突报告）

```yaml
conflicts:
  - type: stale | inconsistent | ambiguous
    severity: high | medium | low
    description: "patterns.md 说用 Redux，代码用 Zustand"
    memory_path: "memory-bank/details/patterns.md"
    memory_says: "状态管理：Redux"
    source_path: "src/store.ts"
    source_shows: "import { create } from 'zustand'"
    trust_source: "source code"
    minimal_fix: "更新 patterns.md 的状态管理描述"
```

**用法**：
- `severity: high` → 优先处理，可能影响决策
- `trust_source` → 当前行为应参考的权威来源
- `minimal_fix` → 建议调用 memory-bank-writer 更新

### 4. Open Questions（信息缺口）

```yaml
open_questions:
  - question: "认证流程未记录"
    suggested_path: "src/auth/login.ts"
```

**用法**：
- 主 Agent 若需要此信息，应直接读取 `suggested_path`
- 避免基于缺失信息做假设

---

## 直接读取流程（备选）

如果不使用 memory-reader，可直接读取：

```
1. MEMORY.md 内容已注入（包含 Project Snapshot + Current Focus + Routing Rules）

2. 根据当前任务匹配路由规则：
   - 匹配到 → 读取对应的 details/ 文件
   - 无匹配 → 不需要读取详情

3. 渐进读取：
   - 默认读取 1-3 个详情文件
   - 信息不足 → 继续读取更多
   - 足够回答 → 停止读取
```

---

## 冲突处理

| 冲突类型 | 处理规则 |
|---------|---------|
| MEMORY.md vs details/ | 以 details/ 为准（更详细） |
| 文档 vs 代码 | 以代码为准，建议更新文档 |
| 两个 details/ 互相矛盾 | 以 mtime 更新的为准，报告冲突 |

---

## 风险提示

如果 `details/learnings/` 下有相关历史经验，主动提醒：

```
注意：历史上有类似问题 → {file}
```

---

## 声明上下文来源

回答问题时，简短说明参考了哪些 Memory Bank 文件：

```
基于 MEMORY.md 和 details/design/xxx.md，...
```
