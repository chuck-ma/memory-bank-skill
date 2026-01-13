# Memory Bank Skill

项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更。

## 简介

Memory Bank 是一个纯 Markdown 的项目记忆系统。通过结构化文档将 AI 的"记忆"外化，解决 AI 编码助手 session 间失忆的问题。

### 核心能力

- **自动读取**: Session 开始时自动加载项目上下文
- **自动写入**: 在关键时刻自动沉淀发现和决策
- **需求追踪**: 管理需求池，记录需求变更历史
- **技术文档**: 三层技术文档（架构/模块/细节），追踪实现变更
- **经验沉淀**: 分类管理 bug/性能/集成经验

## 目录结构

```
memory-bank/
├── brief.md                 # 项目概述
├── tech.md                  # 技术栈 + 环境
├── active.md                # 当前焦点（高频更新）
├── progress.md              # 进度状态
├── patterns.md              # 决策 + 约定
│
├── requirements/            # 需求池
│   └── REQ-{ID}-{slug}.md
│
├── docs/                    # 技术文档
│   ├── architecture.md      # L1: 架构层
│   ├── modules/             # L2: 模块层
│   └── specs/               # L3: 细节层
│
└── learnings/               # 经验沉淀
    ├── bugs/
    ├── performance/
    └── integrations/
```

## 使用方法

### 初始化
```
初始化记忆
init memory bank
```

### 更新
```
更新记忆
update memory bank
```

### 新建需求
```
新需求: 用户登录功能
new req: user login
```

### 记录经验
```
记录经验: bug Safari兼容问题
log learning: bug safari-compat
```

### 新建模块文档
```
新模块文档: scanner
new module doc: scanner
```

### 查看状态
```
项目状态
project status
```

## 文件说明

| 文件 | 用途 | 更新频率 |
|------|------|----------|
| brief.md | 项目是什么 | 低 |
| tech.md | 技术栈和环境 | 低 |
| active.md | 当前工作焦点 | 高 |
| progress.md | 完成状态 | 中 |
| patterns.md | 技术决策和约定 | 中 |
| requirements/*.md | 需求文档 | 按需求变更 |
| docs/*.md | 技术文档 | 按实现变更 |
| learnings/*/*.md | 经验记录 | 按事件 |

## 设计原则

1. **纯 Markdown**: 无数据库，无外部服务，可 git 管理
2. **人类可读**: 所有文档可直接阅读和编辑
3. **简洁优先**: 核心 5 文件 + 3 目录
4. **追加优先**: patterns 和 learnings 只追加不重写
5. **变更内聚**: 变更历史放在对应文档内

## 安全提示

⚠️ **不要在 Memory Bank 中存储敏感信息**：
- API 密钥、Token、密码
- 数据库连接字符串
- 私钥或证书
- 任何凭证信息

Memory Bank 设计为可 git 管理和团队共享，请确保不包含敏感数据。
