# 写入流程职责分离

> 状态：**已完成** | 创建时间：2026-01-28 | 完成时间：2026-01-28

---

## 问题

主 Agent 在更新 memory bank 时自己判断"写哪个文件"（如直接指定 active.md），但这违反了职责分离原则——应该由 Writer 根据 skill 规则判断写入目标。

**当前问题**：
- 主 Agent 说"更新 docs/design-xxx.md"
- 这等于主 Agent 在做 Writer 的工作
- 如果判断错误，会导致重复文档或写错位置

---

## 设计

### 调用契约

| 角色 | 职责 |
|------|------|
| 主 Agent | 只传诉求（语义意图），不指定具体路径 |
| Writer | 根据诉求自主判断写入目标 |

### Writer 判断流程

```
收到诉求
    │
    ▼
判断变更类型
    ├─ 设计变更 → 检查 docs/design-*.md
    ├─ 新需求 → 检查 requirements/REQ-*.md
    ├─ 技术决策 → patterns.md
    ├─ 经验记录 → learnings/
    └─ 焦点变更 → active.md
    │
    ▼
Glob 检查是否有相关文档
    ├─ 存在 → 更新
    └─ 不存在 → 创建
```

### 主 Agent 调用示例

```
// 旧方式（错误）
delegate_task(
    prompt="更新 docs/design-xxx.md，内容是..."
)

// 新方式（正确）
delegate_task(
    prompt="记录设计决策：写入流程职责分离。背景是...核心决策是..."
)
```

---

## 需要改的文件

| 文件 | 变更 |
|------|------|
| `plugin/memory-bank.ts` | system prompt 指令：主 Agent 只传诉求 |
| `skills/memory-bank/SKILL.md` | 写入前确认部分：移除路径指定 |
| `skills/memory-bank/references/writer.md` | 新增判断流程规则（原 `memory-bank-writer/SKILL.md`，已合并） |

> **注**：`memory-bank-writer` 不再作为独立 skill，已合并到 `memory-bank/references/writer.md`。原因见 `patterns.md`。

---

## 实现摘要

已修改文件：
- `plugin/memory-bank.ts` - system prompt 中移除路径指定指令
- `skills/memory-bank/SKILL.md` - 主 Agent 写入确认规范：只说诉求，禁止指定路径
- `skills/memory-bank/references/writer.md` - Writer 自主判断规则：Glob 检查 + 语义映射

核心变更：主 Agent 只传语义诉求，Writer 自主判断写入目标文件。

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-01-28 | **实现完成**：plugin + skill + writer 三处修改落地 |
| 2026-01-28 | 调整：writer skill 合并到 references/，不再独立存在 |
| 2026-01-28 | 初始设计 |
