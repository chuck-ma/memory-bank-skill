---
name: memory-bank
description: 项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更
---

# Memory Bank Skill

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
2. 根据 MEMORY.md 的 **Routing Rules** 按需读取 details/
3. **渐进读取**：默认 1-3 个详情文件，信息不足再追加
4. **路由顺序 = 优先级**：第一条匹配的规则优先

详见 [reader.md](references/reader.md)

### 写入阶段

**核心约束**：主 Agent **禁止直接写入** `memory-bank/`，必须 delegate 给 `memory-bank-writer`。

流程：
1. 主 Agent 输出更新计划（诉求 + 要点）
2. 用户确认
3. 调用 Task tool：`Task(description="更新 Memory Bank", prompt="诉求：...", subagent_type="memory-bank-writer")`

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
