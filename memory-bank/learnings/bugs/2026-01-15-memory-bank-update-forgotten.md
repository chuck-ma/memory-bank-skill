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

### v1: Todo 完成检查（已废弃）

在 todo 完成后检查是否需要更新 Memory Bank。

问题：事后检查容易被遗忘，且与 Todo 创建规则冲突。

### v2: Todo 创建规则（当前方案）

将"事后检查"改为"事前规划"：

| 场景 | 规则 |
|------|------|
| 已有 memory-bank | 创建 todo 时，**最后一项**必须是"更新 Memory Bank" |
| 没有 memory-bank | 创建 todo 时，**第一项**是"初始化 Memory Bank"，**最后一项**是"更新 Memory Bank" |

优势：
- Memory Bank 更新始终在 todo 列表中，不会被遗忘
- 逻辑简单，只有一条规则
- 移除了冗余的 Todo 完成检查和初始化检查

## 相关文件

- `plugin/memory-bank.ts` - AI 行为指令 + system prompt 注入
- `skill/memory-bank/SKILL.md` - 每轮行为规范
