# Memory-first V2：强制加载 Skill 方案

> 状态：**已实现** | 创建时间：2026-01-28

---

## 问题

当前 Plugin 注入文件内容到 system prompt，但 AI 仍然跳过 Memory Bank 直接搜索代码。

**根因**：被动注入内容不如主动检索有效。

---

## 方案

### Plugin 注入（极简，~100 chars）

```text
启用 Memory Bank。任何工作前：先加载 memory-bank skill；你的第一个 Read 必须是 memory-bank/_index.md；在此之前禁止 Glob/Grep/代码搜索。
```

### 职责分离

| Skill | 职责 |
|-------|------|
| `memory-bank` | 读取规则（Memory Gate） |
| `memory-bank-writer` | 写入规则（初始化 + 写入触发） |

### Skill 渐进式披露

```
skills/memory-bank/SKILL.md
├── Memory Gate（~20 行）
├── 目录速查（~15 行）
└── 目录结构（详细）

skills/memory-bank-writer/SKILL.md
├── 写入触发（~15 行）
├── 初始化流程（~10 行）
└── 写入规则（详细）
```

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-01-28 | 初始设计，Oracle approved |
| 2026-01-28 | 实现完成，职责分离 |
