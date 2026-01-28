# Memory Bank Writer 规则

> 此文档定义 Memory Bank 的写入规则，由主 Agent 或 Writer Agent 执行。

## 写入触发

| 事件 | 写入目标 |
|------|---------|
| 新需求确认 | `requirements/REQ-xxx.md` |
| 设计确定 | `docs/design-xxx.md` |
| 技术决策 | `patterns.md` |
| Bug 修复/踩坑 | `learnings/bugs/xxx.md` |
| 任务完成/焦点变更 | `active.md` |
| **初始化** | `brief.md` + `tech.md` + `_index.md` |

---

## 初始化流程

当 `memory-bank/` 目录不存在时：

1. 扫描项目结构（README.md、package.json、pyproject.toml 等）
2. 生成 `brief.md`（项目概述）
3. 生成 `tech.md`（技术栈）
4. 创建 `_index.md`（索引）

**扫描预算**：最多 10 个文件，每个最多 200 行。

---

## 写入规则（强制）

### 设计文档 (`docs/design-*.md`)

```
1. Glob("memory-bank/docs/design-*.md") 获取所有设计文档
2. 读取 _index.md 中的设计文档列表
3. 检查是否有相关文档：
   - 文件名包含相同关键词 → 更新该文件
   - 标题描述相同主题 → 更新该文件
   - 无匹配 → 创建新文件
4. 输出决策理由
```

### 需求文档 (`requirements/REQ-*.md`)

```
1. 读取 requirements/ 目录现有文件
2. 检查是否有相同需求（按标题/ID）
3. 有 → 更新；无 → 创建新 REQ-xxx.md
```

### 经验文档 (`learnings/**/*.md`)

```
1. 确定类型：bugs / performance / integrations
2. 检查是否有相同问题的记录
3. 有 → 追加或更新；无 → 创建新文件
4. 文件名格式：YYYY-MM-DD-{slug}.md
```

### 其他文件

| 文件 | 规则 |
|------|------|
| `active.md` | 始终更新（不创建新的） |
| `brief.md` | 始终更新（不创建新的） |
| `tech.md` | 始终更新（不创建新的） |
| `patterns.md` | 追加内容（不覆盖） |
| `_index.md` | 每次写入后自动更新 |

## 职责分离（核心原则）

**重要**：主 Agent 只说诉求，Writer 自主判断写入目标。

| 步骤 | 负责方 | 动作 |
|------|--------|------|
| 1 | 主 Agent | 输出更新计划（只说诉求和要点） |
| 2 | 主 Agent | 跟用户确认 |
| 3 | 用户 | 确认或拒绝 |
| 4 | 主 Agent | delegate 给 Writer（**只传诉求，禁止指定路径**） |
| 5 | **Writer** | **自主判断写入目标** → 执行写入 |

### 主 Agent 的 prompt 格式

```
诉求：{语义意图，如"记录 SDK pool 简化的设计变更"}
背景：{简要上下文}
要点：
1. {要点1}
2. {要点2}
```

**禁止**：主 Agent 在 prompt 中指定文件路径。

### Writer 自主判断流程

```
1. 解析诉求类型：
   - 设计变更 → docs/design-*.md
   - 新需求 → requirements/REQ-*.md
   - 技术决策 → patterns.md
   - Bug/踩坑 → learnings/**/*.md
   - 焦点变更 → active.md

2. Glob 检查现有文档：
   - 找到相关文档（文件名/标题匹配）→ 更新
   - 没找到 → 创建新文档

3. 执行写入 + 更新 _index.md

4. 输出决策报告
```

## 执行输出格式

执行完成后，输出报告：

```
[Memory Bank Writer 执行完成]

已执行：
- 创建: memory-bank/docs/design-auth.md (45 行)
- 更新: memory-bank/_index.md

状态：成功
```

如果执行前需要检查（如判断更新还是新建），输出决策理由后直接执行：

```
[Memory Bank Writer]

检查结果：
- Glob docs/design-*.md → 找到 3 个文件
- 相关文件：design-auth.md（标题含 "认证"）
- 决策：更新（而非新建）

执行写入...

已完成：
- 更新: memory-bank/docs/design-auth.md
- 更新: memory-bank/_index.md
```

## 索引更新

每次写入后，检查并更新 `_index.md`：

1. 新建文件 → 添加索引条目
2. 更新文件 → 更新 `updated` 和 `size` 字段
3. 删除文件 → 移除索引条目

---

## 自动清理（写入时执行）

### 目录文件数检查

写入 `learnings/`、`requirements/`、`docs/` 及其子目录时：

```
1. Glob 统计目标目录的 .md 文件数
2. 如果 > 20 个：
   - 分析文件主题（按文件名/标题聚类）
   - 同主题 >= 4 个文件 → 创建子目录迁移
   - 无明显主题 → 旧文件（> 90 天）移入 archive/
3. 更新 _index.md
```

### active.md 归档检查

写入 `active.md` 后：

