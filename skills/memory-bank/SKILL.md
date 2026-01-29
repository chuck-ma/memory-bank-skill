---
name: memory-bank
description: 项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更
---

# Memory Bank Skill

## 详细规则

- 需要了解**读取流程和规则**时，见 [references/reader.md](references/reader.md)
- 需要了解**写入流程和约束**时，见 [references/writer.md](references/writer.md)
- 需要**文件模板**时，见 [references/templates.md](references/templates.md)
- 需要了解**索引规范、预算、冲突处理**等高级规则时，见 [references/advanced-rules.md](references/advanced-rules.md)

---

## 目录速查

| 目录/文件 | 用途 | 何时读 |
|-----------|------|--------|
| `_index.md` | 索引 | 每次必读 |
| `brief.md` | 项目概述 | 了解项目是什么 |
| `tech.md` | 技术栈 + 命令 | 了解怎么跑/测试 |
| `active.md` | 当前焦点 | 了解进行中的工作 |
| `patterns.md` | 技术决策 | 涉及技术选型时 |
| `requirements/` | 需求文档 | 涉及功能/需求时 |
| `docs/` | 设计文档 | 涉及实现/架构时 |
| `learnings/` | 经验记录 | 遇到 bug/性能问题时 |

---

## 目录结构

```
memory-bank/
├── _index.md                # 索引文件
├── brief.md                 # 项目概述（稳定）
├── tech.md                  # 技术栈 + 环境 + 命令
├── active.md                # 当前焦点（高频更新）
├── progress.md              # 完成状态
├── patterns.md              # 技术决策 + 代码约定
│
├── requirements/            # 需求池
│   └── REQ-{ID}-{slug}.md
│
├── docs/                    # 技术文档
│   ├── architecture.md
│   ├── design-*.md
│   └── modules/
│
├── learnings/               # 经验沉淀
│   ├── bugs/
│   ├── performance/
│   └── integrations/
│
└── archive/                 # 归档文件
    └── active_YYYY-MM.md
```

---

## Bootstrap 流程

每次用户对话时：

```
检测 memory-bank/ 目录
├─ 存在 → 读取 _index.md + brief.md + active.md → 正常工作
└─ 不存在 → 检测代码库
              ├─ 有代码库 → 扫描项目结构 → 生成 brief.md + tech.md
              └─ 空目录 → 等用户开始工作后按需创建
```

**扫描预算**：最多 10 个文件，每个最多 200 行。

---

## 每轮行为

### 读取阶段

1. 固定加载：`brief.md` + `active.md` + `_index.md`
2. 基于 `_index.md` 选择相关文件（最多 5 个，500 行）
3. **Memory-first**：先查 Memory Bank，再查代码

详见 [reader.md](references/reader.md)

### 写入阶段

**核心约束**：主 Agent **禁止直接写入** `memory-bank/`，必须 delegate 给 `memory-bank-writer`。

流程：
1. 主 Agent 输出更新计划（诉求 + 要点）
2. 用户确认
3. `delegate_task(subagent_type="memory-bank-writer", load_skills=["memory-bank"], prompt="诉求：...")`

详见 [writer.md](references/writer.md)

---


## 设计原则

1. **零初始化**：不需要手动 init
2. **语义检索**：AI 理解，不用关键词匹配
3. **索引驱动**：通过 _index.md 支撑快速检索
4. **区块分离**：机器区块自动维护，用户区块自由编辑
5. **写前确认**：重要写入前输出计划
6. **预算控制**：每轮加载有上限
7. **人类可读**：所有文档可直接阅读、编辑、git 管理

---

## 安全护栏

### 禁止写入

- API 密钥、密码、token
- 客户隐私数据
- 任何凭证信息
