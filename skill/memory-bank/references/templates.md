# Memory Bank 文件模板

> 此文件包含 Memory Bank 各文件的标准模板。创建新文件时参考此模板。

---

## _index.md（根索引）

```markdown
# Memory Bank Index

> 自动维护，可手工编辑 summary 以提升检索精度

| path | title | summary | updated | size |
|------|-------|---------|---------|------|
```

---

## brief.md

```markdown
# Project Brief

<!-- MACHINE_BLOCK_START -->
## 一句话描述
{项目是什么}

## 核心目标
- {目标 1}
- {目标 2}

## 边界
- 包含: {范围内}
- 不包含: {范围外}

## 关键约束
- {约束 1}
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 补充说明
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## tech.md

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

## active.md

```markdown
# Active Context

<!-- MACHINE_BLOCK_START -->
> 更新于: {YYYY-MM-DD HH:mm}

## 当前焦点
{正在做什么}

## 下一步
1. {next 1}
2. {next 2}

## 阻塞项
- {blocker，无则写「无」}

## 最近变更
| 日期 | 变更 |
|------|------|
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
```

---

## progress.md

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

## patterns.md

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

## requirements/REQ-{ID}-{slug}.md

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

## learnings/{type}/{date}-{slug}.md

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
