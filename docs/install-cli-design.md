# Memory Bank Skill - 安装 CLI 设计方案

> 版本: 1.0
> 日期: 2026-01-13
> 状态: 已实现

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
│   └── cli.ts                # CLI 入口
├── plugin/
│   └── memory-bank.ts        # OpenCode 插件
├── dist/                     # 编译输出（发布时包含）
├── skills/
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
  "version": "5.5.0",
  "description": "Memory Bank - 项目记忆系统，让 AI 助手在每次对话中都能快速理解项目上下文",
  "type": "module",
  "main": "dist/plugin.js",
  "bin": {
    "memory-bank-skill": "dist/cli.js"
  },
  "files": [
    "dist/",
    "skill/",
    "templates/"
  ],
  "scripts": {
    "build": "bun build src/cli.ts plugin/memory-bank.ts --outdir dist --target bun && mv dist/src/cli.js dist/cli.js && mv dist/plugin/memory-bank.js dist/plugin.js && rm -rf dist/plugin dist/src",
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
- **目标**: `~/.config/opencode/skills/memory-bank/`
- **幂等策略**: 覆盖 + 备份（如有差异）

### Step 2: 配置 opencode.json

- **目标**: `~/.config/opencode/opencode.json`
- **操作**:
  1. 确保 `permission.skill = "allow"`
  2. 确保 `plugin` 数组包含 `memory-bank-skill`
  3. 移除旧的 `file://.../memory-bank.ts` 引用（如存在）
- **幂等策略**: 存在则跳过

安装完成后自动写入：`~/.config/opencode/skills/memory-bank/.manifest.json`。

---

## 手动步骤（installer 不执行）

- 如需在 `AGENTS.md` 中加入 Memory Bank 启动指令，请手动添加
- 如需安装/更新 OpenCode 运行环境依赖，请手动执行 `cd ~/.config/opencode && bun install`

---

## 原子化实现

### 事务流程

```
┌─────────────────────────────────────────────────────────┐
│                   Inline Validation                      │
│  (检查在执行中完成，失败即回滚)                            │
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
│    1. 备份原文件（如存在）→ *.backup                      │
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
│  写入 ~/.config/opencode/skills/memory-bank/.manifest.json │
│  {                                                       │
│    "version": "5.3.2",                                   │
│    "installedAt": "2026-01-13T10:15:08Z",               │
│    "files": [                                            │
│      { "path": "...", "sha256": "..." }                 │
│    ]                                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

> 当前实现没有独立 Preflight 阶段，解析与校验在执行过程中完成（失败即回滚）。

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
    const original = await fs.readFile(targetPath)
    await fs.writeFile(backupPath, original)
    undoStack.push({ type: 'restore', path: targetPath, backupPath })
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

### AGENTS.md 中的启动指令（手动配置）

> installer 不自动写入 AGENTS.md，以下仅作为手动配置示例。

```markdown
<!-- memory-bank-skill:begin -->
## Memory Bank（项目记忆系统）

每次会话开始时，Plugin 自动注入 `memory-bank/MEMORY.md` 内容：

1. **存在 MEMORY.md** → 直接注入内容，AI 根据 Routing Rules 按需读取 details/
2. **存在旧结构** → 提示运行 `/memory-bank-refresh` 迁移
3. **不存在** → 可选运行 `/memory-bank-refresh` 初始化

工作过程中，检测到以下事件时按 `/memory-bank` 规则写入：
- **新需求**：创建 `details/requirements/REQ-xxx.md`
- **技术决策**：追加到 `details/patterns.md`
- **经验教训**（bug/性能/集成踩坑）：创建 `details/learnings/xxx.md`

写入前输出计划，等待用户确认。详细规则见 `~/.config/opencode/skills/memory-bank/SKILL.md`。
<!-- memory-bank-skill:end -->
```

### Sentinel 处理逻辑

```typescript
function updateAgentsMd(content: string, block: string): string {
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
| `~/.config/opencode/skills/` 不存在 | 自动创建目录 |
| `~/.config/opencode/` 不存在 | 自动创建目录 |
| `opencode.json` 不存在 | 创建新文件 |
| `opencode.json` 格式错误 | 中止 + 打印手动修复指令 |
| `AGENTS.md` 不存在 | 不处理（手动创建） |
| 用户修改过 skill 文件 | 覆盖 + 备份到 `*.backup` |
| 重复安装（相同版本） | 输出 "Installation complete"，仍执行覆盖 |
| 升级安装（新版本） | 输出 "upgrading X → Y" |
| 文件系统权限不足 | 安装中失败并回滚，清晰报错 |

---

## CLI 输出示例

### 首次安装

```
$ bunx memory-bank-skill install

Memory Bank Skill Installer v5.5.0

[1/2] Installing skill files...
→ ~/.config/opencode/skills/memory-bank/
[2/2] Configuring plugin...
      → Added permission.skill = "allow", Added plugin: memory-bank-skill

✓ Installation complete!

Next step: Restart OpenCode
```

### 重复安装

```
$ bunx memory-bank-skill install

Memory Bank Skill Installer v5.5.0

[1/2] Installing skill files...
      → ~/.config/opencode/skills/memory-bank/
[2/2] Configuring plugin...
      → Already configured

✓ Installation complete!

Next step: Restart OpenCode
```

### 安装失败回滚

```
$ bunx memory-bank-skill install

Memory Bank Skill Installer v5.5.0

[1/2] Installing skill files...
→ ~/.config/opencode/skills/memory-bank/
[2/2] Configuring plugin...
      ✗ Failed to parse JSON: Unexpected token at line 5

Rolling back...
→ Restored ~/.config/opencode/skill/memory-bank/SKILL.md

✗ Installation failed: Failed to parse ~/.config/opencode/opencode.json

Please fix ~/.config/opencode/opencode.json manually, or add this to your config:

{
  "permission": { "skill": "allow" },
  "plugin": ["memory-bank-skill"]
}
```

---

## 已实现

### doctor 命令

```bash
bunx memory-bank-skill doctor
```

检查安装状态、版本、配置完整性。

## 未来扩展

### uninstall 命令（可选）

```bash
bunx memory-bank-skill uninstall
```

基于 manifest 安全移除所有安装的文件。

---

## 测试用例

### 幂等性测试

1. 首次安装 → 成功
2. 立即再次安装 → 成功，输出 "Installation complete"
3. 删除部分文件后安装 → 成功，修复缺失文件
4. 修改 skill 文件后安装 → 成功，覆盖 + 备份

### 原子性测试

1. 在 Step 2 模拟 JSON 解析失败 → 回滚 Step 1
2. 在 Step 2 模拟写入权限失败 → 回滚 Step 1
3. 验证回滚后系统状态与安装前一致

### 边界测试

1. 空系统（无 ~/.config/opencode/）→ 自动创建
2. AGENTS.md 手动配置不在 installer 范围
3. opencode.json 已有其他 plugin → 追加不覆盖
