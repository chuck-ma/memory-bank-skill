# 设计文档：Memory Bank 自动提交机制

## 状态

**最终版 v3** - Oracle 认可的激进简化方案

## 问题背景

### 当前行为

1. `session.idle` 触发时，插件通过 `git status --porcelain` 检测未提交变更
2. 如果有代码变更且 memory-bank 未更新，触发提醒
3. 用户选择"跳过"，设置 `memoryBankReviewed=true`（内存状态）
4. 新会话时状态重置，**又提醒**

### 问题根因

`reminderFired` / `memoryBankReviewed` 是会话级内存状态，新会话时重置。

## 解决方案

### 核心思路

**激进简化**：更新 memory-bank + git commit 作为原子操作。

```
提醒 → 用户选择"更新并提交" → 写入 memory-bank → git add -A → git commit → 完成
```

### 设计原则

1. **全有或全无**：要么更新并提交，要么都不做
2. **简单优先**：无状态文件、无签名、无持久化逻辑
3. **干净状态**：commit 后 `git status` 干净，自然不会重复提醒

## 实现变更

### 1. 修改提醒模板

文件：`plugin/memory-bank.ts`

**UPDATE 提醒**（已有 memory-bank）：

```markdown
## [SYSTEM REMINDER - Memory Bank Update]

项目 `{projectName}` 本轮检测到以下事件：

{triggers}

**操作选项**：
1. 如需更新 → 回复"更新"，输出更新计划
2. 如需更新并提交 → 回复"更新并提交"
3. 如不需要 → 回复"跳过"
```

**INIT 提醒**（无 memory-bank）：

```markdown
## [SYSTEM REMINDER - Memory Bank Init]

项目 `{projectName}` 尚未初始化 Memory Bank，但本轮修改了 {N} 个文件。

**操作选项**：
1. 如需初始化 → 回复"初始化"
2. 如需初始化并提交 → 回复"初始化并提交"
3. 如不需要 → 回复"跳过初始化"
```

### 2. 修改 SKILL.md

文件：`skill/memory-bank/SKILL.md`

添加规则：

```markdown
## 自动提交模式

当用户回复"更新并提交"或"初始化并提交"时：

### Preflight 检查（必须全部通过）

1. 确认是 git 仓库：`git rev-parse --is-inside-work-tree`
2. 确认不在 merge/rebase 中：检查 `.git/MERGE_HEAD`、`.git/rebase-merge/`、`.git/rebase-apply/` 不存在
3. 确认有 git 身份：`git config user.name` 和 `git config user.email` 非空
4. 确认有变更可提交：`git status --porcelain` 非空

### 执行流程

1. 输出计划，列出将要更新的 memory-bank 文件和将要提交的代码文件
2. 等待用户确认
3. 写入 memory-bank 文件
4. 执行 `git add -A`
5. 执行 `git diff --cached --name-only` 显示将提交的文件列表
6. 执行 `git commit -m "chore(memory-bank): update {files}"`

### 失败处理

- Preflight 失败：不执行任何操作，解释原因和修复方法
- Commit 失败（如 hook 拒绝）：报告错误，不回滚
```

### 3. Commit Message 格式

```
chore(memory-bank): update active.md

Auto-committed by Memory Bank.
```

## 用户响应处理

| 用户回复 | 行为 |
|---------|------|
| "更新" / "update" | 只更新 memory-bank，不提交 |
| "更新并提交" / "update and commit" | 更新 + git add -A + git commit |
| "跳过" / "skip" | 设置 escape valve，本次会话不再提醒 |
| "初始化" / "init" | 初始化 memory-bank，不提交 |
| "初始化并提交" / "init and commit" | 初始化 + git add -A + git commit |

## 边界情况

### Q1: 用户不想提交所有文件？

A: 选择"更新"（不提交），手动处理 git。

### Q2: Merge/Rebase 进行中？

A: Preflight 检测到，拒绝操作，提示"请先完成 merge/rebase"。

### Q3: Git hook 拒绝 commit？

A: 报告错误，memory-bank 文件已写入但未提交。用户手动处理。

### Q4: 没有 git 身份配置？

A: Preflight 检测到，拒绝操作，提示"请先配置 git user.name 和 user.email"。

## 实现清单

- [ ] 修改 `plugin/memory-bank.ts` 提醒模板，增加"更新并提交"选项
- [ ] 修改 `skill/memory-bank/SKILL.md` 添加自动提交规则
- [ ] 添加 preflight 检查指令
- [ ] 添加 commit message 格式规范

## 工作量估计

**1-4 小时**

## Oracle 审查结论

1. ✅ 简单：无状态文件、无签名、无持久化
2. ✅ 有效：commit 后 git status 干净，不会重复提醒
3. ✅ 安全：4 个最小 preflight 检查防止常见失败
4. ✅ 可控：用户明确选择"更新并提交"才执行
