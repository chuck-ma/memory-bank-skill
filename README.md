# Memory Bank Skill 使用说明

> 项目记忆系统 - 让 AI 助手在每次对话中都能快速理解项目上下文

---

## 目录

1. [什么是 Memory Bank](#什么是-memory-bank)
2. [安装方法](#安装方法)
3. [快速开始](#快速开始)
4. [核心特性](#核心特性)
5. [命令参考](#命令参考)
6. [文件结构说明](#文件结构说明)
7. [智能检索机制](#智能检索机制)
8. [自动触发机制](#自动触发机制)
9. [最佳实践](#最佳实践)
10. [常见问题](#常见问题)

---

## 什么是 Memory Bank

Memory Bank 是一个 OpenCode 技能（Skill），用于解决 AI 对话的 **上下文丢失** 问题。

### 痛点

每次开始新对话时，AI 助手都会"失忆"：
- 不记得项目用了什么技术栈
- 不记得之前做了什么决策
- 不记得当前在做什么任务
- 重复问同样的问题

### 解决方案

Memory Bank 通过一组结构化的 Markdown 文件来持久化项目上下文：
- **零初始化**：不需要手动 init，随项目推进自动创建
- **智能检索**：基于 AI 语义理解，自动加载相关上下文
- **自动写入**：工作过程中自动记录重要发现和决策
- **人机分离**：机器自动维护的内容和用户手动编辑的内容分开

---

## 安装方法

### 一键安装

```bash
bunx memory-bank-skill install
```

然后**重启 OpenCode**，完成！

**验证安装**：
```bash
bunx memory-bank-skill doctor
```

---

### 安装做了什么？

| 操作 | 目标路径 |
|------|----------|
| 复制 Skill 文件 | `~/.claude/skills/memory-bank/` |
| 复制 Plugin 文件 | `~/.config/opencode/plugin/memory-bank.ts` |
| 配置 opencode.json | 添加 `permission.skill` 和插件注册 |
| 配置 CLAUDE.md | 添加启动指令 |
| 安装依赖 | `~/.config/opencode/node_modules/` |

---

### 手动安装（不推荐）

<details>
<summary>点击展开手动安装步骤</summary>

#### 步骤一：复制 Skill 文件

**全局安装**：

```bash
mkdir -p ~/.claude/skills/memory-bank
cp -r /path/to/memory-bank-skill/skill/memory-bank/* ~/.claude/skills/memory-bank/
```

**项目级安装**：

```bash
cd /path/to/your-project
mkdir -p .claude/skills/memory-bank
cp -r /path/to/memory-bank-skill/skill/memory-bank/* .claude/skills/memory-bank/
```

#### 步骤二：启用 Skill 权限

> ⚠️ **重要**：OpenCode 默认不启用 skill 功能，必须在配置中显式开启。

在全局配置 `~/.config/opencode/opencode.json` 中添加 `permission.skill`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "skill": "allow"
  }
  // ... 其他配置
}
```

或者在项目级 `opencode.json`（项目根目录）中添加同样的配置。

**验证权限生效**：
```bash
# 重启 OpenCode 后，在项目目录下运行
opencode debug skill
```

### 步骤三：配置启动指令（关键步骤）

> ⚠️ **重要**：OpenCode 的 Skill 是按需加载的（on-demand），不会自动注入系统提示词。
> 要实现"每轮自动读/写"，必须在配置文件中添加启动指令。

#### 全局配置（推荐）

在 `~/.claude/CLAUDE.md` 文件中添加以下内容，所有项目都会生效：

```markdown
## Memory Bank（项目记忆系统）

每次会话开始时，检查 `memory-bank/` 目录：

1. **存在** → 读取 `memory-bank/brief.md` + `memory-bank/active.md` 获取项目上下文
2. **不存在** → 首次工作时扫描项目结构（README.md、pyproject.toml 等），创建 `memory-bank/` 并生成 `brief.md` + `tech.md`

工作过程中，检测到以下事件时按 `/memory-bank` skill 规则写入：
- **新需求**：创建 `requirements/REQ-xxx.md`
- **技术决策**：追加到 `patterns.md`
- **经验教训**（bug/性能/集成踩坑）：创建 `learnings/xxx.md`

写入前输出计划，等待用户确认。详细规则见 `~/.claude/skills/memory-bank/SKILL.md`。
```

#### 项目级配置

如果只想在特定项目启用，在项目根目录的 `AGENTS.md`（或 `.claude/settings.md`）文件中添加同样的内容：

```markdown
## Memory Bank（项目记忆系统）

每次会话开始时，检查 `memory-bank/` 目录：

1. **存在** → 读取 `memory-bank/brief.md` + `memory-bank/active.md` 获取项目上下文
2. **不存在** → 首次工作时扫描项目结构（README.md、pyproject.toml 等），创建 `memory-bank/` 并生成 `brief.md` + `tech.md`

工作过程中，检测到以下事件时按 `/memory-bank` skill 规则写入：
- **新需求**：创建 `requirements/REQ-xxx.md`
- **技术决策**：追加到 `patterns.md`
- **经验教训**（bug/性能/集成踩坑）：创建 `learnings/xxx.md`

写入前输出计划，等待用户确认。详细规则见 `.claude/skills/memory-bank/SKILL.md`。
```

#### 步骤四：验证安装

```bash
# 在项目目录下运行
opencode debug skill
```

应该看到类似输出：

```json
[
  {
    "name": "memory-bank",
    "description": "项目记忆系统 - 自动读取上下文、自动沉淀发现、追踪需求与技术变更"
  }
]
```

#### 为什么需要这些步骤？

| 组件 | 作用 |
|------|------|
| `SKILL.md` | 定义完整的 Memory Bank 规则（文件结构、写入格式、冲突处理等） |
| `permission.skill` | 让 OpenCode 识别并加载 skill（**不配置 = skill 不可用**） |
| `CLAUDE.md` 配置 | 让 AI 在每轮对话开始时**主动检查和加载** Memory Bank |
| `memory-bank.ts` 插件 | 自动注入上下文 + 文件修改后提醒更新 |

只装 Skill 不配置权限 = OpenCode 根本不知道有这个 skill。
只装 Skill + 权限，不配置 CLAUDE.md = AI 知道有这个能力，但不会主动使用。
不装 Plugin = 没有自动提醒功能，AI 可能忘记更新 Memory Bank。

---

## 快速开始

### 零初始化

**不需要手动执行任何初始化命令。**

Memory Bank 会在你开始工作时自动检测和创建：

| 场景 | AI 行为 |
|------|---------|
| **已有代码库** | 扫描 package.json/README 等，自动生成 brief.md + tech.md |
| **新项目** | 不创建任何文件，等你开始工作后按需创建 |
| **已有 Memory Bank** | 直接读取 brief.md + active.md，恢复上下文 |

### 开始使用

直接开始工作即可。AI 会自动：
1. 检测项目结构，理解这是什么项目
2. 在工作过程中自动更新相关文件
3. 记录重要的技术发现和决策

### 用户可以随时编辑

所有 Memory Bank 文件都是普通 Markdown，你可以随时手动编辑。

每个文件分为两个区块：
- **机器区块**：AI 自动维护，不建议手动改
- **用户区块**：你自由编辑，AI 不会覆盖

```markdown
<!-- MACHINE_BLOCK_START -->
这里是 AI 自动维护的内容
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
这里是你自由编辑的区域
<!-- USER_BLOCK_END -->
```

---

## 核心特性

### 1. 零初始化

- 不需要 `init` 命令
- 首次使用时自动检测项目结构
- 按需创建文件，不预创建空文件

### 2. 智能索引

- `_index.md` 文件记录所有文件的摘要
- AI 通过索引快速判断哪些文件与当前任务相关
- 你可以手动编辑索引的 summary 字段，提升检索精度

### 3. 语义检索

- 不用关键词匹配，完全基于 AI 理解
- 每轮对话自动判断需要加载哪些文件
- 有预算控制，防止加载太多内容

### 4. 区块分离

- 机器区块：AI 自动维护
- 用户区块：你自由编辑
- 检测到冲突时会提示你选择，不会强制覆盖

### 5. 风险提示

- 如果 learnings/ 下有相关历史经验
- AI 会主动提醒"注意：历史上有类似问题"
- 帮你避免踩同样的坑

---

## 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `update memory bank` | 手动触发全面更新 | `更新记忆` |
| `new req: <名称>` | 创建新需求文档 | `new req: 用户登录功能` |
| `new module doc: <名称>` | 创建新模块文档 | `new module doc: 认证模块` |
| `log learning: <类型>` | 记录经验教训 | `log learning: bug` |
| `project status` | 生成项目状态报告 | `项目状态` |

### 命令详解

#### `update memory bank`

手动触发更新，会：
- 同步 active.md 中的当前任务状态
- 更新 progress.md 的进度
- 整理 patterns.md 中的新规范
- 同步更新 _index.md 索引

#### `new req: <需求名称>`

创建新的需求文档。

```
new req: 用户登录功能
```

生成文件：`memory-bank/requirements/REQ-001-用户登录功能.md`

#### `new module doc: <模块名称>`

创建新的模块文档。

```
new module doc: 认证模块
```

生成文件：`memory-bank/docs/modules/auth.md`

#### `log learning: <类型>`

记录经验教训，类型可选：
- `bug` - Bug 修复经验
- `performance` - 性能优化经验
- `integration` - 集成踩坑经验

**注意**：经验必须包含完整的四要素才会被记录：
- 症状：如何发现问题
- 根因：根本原因是什么
- 解决方案：怎么修的
- 预防措施：如何避免再次发生

#### `project status`

生成当前项目状态的完整报告。

---

## 文件结构说明

```
memory-bank/
├── _index.md                # 索引文件（AI 用于智能检索）
├── brief.md                 # 项目概述（稳定）
├── tech.md                  # 技术栈 + 环境 + 命令
├── active.md                # 当前焦点 + 下一步 + 阻塞项
├── progress.md              # 完成状态
├── patterns.md              # 技术决策 + 代码约定
│
├── requirements/            # 需求池
│   ├── _index.md            # 需求索引
│   └── REQ-{ID}-{slug}.md   # 单个需求
│
├── docs/                    # 技术文档
│   ├── _index.md            # 文档索引
│   ├── architecture.md      # 架构设计
│   ├── modules/             # 模块文档
│   └── specs/               # 技术规格
│
└── learnings/               # 经验沉淀
    ├── _index.md            # 经验索引
    ├── bugs/                # Bug 修复经验
    ├── performance/         # 性能优化经验
    └── integrations/        # 集成踩坑经验
```

### 核心文件

| 文件 | 用途 | 更新频率 |
|------|------|----------|
| `_index.md` | 索引，让 AI 快速判断加载哪些文件 | 每次文件变更时更新 |
| `brief.md` | 项目概览，"这是什么项目" | 很少更新 |
| `active.md` | 当前任务，"现在在做什么" | 每次会话更新 |
| `tech.md` | 技术栈详情 | 技术变更时更新 |
| `patterns.md` | 技术决策和代码约定 | 有新决策时追加 |

---

## 智能检索机制

### 工作原理

1. **固定加载**：每轮对话自动读取 brief.md + active.md
2. **读取索引**：读取 _index.md 了解有哪些文件可选
3. **语义判断**：基于你的消息内容，AI 判断哪些文件相关
4. **按需加载**：加载相关文件，受预算限制

### 预算控制

- 每轮最多加载 5 个额外文件
- 总行数限制 500 行（约 10k tokens）
- 超出时优先加载小文件、新文件

### 风险提示

如果 learnings/ 下有与当前任务相关的经验，AI 会主动提醒：

```
注意：历史上有类似问题 → learnings/bugs/2024-01-20-payment-timeout.md
是否需要查看？
```

---

## 自动触发机制

### 自动创建文件

| 触发事件 | 创建文件 |
|----------|----------|
| 确定新需求 | requirements/REQ-xxx.md |
| 确定新模块 | docs/modules/xxx.md |
| 确定新 API 规格 | docs/specs/xxx.md |

### 自动更新文件

| 触发事件 | 更新文件 |
|----------|----------|
| 技术选型决策 | patterns.md |
| 代码约定确定 | patterns.md |
| 架构变更 | docs/architecture.md |
| 任务完成/开始 | active.md, progress.md |

### 自动记录经验

| 触发事件 | 创建文件 |
|----------|----------|
| 修复棘手 bug | learnings/bugs/xxx.md |
| 性能优化 | learnings/performance/xxx.md |
| 第三方踩坑 | learnings/integrations/xxx.md |

### 写入前确认

重要写入前，AI 会输出计划让你确认：

```
[Memory Bank 更新计划]
- 创建: requirements/REQ-004-refund.md（退款功能需求）
- 更新: active.md（更新当前焦点）
- 更新: _index.md（添加新文件索引）

是否执行？
```

---

## OpenCode 插件系统（自动读写）

> ⚠️ **重要**：这是 v3.1 新增的核心功能，解决了 AI "忘记读/写 Memory Bank" 的问题。

### 问题背景

之前的方案依赖 AI 主动遵循 SKILL.md 中的规则，但 AI 可能会忘记：
- 忘记在会话开始时读取 Memory Bank
- 忘记在会话结束时检查是否需要更新

### 解决方案：统一插件

Memory Bank 现在使用**单一统一插件** `memory-bank.ts`，实现**真正的自动化**：

| 功能 | 说明 | 触发时机 |
|------|------|----------|
| **自动读取** | 将 Memory Bank 内容注入 system prompt | 每次 LLM 调用前 |
| **自动提醒更新** | 检测文件修改和关键词，提醒更新 | AI 尝试停止时 |

### 插件功能 1：自动读取

**工作原理**：

```
用户发消息 → OpenCode 调用 LLM 前
                ↓
        experimental.chat.system.transform hook 触发
                ↓
        插件读取 memory-bank/{brief.md, active.md, _index.md}
                ↓
        注入到 system prompt
                ↓
        AI 收到请求时已包含项目上下文
```

**特性**：
- 每次 LLM 调用都自动注入（不只是会话开始）
- 文件缓存 + mtime 检测：只有文件变更才重新读取
- Compact 保留：`experimental.session.compacting` hook 确保压缩后上下文不丢失
- 12,000 字符上限，超出自动截断

### 插件功能 2：自动提醒更新

**工作原理**：

```
对话过程中：
  ├─ 检测用户消息关键词（新需求、bug、决策等）
  ├─ 跟踪文件修改（edit/write 工具调用）
  ├─ 从文件路径动态派生项目根目录（查找 .git/ 或 .opencode/）
  └─ 检测是否已更新 Memory Bank

AI 尝试停止时（stop hook）：
  ├─ 遍历本次会话触碰的所有项目根目录
  ├─ 对每个项目独立评估是否需要提醒
  └─ 如果有未处理的触发事件 → 注入系统提醒
```

**多项目支持**：

插件支持在单个 OpenCode 会话中同时操作多个项目：

| 特性 | 说明 |
|------|------|
| **动态根目录派生** | 从文件路径向上查找 `.git/` 或 `.opencode/`，自动识别所属项目 |
| **按 (sessionId, root) 隔离状态** | 不同项目的文件修改、关键词检测、escape valve 独立计数 |
| **多项目 reminder** | stop 时遍历所有触碰的项目，每个项目独立触发 INIT 或 UPDATE 提醒 |
| **提醒包含项目路径** | 提醒消息中显示具体项目名称和路径，避免混淆 |

**触发条件**：

| 触发类型 | 条件 | 说明 |
|---------|------|------|
| **文件修改** | 修改 ≥1 个文件 | 任何代码/配置/文档文件 |
| **关键词检测** | 用户消息包含特定词 | 见下表 |

**跟踪的文件类型**：

```
代码：.py .ts .tsx .js .jsx .go .rs
文档：.md
配置：.json .yaml .yml .toml
样式：.css .scss
模板：.html .vue .svelte
```

**排除的目录**：

- 自动读取项目的 `.gitignore` 文件（基础支持：目录名匹配，不支持 glob 通配符如 `*.log`）
- 硬编码排除：`node_modules/`, `.venv/`, `venv/`, `dist/`, `build/`, `.next/`, `.nuxt/`, `coverage/`, `.pytest_cache/`, `__pycache__/`, `.git/`, `.opencode/`, `.claude/`, `memory-bank/`

**关键词列表**：

| 类别 | 关键词（中文） | 关键词（英文） |
|------|---------------|---------------|
| 新需求 | 新需求、需要实现、要做一个 | new req, feature request |
| 技术决策 | 决定用、选择了、我们用、技术选型、决策 | architecture |
| Bug/踩坑 | bug、修复、问题、踩坑、教训 | fix, error |

**逃逸阀**：

| 方式 | 说明 |
|------|------|
| 回复"无需更新"或"不需要更新"或"已检查" | 本次会话不再提醒更新 |
| 回复"跳过初始化"或"skip init" | 本次会话不再提醒初始化 |
| 环境变量 `MEMORY_BANK_DISABLED=1` | 完全禁用提醒 |

**两种提醒模式**：

| 场景 | 提醒内容 |
|------|---------|
| 项目**无** `memory-bank/` 目录 | 提醒**初始化** Memory Bank |
| 项目**有** `memory-bank/` 目录 | 提醒**更新** Memory Bank |

### 日志与排查

插件使用 OpenCode 官方日志系统（`client.app.log()`），日志可通过以下方式查看：

| 方式 | 说明 |
|------|------|
| TUI 内查看 | 按 `Ctrl+L` 切换日志视图 |
| 命令行输出 | `opencode --print-logs` |
| 日志文件 | `~/.local/share/opencode/log/*.log`（如有差异，运行 `opencode debug paths` 查看） |
| AI Agent 读取 | `rg -n "memory-bank" ~/.local/share/opencode/log/*.log` |

**日志级别**：

| 级别 | 默认状态 | 内容 |
|------|----------|------|
| INFO | ✅ 开启 | 关键检查点：插件初始化、文件跟踪汇总、stop 决策摘要、reminder 触发结果 |
| WARN/ERROR | ✅ 开启 | 失败信息：`client.session.prompt` 调用失败等 |
| DEBUG | ❌ 关闭 | 详细信息：每个文件的 isTrackable 判断、缓存命中、pending call 注册等 |

**启用 DEBUG 日志**：

```bash
# 方式一：OpenCode 全局（推荐）
opencode --log-level DEBUG

# 方式二：插件级环境变量
MEMORY_BANK_DEBUG=1 opencode
```

**排查"为什么没触发提醒"**：

查看日志中的 **stop 决策摘要**（`[STOP DECISION]`），它会输出：
- `filesModified`: 本次会话修改的文件数
- `hasMemoryBank`: 是否检测到 memory-bank 目录
- `memoryBankUpdated/reminderFired/memoryBankReviewed/skipInit`: 各种 escape valve 状态
- `decision`: 最终决策（SKIP/FIRE_INIT/FIRE_UPDATE/NO_TRIGGER）
- `reason`: 跳过或触发的原因

### 安装插件

#### 方式一：全局安装（推荐）

```bash
# 1. 复制到全局插件目录
mkdir -p ~/.config/opencode/plugin
cp /path/to/memory-bank-skill/plugin/memory-bank.ts ~/.config/opencode/plugin/

# 2. 创建全局 package.json（如果不存在）
cat > ~/.config/opencode/package.json << 'EOF'
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.1.14"
  }
}
EOF

# 3. 安装依赖
cd ~/.config/opencode && bun install
```

**终端 OpenCode vs Desktop App 的区别**：

| 模式 | 插件加载方式 |
|------|-------------|
| **终端 `opencode`** | 自动扫描 `~/.config/opencode/plugin/*.ts`，无需额外配置 |
| **Desktop App (serve)** | 必须在 `opencode.json` 的 `plugin` 数组中显式注册 |

如果使用 Desktop App，需要在 `~/.config/opencode/opencode.json` 中添加：

```json
{
  "plugin": [
    "oh-my-opencode",
    "file:///Users/YOUR_USERNAME/.config/opencode/plugin/memory-bank.ts"
  ]
}
```

⚠️ **重要**：修改配置后必须重启 OpenCode 才能生效（插件只在启动时加载，无热更新）。

#### 方式二：项目级安装

```bash
# 进入项目目录
cd /path/to/your-project

# 创建 .opencode/plugin 目录
mkdir -p .opencode/plugin

# 复制插件文件
cp /path/to/memory-bank-skill/plugin/memory-bank.ts .opencode/plugin/

# 创建 package.json（如果不存在）
cat > .opencode/package.json << 'EOF'
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.1.14"
  }
}
EOF

# 安装依赖
cd .opencode && bun install
```

### 验证插件生效

```bash
# 重启 OpenCode 后，用 DEBUG 模式验证插件加载：
MEMORY_BANK_DEBUG=1 opencode --print-logs

# 启动时应该看到：
# service=plugin path=file:///.../memory-bank.ts loading plugin
# service=memory-bank Plugin initialized (unified) {"projectRoot":"..."}
```

如果插件生效，AI 应该能**不读取任何文件**就直接回答项目概述（因为 Memory Bank 内容已自动注入）。

### 触发条件说明

**Q: 什么情况会触发提醒？**

有任何一种情况就会触发：

1. **文件修改**：修改了 1 个或更多代码/配置/文档文件
2. **关键词检测**：用户消息包含上述关键词

**设计理念**：

- 只要有文件改动，就值得检查是否需要更新 Memory Bank
- 关键词作为额外信号，帮助识别重要事件类型
- 用户可回复"无需更新"跳过提醒

---

## 最佳实践

### 1. 保持 brief.md 精简

brief.md 每次会话都会被读取，应该：
- 控制在 50 行以内
- 只包含最核心的信息
- 避免冗余描述

### 2. 善用用户区块

每个文件都有用户区块，可以自由记录：
- 临时笔记
- 待办事项
- 个人备注

AI 不会覆盖这部分内容。

### 3. 编辑索引提升检索

你可以手动编辑 _index.md 中的 summary 字段，让描述更精准，提升 AI 的检索准确度。

### 4. 记录技术决策的原因

在 patterns.md 中，不只记录"用了什么"，还要记录"为什么"和"取舍"：

```markdown
| 日期 | 决策 | 原因 | 取舍 | 适用范围 |
|------|------|------|------|----------|
| 2024-01-22 | 用 pkg/errors | 支持 stack trace | 放弃标准 errors | 业务逻辑层 |
```

### 5. 记录完整的经验

经验必须包含四要素：症状、根因、解决方案、预防措施。

**不好的记录**：
```
问题：支付超时
解决：改了超时时间
```

**好的记录**：
```
问题：支付超时
症状：高峰期支付成功率下降到 60%
根因：默认超时 3s，支付宝网关响应 P99 = 4.2s
解决：超时改为 10s + 增加重试 2 次
预防：添加支付耗时监控告警，P99 > 5s 时报警
```

### 6. 提交到 Git

Memory Bank 的所有文件都是 Markdown，建议：
- 纳入版本控制
- 团队成员共享上下文
- 追踪历史变更

---

## 常见问题

### Q: 安装后文件更新时没有收到系统提醒？

这是最常见的问题。**根本原因通常是只执行了 `npm install -g` 或 `npm link`，但没有执行 `memory-bank-skill install`**。

| 命令 | 作用 |
|------|------|
| `npm install -g memory-bank-skill` | 只安装 CLI 工具本身 |
| `memory-bank-skill install` | 安装 Skill、Plugin、配置文件（**必须执行！**） |

**排查步骤**：

```bash
# 1. 检查安装状态
memory-bank-skill doctor

# 2. 如果有任何 ✗ 项，执行安装
memory-bank-skill install

# 3. 安装插件依赖
cd ~/.config/opencode && bun install

# 4. 重启 OpenCode
```

**验证插件是否加载**：

```bash
# 启用 DEBUG 模式查看插件日志
MEMORY_BANK_DEBUG=1 opencode --print-logs
```

启动时应该看到：
```
service=memory-bank Plugin initialized (unified) {"projectRoot":"..."}
```

### Q: Skill 没有被识别怎么办？

最常见的原因是**没有配置 `permission.skill`**。检查步骤：

1. 确认 `~/.config/opencode/opencode.json` 或项目级 `opencode.json` 中包含：
   ```json
   {
     "permission": {
       "skill": "allow"
     }
   }
   ```

2. 确认 SKILL.md 文件路径正确：`~/.claude/skills/memory-bank/SKILL.md`（全局）或 `.claude/skills/memory-bank/SKILL.md`（项目级）

3. 重启 OpenCode 后运行 `opencode debug skill` 验证

### Q: 不需要手动初始化吗？

对。Memory Bank 会自动检测项目结构并按需创建文件。第一次使用时，如果检测到代码库，会自动生成 brief.md 和 tech.md。

### Q: 文件太多，AI 读取会不会很慢？

不会。Memory Bank 采用智能检索：
- 固定只读 brief.md + active.md
- 其他文件通过索引按需加载
- 有预算限制，每轮最多 500 行

### Q: 可以修改 AI 生成的内容吗？

可以。但建议：
- 在用户区块自由编辑
- 机器区块尽量不改（会检测冲突）
- 如果改了机器区块，下次 AI 更新时会让你选择保留哪个版本

### Q: 索引丢了怎么办？

AI 会自动重建索引。检测到 _index.md 缺失或为空时，会扫描 memory-bank/ 下所有文件重建。

### Q: 和其他项目会冲突吗？

不会。Memory Bank 是项目级的，每个项目有独立的 memory-bank/ 目录。

---

## 安全提示

⚠️ **不要在 Memory Bank 中存储敏感信息**：

- API 密钥
- 数据库密码
- 私钥文件
- 任何凭证

AI 检测到疑似敏感内容时会拒绝写入。

---

## 文件位置

| 文件 | 路径（全局安装） |
|------|------------------|
| Skill 主文件 | `~/.claude/skills/memory-bank/SKILL.md` |
| 文件模板 | `~/.claude/skills/memory-bank/references/templates.md` |
| 高级规则 | `~/.claude/skills/memory-bank/references/advanced-rules.md` |
| 结构化输出 Schema | `~/.claude/skills/memory-bank/references/schema.md` |
| 启动指令配置 | `~/.claude/CLAUDE.md` |
| **统一插件** | `~/.config/opencode/plugin/memory-bank.ts` |
| 本说明文档 | `Memory-Bank-使用说明.md` |

---

## 版本信息

- **版本**: 4.0.0
- **主要更新**:
  - **一键安装 CLI**：`memory-bank-skill install` 自动完成所有配置
  - **安装诊断**：`memory-bank-skill doctor` 快速排查安装问题
  - **统一插件**：将 `memory-bank-loader.ts` 和 `memory-bank-reminder.ts` 合并为单一 `memory-bank.ts`
  - **必须显式注册**：在 `opencode.json` 的 `plugin` 数组中添加插件路径，否则 Desktop App 不加载
  - OpenCode 插件系统：真正的自动读写，不再依赖 AI 主动遵循规则
  - 关键词检测：新需求、bug、技术决策等自动触发提醒
  - 文件修改跟踪：修改 1+ 个重要文件时提醒更新
  - 逃逸阀机制：用户可回复"无需更新"跳过提醒
  - 多项目支持：单会话跨项目操作，每个项目独立状态
