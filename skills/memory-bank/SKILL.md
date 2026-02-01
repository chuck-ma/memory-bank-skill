---
name: memory-bank
description: 项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更
---

# Memory Bank Skill

## 优先级与去重

运行时若已注入 `Memory Bank Protocol`（在 system prompt 中检测 `protocol_version: memory-bank/v1`），**以 Protocol 为准**：

| 情况 | 行为 |
|------|------|
| Protocol 存在 | 按 Protocol 的 trigger/skip/invoke 规则执行 |
| Skill 与 Protocol 不一致 | 视为漂移，优先遵循 Protocol |
| Protocol 不存在 | 按 Skill 的 fallback 规则执行（见 [reader.md](references/reader.md)） |

**原则**：Plugin 提供最小行为闭环，Skill 提供完整规范和 fallback。

---

## 命令

### /memory-bank-refresh

初始化、迁移或刷新 Memory Bank。

```
/memory-bank-refresh
```

执行流程：
1. 检测当前结构（不存在 / 旧结构 / 新结构）
2. 输出操作计划
3. 用户确认后执行

详见 [writer.md](references/writer.md) 的 refresh 流程。

---

## 详细规则

- 需要了解**读取流程**时，见 [references/reader.md](references/reader.md)
- 需要了解**写入流程**时，见 [references/writer.md](references/writer.md)
- 需要**文件模板**时，见 [references/templates.md](references/templates.md)

---

## 目录结构

```
memory-bank/
├── MEMORY.md              # 唯一入口（项目概述 + 当前焦点 + 路由规则）
│
└── details/               # 详情层（按需读取）
    ├── tech.md            # 技术栈 + 命令
    ├── design/            # 设计文档
    │   ├── index.md       # 二级路由
    │   └── *.md
    ├── requirements/      # 需求文档
    │   ├── index.md
    │   └── REQ-*.md
    └── learnings/         # 经验记录
        ├── index.md
        └── *.md
```

---

## Bootstrap 流程

Plugin 自动注入 `memory-bank/MEMORY.md` 内容到 system prompt。

```
检测 memory-bank/ 目录
├─ 存在 MEMORY.md → 直接注入内容
├─ 存在旧结构 → 提示运行 /memory-bank-refresh 迁移
└─ 不存在 → 提示运行 /memory-bank-refresh 初始化
```

---

## 每轮行为

### 读取阶段

1. **MEMORY.md 已由 Plugin 注入**，无需手动读取
2. 当用户问题涉及项目背景时，启动 **memory-reader** 并行任务
3. 根据 MEMORY.md 的 **Routing Rules** 按需读取 details/
4. **渐进读取**：默认 1-3 个详情文件，信息不足再追加

#### memory-reader 同步子任务

当用户问题涉及项目上下文时，同步调用 memory-reader 获取结构化上下文包：

```typescript
proxy_task({
  subagent_type: "memory-reader",
  description: "Memory Bank context read",
  prompt: "Goal: Load minimum repo context needed.\nConstraints: Read memory-bank/MEMORY.md first, then details/ as needed. No secrets. Max 10 files.\nOutput: ONE YAML block with selected_files, evidence, conflicts, context_pack.\n\nUser request: {question}"
})
```

**触发条件**：
- ✅ 涉及项目具体背景（技术栈、架构、历史决策）
- ✅ 涉及"为什么这样做"、"之前怎么处理的"
- ❌ 简单追问、通用编程问题
- ❌ 关于 Memory Bank 本身的问题

**冲突检测**：memory-reader 发现记忆与实现冲突时，会报告给主 Agent，建议调用 Writer 更新。

详见 [reader.md](references/reader.md)

### 写入阶段

**核心约束**：主 Agent **禁止直接写入** `memory-bank/`，必须 delegate 给 `memory-bank-writer`。

流程（跨 turn）：
1. 主 Agent 检测到写入时机，用自然语言询问是否写入（含目标文件 + 要点）
2. 用户自然语言确认（"好"/"写"/"确认"）或跳过（"不用"/"跳过"/继续下一话题）
3. 下一 turn 调用：`proxy_task({ subagent_type: "memory-bank-writer", description: "Memory Bank write", prompt: "Target: ...\nDraft: ..." })`

详见 [writer.md](references/writer.md)

---

## 设计原则

1. **单入口**：MEMORY.md 是唯一入口，包含路由规则
2. **渐进式披露**：索引 = 路由规则，不是文件清单
3. **语义检索**：AI 理解路由规则，自主判断读什么
4. **区块分离**：机器区块自动维护，用户区块自由编辑
5. **写前确认**：重要写入前输出计划
6. **人类可读**：所有文档可直接阅读、编辑、git 管理

---

## 安全护栏

### 禁止写入

- API 密钥、密码、token
- 客户隐私数据
- 任何凭证信息
