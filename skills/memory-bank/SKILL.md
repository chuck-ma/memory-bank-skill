---
name: memory-bank
description: 项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更
---

# Memory Bank Skill

## Memory Gate（必须执行）

开始任何工作前，按此顺序执行：

1. **Read** `memory-bank/_index.md`
2. **找到相关路径** → Read 这些文档
3. **然后** 才能使用 Glob/Grep/代码搜索

**禁止**：在完成步骤 1-2 前使用任何代码搜索工具。

---

## 目录速查

| 目录 | 用途 | 何时读 |
|------|------|--------|
| `_index.md` | 索引 | 每次必读 |
| `requirements/` | 需求文档 | 涉及功能/需求时 |
| `docs/` | 设计文档 | 涉及实现/架构时 |
| `learnings/` | 经验记录 | 遇到 bug/性能问题时 |
| `patterns.md` | 技术决策 | 涉及技术选型时 |
| `active.md` | 当前焦点 | 了解进行中的工作 |

---

## 目录结构

```
memory-bank/
├── _index.md                # 索引文件（AI 用于智能检索）
├── brief.md                 # 项目概述（稳定）
├── tech.md                  # 技术栈 + 环境 + 命令
├── active.md                # 当前焦点 + 下一步 + 阻塞项（高频更新）
├── progress.md              # 完成状态
├── patterns.md              # 技术决策 + 代码约定
│
├── requirements/            # 需求池
│   └── REQ-{ID}-{slug}.md
│
├── docs/                    # 技术文档
│   ├── architecture.md
│   ├── design-*.md
│   ├── modules/
│   └── specs/
│
├── learnings/               # 经验沉淀
│   ├── bugs/
│   ├── performance/
│   └── integrations/
│
└── archive/                 # 归档文件（按月）
    └── active_YYYY-MM.md
```

可选子索引（规模变大时启用）：
- `requirements/_index.md`
- `docs/_index.md`
- `learnings/_index.md`

---

## Bootstrap 流程（零初始化）

**每次用户对话时**：

```
1. 检测 memory-bank/ 目录是否存在
   │
   ├─ 存在 → 读取 _index.md + brief.md + active.md
   │         继续正常工作
   │
   └─ 不存在 → 检测是否有代码库
              │
              ├─ 有代码库 → 扫描项目结构（package.json, README 等）
              │             生成 brief.md + tech.md 草稿
              │             创建 _index.md
              │
              └─ 空目录 → 等用户开始工作后按需创建
```

**扫描预算**：最多 10 个文件，每个最多 200 行。

---

## 索引系统

### 根索引格式（_index.md）

```markdown
| path | title | summary | updated | size |
|------|-------|---------|---------|------|
| brief.md | Project Brief | 电商后台，核心是订单管理 | 2024-01-20 | 45 |
| tech.md | Tech Stack | Go + Gin + PostgreSQL | 2024-01-20 | 80 |
```

### 索引维护
- 创建/修改文件后自动更新索引
- 用户可手动编辑 summary 提升检索精度
- size 字段用于 context 预算控制

---

## 智能检索

### 每轮对话流程

```
1. 固定加载：brief.md + active.md + _index.md（如存在）

2. 语义判断：
   - 基于 _index.md 选择相关文件
   - 输出决策：{ files: [...], reason: "..." }

3. 按预算加载选中文件
```

### 预算限制
- 每轮最多加载 5 个额外文件
- 总行数限制 500 行
- 超出时优先加载小文件、新文件

### 风险提示
- 如果 learnings/ 下有相关历史经验
- 主动提醒："注意：历史上有类似问题 → {file}"

---

## 自动写入规则

### 触发时机

| 事件类型 | 触发条件 | 创建/更新 |
|---------|---------|----------|
| **New Entity** | 确定新需求/模块/API | requirements/REQ-xxx.md 或 docs/modules/xxx.md |
| **Design** | 新设计 / 重新设计 / 设计变更 | docs/design-{slug}.md（已存在则更新） |
| **Decision** | 技术选型确定，用户认可 | patterns.md |
| **Learning** | Bug 修复/性能优化/集成踩坑 | learnings/{type}/{date}-{slug}.md |
| **Archive** | active.md 超过 120 行或已完成条目超过 20 条 | archive/active_YYYY-MM.md |

### 归档判定

- 已完成条目 = `active.md` 中“已完成（待归档）”区块内的 `- [x]` 数量
- 若该区块缺失，可回退为统计 `active.md` 中所有 `- [x]` 项

### 不写入的情况
- 普通代码修改
- 探索性调研（未形成结论）
- 临时 debug（未确认根因）

### patterns vs 设计文档判定

用下面的判定避免混淆：

- **patterns.md**：全局/长期的技术决策或约定（"以后都这样做"、"统一选择 X"）
- **docs/design-*.md**：某个功能/模块/重构的具体实现方案（"这个功能怎么搭"）

快速判断：

