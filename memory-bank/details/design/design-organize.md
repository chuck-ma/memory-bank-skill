# Memory Bank 整理功能设计

> 更新于: 2026-01-27

## 概述

为 Memory Bank Skill 增加"整理记忆"功能，让 AI 自动分析 `memory-bank/` 目录下的文件，给出分类建议（迁移 + 新建目录），用户确认后执行。

## 触发方式

| 触发词 | 语言 |
|--------|------|
| `整理记忆`、`归类记忆`、`整理 memory bank` | 中文 |
| `organize memory`、`organize memory bank`、`tidy memory bank` | 英文 |

## 执行流程

```
用户: "整理记忆"
    │
    ▼
Phase A: 分析（默认）
    - 扫描 memory-bank/**/*.md
    - 生成迁移建议 + 新目录建议
    - 输出建议清单，不做任何改动
    │
    ▼
用户: "apply" / "确认执行"
    │
    ▼
Phase B: 执行
    - 创建新目录（如有）
    - 移动文件
    - 更新 _index.md（及子索引）
    - 修复 memory-bank/ 内相对链接
    - 输出变更报告
```

## 保护列表

以下文件/目录永不建议迁移：

- `_index.md`
- `brief.md`
- `tech.md`
- `active.md`
- `patterns.md`
- `progress.md`
- `archive/**`

## 分类规则

### 强规则路由（文件名/路径匹配）

| 文件模式 | 目标目录 |
|----------|----------|
| `REQ-*.md` | `requirements/` |
| `design-*.md`、`architecture.md` | `docs/` |
| `active_YYYY-MM.md` | `archive/` |
| `YYYY-MM-DD-*bug*.md` | `learnings/bugs/` |
| `YYYY-MM-DD-*perf*.md` | `learnings/performance/` |

### Learnings 分类回退

`learnings/` 下的文件如果不匹配 `bugs/`、`performance/`、`integrations/` 子目录规则：
- **保持原位**，不强制移动
- 可以低置信度建议归入某个子目录（用户自行判断）

### 新目录建议

仅在以下条件**全部满足**时建议新建子目录：

1. **父目录限制**：只允许在 `docs/`、`learnings/` 下新建
2. **数量阈值**：同主题文件数 >= 4
3. **主题来源**：文件名或 H1 标题中的高频关键词（如 `wechat`、`api`、`auth`）
4. **优先既有桶**：`learnings/` 下优先放入 `integrations/<topic>/`，而非直接 `learnings/<topic>/`

### 子索引处理

- **已有子索引**：更新 `docs/_index.md`、`learnings/_index.md` 等
- **未有子索引**：不自动创建，只更新根索引 `_index.md`

### 命名规范

- 全小写 ASCII、`kebab-case`
- 同义词折叠：`weixin/微信` → `wechat`
- 长度 <= 32 字符

## 输出格式

### 迁移建议

```markdown
## 迁移建议

| # | 当前路径 | 建议路径 | 原因 |
|---|----------|----------|------|
| 1 | wechat-auth.md | docs/wechat-auth.md | 文件名含 design 关键词 |
| 2 | REQ-002-login.md | requirements/REQ-002-login.md | REQ-* 模式匹配 |
```

### 新目录建议

```markdown
## 新目录建议

| # | 新目录 | 迁入文件 | 原因 |
|---|--------|----------|------|
| 1 | learnings/integrations/wechat/ | 2026-01-15-wechat-token.md, 2026-01-20-wechat-callback.md, ... | 4 个文件标题含 "wechat" |
```

### 确认提示

```
回复 `apply` 或 `确认执行` 执行以上变更。
回复 `apply 1,3` 只执行指定编号。
```

## 执行边界

| 约束 | 说明 |
|------|------|
| 作用范围 | 只改 `memory-bank/` 内文件 |
| 冲突处理 | 目标已存在同名文件时跳过，不覆盖 |
| 链接修复 | 只修复 `memory-bank/**` 内的 `[text](path.md)` 和 `![](path.png)` 形式链接 |
| 外部引用 | 不保证更新，报告中提示"需自查" |
| 默认执行 | `apply` 只执行强规则命中的迁移建议 |
| 新目录执行 | 新目录建议需显式选择：`apply 1` 或 `apply dirs` |
| 已在正确位置 | 文件已在目标目录下时，不输出建议 |

## 忽略机制

创建 `memory-bank/.organize-ignore` 文件，每行一个 glob 模式：

```
# 忽略特定文件
notes.md
drafts/**
# 忽略某个目录
experiments/**
```

被忽略的文件不会出现在建议列表中。

## 定义澄清

| 术语 | 定义 |
|------|------|
| 标题 | 文件的 H1 标题（`# xxx`），不含 H2/H3 |
| 主题关键词 | 从文件名和 H1 标题提取的 token |
| 高频 | 在候选文件组中出现 >= 60% |

## 变更报告

执行后输出：

```markdown
## 变更报告

- 创建目录: learnings/integrations/wechat/
- 移动文件: 4 个
- 更新索引: _index.md, learnings/_index.md
- 跳过: 1 个（冲突）
- 外部引用提示: docs/design-auth.md 可能被项目其他文件引用，请自查
```

## 与其他功能的关系

| 功能 | 关系 |
|------|------|
| 自动写入 | 整理不触发自动写入规则 |
| 归档 | 整理不触发归档，但会识别应归档的文件 |
| 索引更新 | 整理执行后自动更新索引 |
