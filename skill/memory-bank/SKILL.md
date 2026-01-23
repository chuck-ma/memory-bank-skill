---
name: memory-bank
description: 项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更
---

# Memory Bank Skill

## 概述

Memory Bank 是一个纯 Markdown 的项目记忆系统。通过结构化文档将"记忆"外化，实现：

- **自动读取**：基于语义理解，智能加载相关上下文
- **自动写入**：工作中沉淀发现、决策、经验
- **变更追踪**：需求变更、技术实现变更全程记录
- **零初始化**：无需手动 init，随项目推进自动创建

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
