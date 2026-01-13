# Memory Bank Skill - 安装 CLI 设计方案

> 版本: 1.0
> 日期: 2026-01-13
> 状态: 待实现

## 目标

将复杂的手动安装流程简化为一行命令：

```bash
bunx memory-bank-skill install
```

### 设计原则

1. **幂等性**: 重复执行安装不会产生副作用（无重复项、无损坏）
2. **原子性**: 全部成功或全部回滚（无部分状态）
3. **简洁性**: 最小依赖，无复杂 TUI

---

## 包结构

```
memory-bank-skill/
├── package.json              # npm 包配置
├── src/
│   ├── cli.ts                # CLI 入口
│   ├── installer.ts          # 安装逻辑
│   ├── atomic.ts             # 原子写入工具
│   └── config.ts             # 配置常量
├── dist/                     # 编译输出（发布时包含）
├── plugin/
│   └── memory-bank.ts        # OpenCode 插件
├── skill/
│   └── memory-bank/          # Skill 文件
│       ├── SKILL.md
│       ├── README.md
│       └── references/
├── templates/                # Memory Bank 模板
└── docs/
    └── install-cli-design.md # 本文档
```

---

## package.json 配置

```json
{
  "name": "memory-bank-skill",
  "version": "4.0.0",
  "description": "Memory Bank - 项目记忆系统，让 AI 助手在每次对话中都能快速理解项目上下文",
  "type": "module",
  "bin": {
    "memory-bank-skill": "./dist/cli.js"
  },
  "files": [
    "dist/",
    "plugin/",
    "skill/",
    "templates/"
  ],
  "scripts": {
    "build": "bun build src/cli.ts --outdir dist --target bun",
    "prepublishOnly": "bun run build"
  },
  "keywords": ["opencode", "plugin", "memory-bank", "ai", "context"],
  "license": "MIT"
}
```

---

## 安装步骤

### Step 1: 复制 Skill 文件

- **源**: `skill/memory-bank/*`
- **目标**: `~/.claude/skills/memory-bank/`
- **幂等策略**: 覆盖 + 备份（如有差异）

### Step 2: 复制 Plugin 文件

- **源**: `plugin/memory-bank.ts`
- **目标**: `~/.config/opencode/plugin/memory-bank.ts`
- **幂等策略**: 覆盖 + 备份（如有差异）

### Step 3: 配置 opencode.json

- **目标**: `~/.config/opencode/opencode.json`
- **操作**:
  1. 确保 `permission.skill = "allow"`
  2. 确保 `plugin` 数组包含插件路径
- **幂等策略**: 存在则跳过

### Step 4: 配置 CLAUDE.md

- **目标**: `~/.claude/CLAUDE.md`
- **操作**: 插入/更新 Memory Bank 启动指令
- **幂等策略**: Sentinel 块（存在则替换，不存在则追加）

### Step 5: 确保 Plugin 依赖

- **目标**: `~/.config/opencode/package.json`
- **操作**: 确保 `dependencies["@opencode-ai/plugin"]` 存在
- **幂等策略**: 存在则跳过

---

## 原子化实现

### 事务流程

```
┌─────────────────────────────────────────────────────────┐
│                    Preflight Phase                       │
│  (只读，任何失败立即中止)                                  │
├─────────────────────────────────────────────────────────┤
│  1. 解析所有目标路径                                      │
│  2. 检查目标目录权限                                      │
│  3. 读取并解析 opencode.json（失败则中止+打印手动指令）    │
│  4. 计算变更清单                                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     Apply Phase                          │
│  (事务写入，失败则回滚)                                   │
├─────────────────────────────────────────────────────────┤
│  For each operation:                                     │
│    1. 备份原文件（如存在）→ .backup/                      │
│    2. 写入临时文件 .tmp                                   │
│    3. 原子 rename 到目标路径                              │
│    4. 记录 undo action 到栈                               │
│                                                          │
│  On failure:                                             │
│    执行 undo stack（逆序）                                │
│    恢复所有备份                                           │
│    退出 non-zero                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Manifest Phase                        │
├─────────────────────────────────────────────────────────┤
│  写入 ~/.claude/skills/memory-bank/.manifest.json        │
│  {                                                       │
│    "version": "4.0.0",                                   │
│    "installedAt": "2026-01-13T10:15:08Z",               │
│    "files": [                                            │
│      { "path": "...", "sha256": "..." }                 │
│    ]                                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

### 原子写入函数

```typescript
async function atomicWriteFile(
  targetPath: string,
  content: string | Buffer,
  undoStack: UndoAction[]
): Promise<void> {
  const tmpPath = `${targetPath}.tmp`
  const backupPath = `${targetPath}.backup`
  
  // 1. 备份原文件（如存在）
  if (await exists(targetPath)) {
    await fs.rename(targetPath, backupPath)
    undoStack.push({ type: 'restore', from: backupPath, to: targetPath })
  } else {
    undoStack.push({ type: 'remove', path: targetPath })
  }
  
  // 2. 写入临时文件
  await fs.writeFile(tmpPath, content)
  
  // 3. 原子 rename
  await fs.rename(tmpPath, targetPath)
}
```

---

## Sentinel 块格式

### CLAUDE.md 中的启动指令

```markdown
<!-- memory-bank-skill:begin -->
## Memory Bank（项目记忆系统）

