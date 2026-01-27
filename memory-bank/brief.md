# Memory Bank Skill

## 项目概述

OpenCode 插件，为 AI 编码助手提供项目记忆系统。通过结构化 Markdown 文件持久化项目上下文，解决 AI 对话间"失忆"问题。

## 核心价值

- **自动读取**：每次会话自动加载项目上下文
- **自动写入**：工作中沉淀发现、决策、经验
- **零初始化**：无需手动 init，随项目推进自动创建

## 主要组件

| 组件 | 路径 | 用途 |
|-----|------|------|
| Plugin | `plugin/memory-bank.ts` | 自动注入上下文 + 提醒更新 |
| Skill | `skill/memory-bank/` | 定义记忆系统规则 |
| CLI | `src/cli.ts` | 一键安装：`bunx memory-bank-skill install` |
| Templates | `templates/` | Memory Bank 文件模板 |

## 安装方式

```bash
bunx memory-bank-skill install
```

## 版本

- 当前版本：5.6.0
- 主要更新：新增 Memory-first 原则，读写规则对称
