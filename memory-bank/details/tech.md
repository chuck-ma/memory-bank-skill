# 技术栈

## 语言与运行时

| 类型 | 选择 |
|-----|------|
| 语言 | TypeScript |
| 运行时 | Bun |
| 目标 | OpenCode Plugin API |

## 依赖

| 包 | 用途 |
|-----|------|
| `@opencode-ai/plugin` | OpenCode 插件 SDK |

## 构建

```bash
# 构建 CLI + Plugin
bun run build

# 本地测试
bun ./dist/cli.js install
bun ./dist/cli.js doctor
```

## 发布

```bash
# 发布到 npm
npm publish
```

## 目录结构

```
memory-bank-skill/
├── src/cli.ts              # CLI 入口
├── dist/cli.js             # 编译输出
├── plugin/memory-bank.ts   # OpenCode 插件
├── skills/memory-bank/     # Skill 定义
├── templates/              # MB 模板
├── docs/                   # 设计文档
└── memory-bank/            # 本项目的 Memory Bank
```

## 关键路径

| 用途 | 路径 |
|-----|------|
| Skill 安装位置 | `~/.config/opencode/skills/memory-bank/` |
| 插件配置 | `~/.config/opencode/opencode.json` 的 `plugin` 数组（`memory-bank-skill`） |
| 配置文件 | `~/.config/opencode/opencode.json` |
| 启动指令 | `~/.config/opencode/AGENTS.md` |