- 问题是"该功能如何实现" → 写设计文档
- 问题是"我们以后统一怎么做/用什么" → 追加 patterns
- 两者都涉及 → 先写设计文档，再把最终技术决策沉淀到 patterns

### 写入前确认

```
[Memory Bank 更新计划]
- 创建: requirements/REQ-004-refund.md
- 更新: active.md
- 更新: _index.md

是否执行？
```

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

## 命令

| 触发 | 动作 |
|------|------|
| `更新记忆` / `update memory bank` | 全面检查并更新所有文件 |
| `新需求: {标题}` / `new req: {title}` | 创建需求文档 |
| `新模块文档: {名称}` / `new module doc: {name}` | 创建模块文档 |
| `记录经验: {类型}` / `log learning: {type}` | 创建经验文档（bug/performance/integration） |
| `项目状态` / `project status` | 汇总输出当前状态 |
| `整理记忆` / `organize memory` | 分析文件分类，给出迁移和新建目录建议 |

---

## 整理记忆（Organize）

当用户触发"整理记忆"时，分析 `memory-bank/` 目录结构，给出分类建议。

### 触发词

- 中文：`整理记忆`、`归类记忆`、`整理 memory bank`
- 英文：`organize memory`、`organize memory bank`、`tidy memory bank`

### 执行流程

```
Phase A: 分析（默认）
    - 扫描 memory-bank/**/*.md
    - 生成迁移建议 + 新目录建议
    - 输出建议清单，不做任何改动

Phase B: 执行（用户确认后）
    - 用户回复 `apply` / `确认执行`
    - 创建新目录、移动文件、更新索引
    - 输出变更报告
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

**命名规范**：全小写 ASCII、`kebab-case`、长度 <= 32 字符

### 输出格式

**迁移建议**：

```markdown
## 迁移建议

| # | 当前路径 | 建议路径 | 原因 |
|---|----------|----------|------|
| 1 | wechat-auth.md | docs/wechat-auth.md | 文件名含 design 关键词 |
```

**新目录建议**：

```markdown
## 新目录建议

