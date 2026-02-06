# Memory Bank Skill

> 项目记忆系统 - 让 AI 助手在每次对话中都能快速理解项目上下文

---

## 什么是 Memory Bank

Memory Bank 是一个 **OpenCode 技能（Skill）**，用于解决 AI 对话的 **上下文丢失** 问题。

每次开始新对话时，AI 助手都会"失忆"：
- 不记得项目用了什么技术栈
- 不记得之前做了什么决策
- 不记得当前在做什么任务

Memory Bank 通过结构化 Markdown 文件持久化项目上下文，实现：
- **按需初始化**：首次使用运行 `/memory-bank-refresh`，之后自动维护
- **智能检索**：基于 AI 语义理解，自动加载相关上下文
- **引导式写入**：AI 检测写入时机并提议，用户确认后执行

---

## 安装

### 一键安装

```bash
bunx memory-bank-skill install
```

然后 **重启 OpenCode**，完成！

### 自定义模型

默认使用 `cliproxy/claude-opus-4-6`，可通过 `--model` 指定：

```bash
bunx memory-bank-skill install --model anthropic/claude-sonnet-4-5
```

### 验证安装

```bash
bunx memory-bank-skill doctor
```

### 安装做了什么？

| 操作 | 目标路径 |
|------|----------|
| 复制 Skill 文件 | `~/.config/opencode/skills/memory-bank/`（含 `references/writer.md`） |
| 配置 opencode.json | 添加 `permission.skill=allow`，注册插件和 agent |
| 注册 Agent | 添加 `memory-bank-writer` agent（用于写入守卫） |
| 写入 manifest | `~/.config/opencode/skills/memory-bank/.manifest.json` |

---

## 快速开始

首次使用需运行初始化命令，之后 Memory Bank 会自动维护：

| 场景 | 行为 |
|------|------|
| **首次使用** | 运行 `/memory-bank-refresh` 初始化，扫描项目生成 MEMORY.md |
| **已有 Memory Bank** | 自动注入 MEMORY.md 内容到 AI 上下文 |
| **需要更新** | AI 检测到变更时会提议更新，用户确认后执行 |

---

## 文件结构

```
memory-bank/
├── MEMORY.md              # 单入口文件（项目概览 + 当前焦点 + 路由规则）
│
└── details/               # 详情层（按需读取）
    ├── tech.md            # 技术栈 + 环境 + 命令
    ├── patterns.md        # 技术决策 + 代码约定
    ├── progress.md        # 完成状态
    ├── design/            # 设计文档（含 index.md）
    ├── requirements/      # 需求池（含 index.md）
    ├── learnings/         # 经验沉淀（含 index.md）
    └── archive/           # 归档文件
```

---

## 插件功能

Memory Bank 包含一个 OpenCode 插件，提供两个核心功能：

### 1. 自动读取

每次 LLM 调用前，自动将 Memory Bank 内容注入 system prompt：
- 读取 `MEMORY.md`
- 文件缓存 + mtime 检测，只有变更才重新读取
- 12,000 字符上限，超出自动截断


### 2. 自动提醒更新（当前禁用）

AI 尝试停止时，检测是否需要更新 Memory Bank：
- 检测文件修改（代码/配置/文档）
- 检测用户消息关键词（新需求、bug、决策等）
- 提醒初始化或更新

> 注意：自动提醒链路当前在插件中整体暂时禁用（`evaluateAndFireReminder()` 未被调用），以下描述为历史行为。

当前提醒禁用时，以下逃逸阀不会生效。

**逃逸阀**：
- 回复"无需更新"或"已检查" → 本次会话不再提醒
- 回复"跳过初始化" → 本次会话不再提醒初始化
- 环境变量 `MEMORY_BANK_DISABLED=1|true` → 禁用提醒链路（上下文注入仍然生效）

---

## 常见问题

### Skill 没有被识别？

确认 `~/.config/opencode/opencode.json` 中包含：

```json
{
  "permission": {
    "skill": "allow"
  }
}
```

### 插件没有加载？

```bash
# 检查安装状态
bunx memory-bank-skill doctor

# 重新安装
bunx memory-bank-skill install

# 安装依赖
cd ~/.config/opencode && bun install

# 重启 OpenCode
```

### 验证插件加载

```bash
MEMORY_BANK_DEBUG=1 opencode --print-logs
```

启动时应该看到：
```
service=memory-bank Plugin initialized (unified) {"projectRoot":"..."}
```

---

## 安全提示

**不要在 Memory Bank 中存储敏感信息**：
- API 密钥
- 数据库密码
- 私钥文件
- 任何凭证

---

## 文件位置

| 文件 | 路径 |
|------|------|
| Skill 主文件 | `~/.config/opencode/skills/memory-bank/SKILL.md` |
| 文件模板 | `~/.config/opencode/skills/memory-bank/references/templates.md` |
| 高级规则 | `~/.config/opencode/skills/memory-bank/references/advanced-rules.md` |
| 插件 | `opencode.json` 的 `plugin` 数组（`memory-bank-skill`） |

---

## 版本

- **版本**: 7.3.0
- **主要更新**: Doc-First Gate 默认启用（warn），无 Memory Bank 项目自动提醒初始化
