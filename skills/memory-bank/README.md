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

> 注意：插件提醒链路当前暂时禁用，自动写入依赖 AI 按规则执行。
> 环境变量 `MEMORY_BANK_DISABLED=1|true` 用于禁用提醒链路（提醒恢复前无效）。

## 目录结构

```
memory-bank/
├── MEMORY.md              # 单入口文件
│
└── details/               # 详情层
    ├── tech.md            # 技术栈 + 环境
    ├── patterns.md        # 决策 + 约定
    ├── progress.md        # 进度状态
    ├── design/            # 技术文档（架构/设计/模块/细节）
    ├── requirements/      # 需求池
    ├── learnings/         # 经验沉淀
    └── archive/           # 归档文件
```

## 使用方法

### 初始化/刷新
使用 `/memory-bank-refresh` 命令初始化、迁移或刷新 Memory Bank：
```
/memory-bank-refresh
```

### 写入触发
Memory Bank 写入由 AI 自动检测时机，流程为：
1. AI 检测到写入时机（新决策、新经验等）
2. AI 用自然语言询问是否写入
3. 用户确认后，AI 调用 `memory-bank-writer` 执行

### 常见写入场景
- 新需求/范围变更
- 新技术决策/约定
- Bug 修复经验
- 项目进度更新

## 文件说明

| 文件 | 用途 | 更新频率 |
|------|------|----------|
| MEMORY.md | 项目概览、当前焦点与路由 | 高 |
| details/tech.md | 技术栈和环境 | 低 |
| details/patterns.md | 技术决策和约定 | 中 |
| details/progress.md | 完成状态 | 中 |
| details/requirements/ | 需求文档 | 按需求变更 |
| details/design/ | 技术与设计文档 | 按实现变更 |
| details/learnings/ | 经验记录 | 按事件 |
| details/archive/ | 归档记录 | 按需 |

## 设计原则

1. **纯 Markdown**: 无数据库，无外部服务，可 git 管理
2. **人类可读**: 所有文档可直接阅读和编辑
3. **简洁优先**: 核心 6 文件 + 4 目录
4. **追加优先**: patterns 和 learnings 只追加不重写
5. **区块分离**: MACHINE_BLOCK 与 USER_BLOCK 分离维护
6. **变更内聚**: 变更历史放在对应文档内

## 安全提示

⚠️ **不要在 Memory Bank 中存储敏感信息**：
- API 密钥、Token、密码
- 数据库连接字符串
- 私钥或证书
- 任何凭证信息

Memory Bank 设计为可 git 管理和团队共享，请确保不包含敏感数据。