| # | 新目录 | 迁入文件 | 原因 |
|---|--------|----------|------|
| 1 | learnings/integrations/wechat/ | file1.md, file2.md, ... | 4 个文件标题含 "wechat" |
```

**确认提示**：

```
回复 `apply` 或 `确认执行` 执行以上变更。
```

### 执行边界

- 只改 `memory-bank/` 内文件
- 目标已存在同名文件时跳过，不覆盖
- 只修复 `memory-bank/**` 内的 `[text](path.md)` 形式链接
- `apply` 只执行强规则命中的迁移建议
- 新目录建议需显式选择：`apply 1` 或 `apply dirs`
- 文件已在正确位置时不输出建议

### 忽略机制

创建 `memory-bank/.organize-ignore` 文件可忽略特定文件/目录（glob 模式）。

### Learnings 回退

`learnings/` 下不匹配子目录规则的文件保持原位，不强制移动。

---

## 设计原则

1. **零初始化**：不需要手动 init
2. **语义检索**：纯 AI 理解，不用关键词匹配
3. **索引驱动**：通过 _index.md 支撑快速检索
4. **区块分离**：机器区块自动维护，用户区块自由编辑
5. **写前确认**：重要写入前输出计划
6. **预算控制**：每轮加载有上限
7. **人类可读**：所有文档可直接阅读、编辑、git 管理

---

## 自动提交模式

当用户回复"更新并提交"或"初始化并提交"时，执行以下流程：

### Preflight 检查（必须全部通过）

执行以下检查，任一失败则中止并解释原因：

1. **确认是 git 仓库**：`git rev-parse --is-inside-work-tree`
2. **确认不在 merge/rebase/cherry-pick 中**：
   - `git rev-parse --git-path MERGE_HEAD` 返回的文件不存在
   - `git rev-parse --git-path rebase-merge` 返回的目录不存在
   - `git rev-parse --git-path rebase-apply` 返回的目录不存在
   - `git rev-parse --git-path CHERRY_PICK_HEAD` 返回的文件不存在
3. **确认无冲突文件**：`git diff --name-only --diff-filter=U` 必须为空
4. **确认有 git 身份**：`git config user.name` 和 `git config user.email` 非空
5. **确认有变更可提交**：`git status --porcelain` 非空

### 执行流程

1. **输出计划**，包含：
   - 将要更新的 memory-bank 文件
   - 将要提交的所有变更（`git status --porcelain`）
   - **风险检查提醒**：确认没有 `.env`、凭证、大文件会被提交
   - 如果已有 staged 变更，明确告知"将包含已 staged 的文件"

2. **等待用户确认**

3. **执行更新**：
   - 写入 memory-bank 文件
   - 执行 `git add -A`
   - 执行 `git diff --cached --name-only` 显示将提交的文件
   - 执行 `git commit -m "chore(memory-bank): update <files>"`

### Commit Message 格式

```
chore(memory-bank): update active.md

Auto-committed by Memory Bank.
```

多文件时：
```
chore(memory-bank): update memory bank

Files updated:
- memory-bank/active.md
- memory-bank/_index.md
```

### 失败处理

- **Preflight 失败**：不执行任何操作，解释原因和修复方法
- **Commit 失败**（如 hook 拒绝）：报告错误，memory-bank 文件已写入但未提交，用户手动处理

---

## 安全护栏

### 禁止写入
- API 密钥、密码、token
- 客户隐私数据
- 任何凭证信息

### 防止幻觉
- 默认只读取 _index.md 中列出的文件
- 用户明确指定路径时允许读取，并补充到索引
- 创建新文件后必须同步更新索引

---

## 每轮行为规范

```
1. Bootstrap 检查（每次用户对话）
   └─ 检测 memory-bank/ 是否存在

2. 固定加载
   └─ 读取 brief.md + active.md + _index.md

3. 语义选择文件
   └─ 基于 _index.md 选择相关文件
   └─ 按预算限制加载

4. 处理用户请求
   └─ **文档驱动开发原则**：
      - 方案讨论确定后 → 先写 memory-bank/docs/design-xxx.md，再写代码
      - 设计文档是契约，代码要符合文档
      - 实现完成后回顾：如有偏差，决定改文档还是改实现
   └─ 创建 todo 时：
      - 方案讨论完成后开始落地 → 第一项是"写入设计文档到 memory-bank/docs/"
      - 已有 memory-bank/ → 最后一项必须是"更新 Memory Bank"
      - 没有 memory-bank/ → 第一项是"初始化 Memory Bank"，最后一项是"更新 Memory Bank"
   └─ 正常工作

5. 执行"更新 Memory Bank" todo 时
   └─ 检查触发场景：
      - 方案讨论确定 / 设计变更 → 检查 docs/design-*.md 是否已存在
        - 存在 → 更新该文档
        - 不存在 → 创建新文档
      - 修改了代码/配置文件 → 更新 active.md
      - 修复了 bug / 踩坑经验 → 创建 learnings/xxx.md
      - 做了技术决策 → 追加 patterns.md
   - 新需求确认 → 创建 requirements/REQ-xxx.md
   - active.md 超出归档阈值 → 归档到 archive/active_YYYY-MM.md 并清理 active.md
   └─ 命中任一条件 → 输出 memory_ops 计划

6. 执行写入
   └─ 用户确认后执行
```

---

## 读取行为规范

当 system prompt 注入 Memory Bank Bootstrap（当前无 `[Memory Bank]` 头部通知）时，遵循以下规范：

### 0. Memory-first 原则（强制）

**任何问题，先假设"可能已经记录过"**。

| 问题类型 | 优先查 |
|---------|--------|
| 当前在做什么/下一步 | active.md |
| 项目是什么/概述 | brief.md |
| 怎么设计的/为什么这样实现 | docs/design-*.md |
| 为什么选这个方案/技术决策 | patterns.md |
| 遇到过这问题吗/踩坑经验 | learnings/ |
| 需求背景/功能定义 | requirements/ |
| 怎么跑/怎么测试/环境配置 | tech.md、docs/ |

**搜索顺序**：`_index.md` → 对应目录 → 代码

**强制规则**：
- 找到答案 → 引用文件路径，直接回答
- `_index.md` 与对应目录检索无果，或找到但与代码/行为不一致 → 才读代码
- **若因文档缺失/过时而读了代码 → 这本身就是写入触发点**
  - 在回复中点名要新增/更新的目标文件路径（docs/learnings/patterns.md/requirements/）
  - 说明要写入的 1-2 个要点

**冲突处理**：当文档与代码不一致时，以代码为准，但必须提议更新文档并引用路径。

### 1. 显式声明上下文来源

回答问题时，简短说明参考了哪些 Memory Bank 文件：

```
基于 brief.md 和 active.md，当前项目是...
```

### 2. 不把 Memory Bank 当真理

Memory Bank 可能过时。如果与代码/配置矛盾：
- **优先以仓库实际内容为准**
- 建议更新 Memory Bank（走写入流程）

### 3. 引用驱动的继续阅读

如果 `active.md` 或 `_index.md` 提到：
- `REQ-xxx` → 读取对应需求文档
- `patterns.md` → 读取技术决策
- 某模块文档 → 读取该文档

将这些当作**高优先级读取目标**。

### 4. 陈旧检测

当 `active.md` 的"当前焦点"与用户最新目标明显不一致时：
- 先澄清："active.md 记录的焦点是 X，你现在想做 Y，是否需要更新？"
- 或直接建议更新（走写入流程）

### 5. 输出边界

上下文不足时：
- **先用工具**（grep/read）查找相关文件
- **禁止**仅凭 Memory Bank 缺失就断言"不存在"或"没有"

---

## 详细参考

- [文件模板](references/templates.md) - 各文件的标准模板
- [高级规则](references/advanced-rules.md) - 冲突处理、阈值规则、预算控制
- [结构化输出 Schema](references/schema.md) - JSON 输出格式定义
