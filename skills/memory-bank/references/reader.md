# Memory Bank Reader 规则

> 此文档定义 Memory Bank 的读取规则。

## Direct-First 读取流程（默认）

MEMORY.md 内容已由 Plugin 自动注入到 system prompt。

**读取步骤**：

1. **从 Routing Rules 选择 1-3 个最相关文件**
   - 按 MEMORY.md 的"意图驱动"路由表，匹配当前任务意图
   - 不确定文件名时先 `glob("memory-bank/details/**/*.md")`

2. **直接 `read` 读取**
   - 使用 `read({ filePath: "memory-bank/details/xxx.md" })`
   - 每次选择 1-3 个文件读取

3. **信息足够则停止**
   - 足够回答 → 停止，给出引用指针
   - 不足但目标文件 ≤ 3 个 → 再读下一批（仍用 direct read）
   - 目标文件 > 3 个 或 预估 > 300 行 → 升级到 memory-reader

---

## 升级到 memory-reader（仅在确定触发时使用）

以下**任一**满足时，升级到 memory-reader：

| 触发条件 | 说明 |
|----------|------|
| 用户要求证据/引用 | "给出处"、"引用来源"、"为什么这样做" |
| 需要冲突检测 | 怀疑文档与代码不一致 |
| 目标文件 > 3 个 | 一次读取无法覆盖，需要综合多文件 |
| 预估行数 > 300 行 | 单文件很长或多文件累加超阈值 |
| 跨多个主题目录 | 同时涉及 2+ 个不同 details/ 子目录 |

**注意**：direct read 没有"上限"——可以多批次读取。升级到 memory-reader 的判断是"一次性需要处理的文件/行数超过阈值"，而非"累计读过多少"。

**注意**：不基于"复杂度"判断，只基于上述确定性条件。

### 调用方式

```typescript
proxy_task({
  subagent_type: "memory-reader",
  description: "Memory Bank context read",
  prompt: "Goal: Load minimum repo context needed for the user request.\nConstraints:\n- Read memory-bank/MEMORY.md first.\n- Then read relevant files under memory-bank/details/ as needed.\n- Do NOT read secrets (.env, *.pem, *.key).\n- Max 10 files total.\nOutput: Context Summary (Markdown) + ONE YAML block with evidence, conflicts, open_questions.\n\nUser request:\n{user_question}"
})
```

详细输出格式见 [memory-reader-prompt.md](memory-reader-prompt.md)。

---

## Fallback 触发规则

**如果 oh-my-opencode keyTrigger 已注入**：
- keyTrigger 会在 Phase 0 自动触发读取
- 本文档作为完整规范参考

**如果 keyTrigger 不存在（Fallback）**：

| 触发 | 场景 |
|------|------|
| ✅ | 用户问题涉及项目具体背景（技术栈、架构、历史决策） |
| ✅ | 用户问"为什么这样做"、"之前怎么处理的" |
| ✅ | 即将做非平凡修改，需要仓库约定/约束 |
| ❌ | 简单追问（"继续"、"好的"） |
| ❌ | 通用编程问题（与项目无关） |
| ❌ | 用户明确说"不需要上下文"或"skip memory-bank" |

---

## 消费契约

memory-reader 返回两部分，主 Agent 应按以下方式消费：

### 1. Context Summary（Markdown 格式）

```markdown
**Project**: {1-sentence description}
**Current Focus**: {current task}
**Key Tech Stack**: {comma-separated list}
**Key Constraints**: {important rules, max 3}
```

**用法**：直接作为项目背景，无需验证。

### 2. Structured Data（ONE YAML block）

所有结构化数据在**单个 YAML 块**中返回：

```yaml
evidence:
  - claim_id: C1
    claim: "项目使用 Bun 运行时"
    path: "memory-bank/details/tech.md"
    mtime: "2026-01-31T00:00:00+08:00"
    quote: "Runtime: Bun 1.2.x"

conflicts:
  - type: stale | inconsistent | ambiguous
    severity: high | medium | low
    description: "patterns.md 说用 Redux，代码用 Zustand"
    trust_source: "source code"
    minimal_fix: "更新 patterns.md"
# If no conflicts: conflicts: []

open_questions:
  - question: "认证流程未记录"
    suggested_path: "src/auth/login.ts"
# If comprehensive: open_questions: []
```

**用法**：
- `evidence[].claim_id` → 主 Agent 引用作为决策依据
- `conflicts[].severity: high` → 优先处理
- `conflicts[].trust_source` → 当前应参考的权威来源
- 发现冲突 → 建议调用 memory-bank-writer 更新

---

## 冲突处理

| 冲突类型 | 处理规则 |
|---------|---------|
| MEMORY.md vs details/ | 以 details/ 为准（更详细） |
| 文档 vs 代码 | 以代码为准，建议更新文档 |
| 两个 details/ 互相矛盾 | 以 mtime 更新的为准，报告冲突 |

---

## 声明上下文来源

回答问题时，简短说明参考了哪些 Memory Bank 文件：

```
基于 memory-bank/details/xxx.md，...
```
