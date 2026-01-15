# 当前焦点

## 刚完成

### 修复 Memory Bank 更新遗漏问题

Todo 驱动的工作流容易遗忘 Memory Bank 沉淀步骤：

- ✅ plugin/memory-bank.ts：AI 行为指令新增 "Todo 完成检查（必须）"
- ✅ plugin/memory-bank.ts：没有 memory-bank 时注入初始化指令（todo 第一项）
- ✅ skill/memory-bank/SKILL.md：步骤 1 改为"创建 todo 时第一项必须是初始化"
- ✅ skill/memory-bank/SKILL.md：步骤 6 改为明确触发条件

## 下一步

- [ ] 发布到 npm

## 阻塞项

无
