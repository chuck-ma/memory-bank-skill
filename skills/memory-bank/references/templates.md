# Memory Bank 文件模板

> 此文件包含 Memory Bank 各文件的标准模板。创建新文件时参考此模板。

---

## MEMORY.md（单入口）

```markdown
# Memory Bank

> 项目记忆系统单入口。包含项目概览、当前焦点及详细文档路由。

<!-- MACHINE_BLOCK_START -->
## Project Snapshot
- **一句话描述**: {项目是什么}
- **核心目标**: {目标 1}
- **关键约束**: {约束 1}
- **技术栈**: {语言/框架}

## Current Focus
- **正在做什么**: {正在做什么}
- **下一步**:
  - [ ] {next 1}
- **阻塞项**: {blocker，无则写「无」}

## Routing Rules
> 引导 AI 寻找详细文档。

| 路径 | 标题 | 摘要 | 更新日期 |
|------|------|------|----------|
| details/tech.md | Tech Stack | 技术栈、命令与环境要求 | YYYY-MM-DD |
| details/patterns.md | Patterns | 技术决策与代码约定 | YYYY-MM-DD |
| details/progress.md | Progress | 功能完成状态与已知问题 | YYYY-MM-DD |
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## details/index.md（二级路由）

```markdown
# {目录名} 索引

> 自动维护，用于引导 AI 检索此目录下的详细文档。

| 路径 | 标题 | 摘要 | 状态/类型 | 更新日期 |
|------|------|------|-----------|----------|
```

---

## details/tech.md

```markdown
# Tech Stack

<!-- MACHINE_BLOCK_START -->
## 技术栈
| 层级 | 技术 |
|------|------|
| 语言 | {xxx} |
| 框架 | {xxx} |
| 数据库 | {xxx} |
| 部署 | {xxx} |

## 常用命令
    # 开发
    {dev command}

    # 测试
    {test command}

    # 构建
    {build command}

## 环境要求
- {requirement 1}
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 补充说明
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## details/progress.md

```markdown
# Progress

<!-- MACHINE_BLOCK_START -->
## 已完成
- [x] {feature 1}

## 进行中
- [ ] {feature 2} - {进度%}

## 待开发
- [ ] {feature 3}

## 已知问题
| ID | 问题 | 优先级 |
|----|------|--------|
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 备注
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## details/archive/*.md

```markdown
# Archive - {YYYY-MM}

<!-- MACHINE_BLOCK_START -->
> 归档于: {YYYY-MM-DD}

## 已完成条目
- {item}

## 最近变更（历史）
| 日期 | 变更 |
|------|------|
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 备注
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## details/patterns.md

```markdown
# Patterns & Decisions

<!-- MACHINE_BLOCK_START -->
## 技术决策
| 日期 | 决策 | 原因 |
|------|------|------|

## 代码约定
- {convention 1}
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 补充约定
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## details/requirements/REQ-{ID}-{slug}.md

```markdown
# REQ-{ID}: {标题}

<!-- MACHINE_BLOCK_START -->
## Status
{Proposed | Accepted | Implementing | Done | Deprecated}

## Summary
{一段话描述需求}

## Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## History
| 日期 | 变更 | 原因 |
|------|------|------|
| {date} | 创建需求 | - |
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## Notes
{用户补充说明}
<!-- USER_BLOCK_END -->
```

---

以下设计文档模板位于 `details/design/` 目录下。

## details/design/architecture.md

```markdown
# Architecture

> 更新于: {YYYY-MM-DD}

## 系统概览
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Layer 1   │────▶│   Layer 2   │────▶│   Layer 3   │
│    {名称}   │     │    {名称}   │     │    {名称}   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 模块划分
| 模块 | 职责 | 文档 |
|------|------|------|
| {module1} | {职责描述} | [modules/{module1}.md](modules/{module1}.md) |
| {module2} | {职责描述} | [modules/{module2}.md](modules/{module2}.md) |

## 关键流程

### {流程 1 名称}
```
{步骤 1} → {步骤 2} → {步骤 3} → {步骤 4}
```

### {流程 2 名称}
{流程描述}

## 变更记录
| 日期 | 变更 | 原因 | 影响 |
|------|------|------|------|
| {YYYY-MM-DD} | {变更内容} | {为什么改} | {影响范围} |
```

---

## details/design/modules/{module}.md

```markdown
# {Module} 模块

> 更新于: {YYYY-MM-DD}

## 职责
{模块负责什么，1-2 句话}

## 目录结构
```
src/{path}/
├── components/      # {说明}
├── hooks/           # {说明}
├── services/        # {说明}
└── types.ts         # {说明}
```

## 核心流程
```
{输入} → {处理1} → {处理2} → {输出}
```

## 对外接口
| 接口 | 说明 | 详见 |
|------|------|------|
| {接口名} | {说明} | [specs/{spec}.md](../specs/{spec}.md) |

## 依赖关系
- **依赖**: {本模块依赖的其他模块}
- **被依赖**: {依赖本模块的其他模块}

## 变更记录
| 日期 | 变更 | 原因 |
|------|------|------|
| {YYYY-MM-DD} | {变更内容} | {为什么改} |
```

---

## details/design/specs/{spec}.md

```markdown
# {Spec Name}

> 更新于: {YYYY-MM-DD}

## 接口定义

### {接口 1}
```typescript
// 输入
interface {Name}Input {
  field1: string
  field2: number
}

// 输出
interface {Name}Output {
  success: boolean
  data: {Type}
}
```

## 数据模型
```typescript
interface {Model} {
  id: string
  field1: string
  field2: number
  createdAt: Date
  updatedAt: Date
}
```

## 业务规则
- {规则 1}
- {规则 2}
- {规则 3}

## 边界情况
| 情况 | 处理方式 |
|------|----------|
| {情况 1} | {处理} |
| {情况 2} | {处理} |

## 变更记录
| 日期 | 版本 | 变更 | 原因 |
|------|------|------|------|
| {YYYY-MM-DD} | v1 | 初始版本 | - |
```

---

## details/design/design-{slug}.md

```markdown
# 设计文档: {标题}

## 状态
{提案 | 已确认 | 实现中 | 已完成}

## 背景
{问题背景与动机}

## 目标
- {目标 1}
- {目标 2}

## 方案

### 方案概述
{总体思路}

### 关键改动
- {改动 1}
- {改动 2}

## 风险与兜底
- {风险 1} → {兜底方案}

## 变更记录
| 日期 | 变更 | 原因 |
|------|------|------|
| {YYYY-MM-DD} | 创建 | - |
```

---

## details/learnings/{type}/{date}-{slug}.md

```markdown
# {标题}

<!-- MACHINE_BLOCK_START -->
> 日期: {YYYY-MM-DD}
> 类型: {bug | performance | integration}

## 问题
{问题描述}

## 症状
{如何发现的}

## 根因
{根本原因}

## 解决方案
{怎么解决的}

## 教训
{一句话总结}
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 补充
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```