```
1. 统计行数和已完成条目数（`- [x]`）
2. 如果行数 > 120 或已完成 > 20：
   - 创建/更新 archive/active_YYYY-MM.md
   - 移出：已完成条目 + 超过 30 天的变更记录
   - 保留：当前焦点、下一步、阻塞项、近 30 天变更
3. 更新 _index.md
```

归档文件格式：

```markdown
# Active Archive - YYYY-MM

> 归档于: YYYY-MM-DD

## 已完成条目
- {条目}

## 历史变更
| 日期 | 变更 |
|------|------|
```

### 保护规则

不参与清理：
- 根目录文件：`_index.md`、`brief.md`、`tech.md`、`active.md`、`patterns.md`、`progress.md`
- `archive/` 目录

## 禁止行为

- 不要跳过 Glob 检查（判断更新 vs 新建）
- 不要等待用户确认（确认已由主 Agent 前置完成）
- 不要修改 `memory-bank/` 以外的文件
- 不要删除文件（除非明确要求）
- 不要自行决定写入内容（内容由主 Agent 提供）

## 错误处理

如果写入失败：
1. 报告具体错误
2. 不要重试（让主 Agent 决定）
3. 保持已写入的文件（不回滚）

## 守卫机制

Plugin 层面强制执行：
- 只有 `memory-bank-writer` agent 能写入 `memory-bank/`
- 只允许写入 `.md` 文件
- 主 agent 直接写入会被阻止

## 已知限制

> 写入守卫是**策略守卫**，防止意外违规，不是安全边界。

| 限制 | 说明 |
|------|------|
| Bash 启发式 | 变量间接、eval、脚本无法检测 |
| Symlinks | 通过 symlink 可绕过路径检查 |
| 首次写入 | 可能因 race condition 被阻止一次（重试即可） |

---

## 区块分离

每个文件分为两个区块：

```markdown
<!-- MACHINE_BLOCK_START -->
（AI 自动维护，用户不要改）
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
（用户自由编辑，AI 不覆盖）
<!-- USER_BLOCK_END -->
```

冲突处理：检测到用户修改机器区块时，提示用户选择保留哪个版本。

---

## 自动提交模式

当用户回复"更新并提交"或"初始化并提交"时，执行以下流程：

### Preflight 检查（必须全部通过）

1. **确认是 git 仓库**：`git rev-parse --is-inside-work-tree`
2. **确认不在 merge/rebase/cherry-pick 中**
3. **确认无冲突文件**：`git diff --name-only --diff-filter=U` 必须为空
4. **确认有 git 身份**：`git config user.name` 和 `git config user.email` 非空
5. **确认有变更可提交**：`git status --porcelain` 非空

### 执行流程

1. **输出计划**，包含：
   - 将要更新的 memory-bank 文件
   - 将要提交的所有变更
   - **风险检查提醒**：确认没有 `.env`、凭证、大文件会被提交

2. **等待用户确认**

3. **执行更新**：
   - 写入 memory-bank 文件
   - 执行 `git add -A`
   - 执行 `git commit -m "chore(memory-bank): update <files>"`

### Commit Message 格式

单文件：
```
chore(memory-bank): update active.md

Auto-committed by Memory Bank.
```

多文件：
```
chore(memory-bank): update memory bank

Files updated:
- memory-bank/active.md
- memory-bank/_index.md
```

---

## 整理记忆（Organize）

当用户触发"整理记忆"时，分析 `memory-bank/` 目录结构，给出分类建议。

### 触发词

- 中文：`整理记忆`、`归类记忆`
- 英文：`organize memory`、`tidy memory bank`

### 执行流程

```
Phase A: 分析（默认）
    - 扫描 memory-bank/**/*.md
    - 生成迁移建议 + 新目录建议
    - 输出建议清单，不做任何改动

Phase B: 执行（用户确认后）
    - 用户回复 `apply` / `确认执行`
    - 创建新目录、移动文件、更新索引
```

### 保护列表（永不迁移）

- `_index.md`、`brief.md`、`tech.md`、`active.md`、`patterns.md`、`progress.md`
- `archive/**` 下所有文件

### 强规则路由

| 文件模式 | 目标目录 |
|----------|----------|
| `REQ-*.md` | `requirements/` |
| `design-*.md`、`architecture.md` | `docs/` |
| `active_YYYY-MM.md` | `archive/` |
| `YYYY-MM-DD-*bug*.md` | `learnings/bugs/` |
| `YYYY-MM-DD-*perf*.md` | `learnings/performance/` |

### 新目录建议

仅在以下条件**全部满足**时建议新建子目录：

1. **父目录限制**：只允许在 `docs/`、`learnings/` 下新建
2. **数量阈值**：同主题文件数 >= 4
3. **主题来源**：文件名或标题中的高频关键词

### 执行边界

- 只改 `memory-bank/` 内文件
- 目标已存在同名文件时跳过，不覆盖
- `apply` 只执行强规则命中的迁移建议
- 新目录建议需显式选择：`apply 1` 或 `apply dirs`
