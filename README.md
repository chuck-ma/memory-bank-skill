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
- **零初始化**：不需要手动 init，随项目推进自动创建
- **智能检索**：基于 AI 语义理解，自动加载相关上下文
- **自动写入**：工作过程中自动记录重要发现和决策

---

## 安装

### 一键安装

```bash
bunx memory-bank-skill install
```

然后 **重启 OpenCode**，完成！

### 自定义模型

默认使用 `cliproxy/claude-opus-4-5-20251101`，可通过 `--model` 指定：

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
| 复制 Skill 文件 | `~/.config/opencode/skills/memory-bank/` 和 `memory-bank-writer/` |
| 配置 opencode.json | 添加 `permission.skill=allow`，注册插件和 agent |
| 注册 Agent | 添加 `memory-bank-writer` agent（用于写入守卫） |
| 写入 manifest | `~/.config/opencode/skills/memory-bank/.manifest.json` |

---

## 快速开始

**不需要手动初始化。** Memory Bank 会在你开始工作时自动检测和创建：

| 场景 | AI 行为 |
|------|---------|
| **已有代码库** | 扫描 package.json/README 等，自动生成 brief.md + tech.md |
| **新项目** | 不创建任何文件，等你开始工作后按需创建 |
| **已有 Memory Bank** | 直接读取 brief.md + active.md + _index.md，恢复上下文 |

---

## 文件结构

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

---

## 插件功能

Memory Bank 包含一个 OpenCode 插件，提供两个核心功能：

### 1. 自动读取

每次 LLM 调用前，自动将 Memory Bank 内容注入 system prompt：
- 读取 `brief.md` + `active.md` + `_index.md`
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

- **版本**: 5.11.0
- **主要更新**: Writer 自动清理（目录文件数检查 + active.md 归档）+ 确认职责分离
