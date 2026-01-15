# Memory Bank 更新被遗忘

## 问题

AI 被 TODO CONTINUATION hook 驱动完成技术任务，但 Memory Bank 从不在 todo 里，导致沉淀步骤被跳过。

## 症状

- AI 正确完成代码修改
- AI 在 footer 写了 `| 📚 Memory Bank | ... |`（声明读过）
- 但没有输出更新计划，也没有写入 Memory Bank

## 根因

1. **Footer 确认 ≠ 实际写入**：Footer 只是声明读取了上下文，不是写入承诺
2. **Session idle reminder 已禁用**：之前因干扰太多被关掉
3. **Todo hook 不知道 Memory Bank 存在**：TODO CONTINUATION 只追踪用户定义的 todo，不会自动加 Memory Bank 更新

## 解决方案

### 1. Todo 完成检查（已有 memory-bank）

在 plugin 的 AI 行为指令和 SKILL.md 中明确：

> 标记最后一个 todo 为 completed 后，必须检查是否触发 Memory Bank 更新

这样 Todo 完成时会自然触发检查，而不依赖单独的 reminder 机制。

### 2. 初始化提醒（没有 memory-bank）

当 memory-bank 目录不存在时，在 system prompt 中注入：

> 创建 todo 时，第一项必须是"初始化 Memory Bank"

这样 AI 开始工作时就会先初始化。

## 相关文件

- `plugin/memory-bank.ts` - AI 行为指令 + system prompt 注入
- `skill/memory-bank/SKILL.md` - 每轮行为规范