每次会话开始时，检查 `memory-bank/` 目录：

1. **存在** → 读取 `memory-bank/brief.md` + `memory-bank/active.md` 获取项目上下文
2. **不存在** → 首次工作时扫描项目结构（README.md、pyproject.toml 等），创建 `memory-bank/` 并生成 `brief.md` + `tech.md`

工作过程中，检测到以下事件时按 `/memory-bank` skill 规则写入：
- **新需求**：创建 `requirements/REQ-xxx.md`
- **技术决策**：追加到 `patterns.md`
- **经验教训**（bug/性能/集成踩坑）：创建 `learnings/xxx.md`

写入前输出计划，等待用户确认。详细规则见 `~/.claude/skills/memory-bank/SKILL.md`。
<!-- memory-bank-skill:end -->
```

### Sentinel 处理逻辑

```typescript
function updateClaudeMd(content: string, block: string): string {
  const BEGIN = '<!-- memory-bank-skill:begin -->'
  const END = '<!-- memory-bank-skill:end -->'
  
  const beginIdx = content.indexOf(BEGIN)
  const endIdx = content.indexOf(END)
  
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    // 替换现有块
    return content.slice(0, beginIdx) + block + content.slice(endIdx + END.length)
  } else {
    // 追加新块
    return content.trimEnd() + '\n\n' + block + '\n'
  }
}
```

---

## 边界情况处理

| 情况 | 处理方式 |
|------|----------|
| `memory-bank/` 目录修改 | **不触发更新提醒**。Plugin 会检测到 memory-bank 文件变更并标记 `memoryBankUpdated=true`，但不会加入 `modifiedFiles` 列表，避免循环提醒 |
| `~/.claude/` 不存在 | 自动创建目录 |
| `~/.config/opencode/` 不存在 | 自动创建目录 |
| `opencode.json` 不存在 | 创建新文件 |
| `opencode.json` 格式错误 | 中止 + 打印手动修复指令 |
| `CLAUDE.md` 不存在 | 创建新文件 |
| 用户修改过 skill 文件 | 覆盖 + 备份到 `.backup/` |
| 重复安装（相同版本） | 输出 "already up to date"，仍执行覆盖 |
| 升级安装（新版本） | 输出 "upgrading X → Y" |
| 文件系统权限不足 | Preflight 阶段失败，清晰报错 |

---

## CLI 输出示例

### 首次安装

```
$ bunx memory-bank-skill install

Memory Bank Skill Installer v4.0.0

[1/5] Installing skill files...
      → ~/.claude/skills/memory-bank/
[2/5] Installing plugin...
      → ~/.config/opencode/plugin/memory-bank.ts
[3/5] Configuring opencode.json...
      → Added permission.skill = "allow"
      → Added plugin entry
[4/5] Configuring CLAUDE.md...
      → Added startup instructions
[5/5] Ensuring plugin dependencies...
      → @opencode-ai/plugin already present

✓ Installation complete!

Next steps:
  1. Run: cd ~/.config/opencode && bun install
  2. Restart OpenCode
```

### 重复安装

```
$ bunx memory-bank-skill install

Memory Bank Skill Installer v4.0.0

[1/5] Installing skill files...
      → Already up to date
[2/5] Installing plugin...
      → Already up to date
[3/5] Configuring opencode.json...
      → Already configured
[4/5] Configuring CLAUDE.md...
      → Already configured
[5/5] Ensuring plugin dependencies...
      → Already present

✓ Already installed (v4.0.0)
```

### 安装失败回滚

```
$ bunx memory-bank-skill install

Memory Bank Skill Installer v4.0.0

[1/5] Installing skill files...
      → ~/.claude/skills/memory-bank/
[2/5] Installing plugin...
      → ~/.config/opencode/plugin/memory-bank.ts
[3/5] Configuring opencode.json...
      ✗ Failed to parse JSON: Unexpected token at line 5

Rolling back...
      → Restored ~/.config/opencode/plugin/memory-bank.ts
      → Restored ~/.claude/skills/memory-bank/

✗ Installation failed

Please fix ~/.config/opencode/opencode.json manually, or add this to your config:

{
  "permission": { "skill": "allow" },
  "plugin": ["file:///Users/you/.config/opencode/plugin/memory-bank.ts"]
}
```

---

## 未来扩展

### doctor 命令（可选）

```bash
bunx memory-bank-skill doctor
```

检查安装状态、版本、配置完整性。

### uninstall 命令（可选）

```bash
bunx memory-bank-skill uninstall
```

基于 manifest 安全移除所有安装的文件。

---

## 测试用例

### 幂等性测试

1. 首次安装 → 成功
2. 立即再次安装 → 成功，输出 "already up to date"
3. 删除部分文件后安装 → 成功，修复缺失文件
4. 修改 skill 文件后安装 → 成功，覆盖 + 备份

### 原子性测试

1. 在 Step 3 模拟 JSON 解析失败 → 回滚 Step 1-2
2. 在 Step 4 模拟写入权限失败 → 回滚 Step 1-3
3. 验证回滚后系统状态与安装前一致

### 边界测试

1. 空系统（无 ~/.claude/, ~/.config/opencode/）→ 自动创建
2. 已有自定义 CLAUDE.md 内容 → 追加不覆盖
3. opencode.json 已有其他 plugin → 追加不覆盖
