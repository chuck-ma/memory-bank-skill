# 当前焦点

## 刚完成

### 修复 Todo 创建时遗漏 Memory Bank 更新

问题：AI 创建 todo 时没有包含 Memory Bank 更新任务，导致沉淀步骤被跳过。

解决方案：将"事后检查"改为"事前规划"：
- ✅ plugin/memory-bank.ts：新增 **Todo 创建规则**，移除冗余的 Todo 完成检查和初始化检查
- ✅ skill/memory-bank/SKILL.md：每轮行为规范同步更新

核心改变：
- 已有 memory-bank → 最后一项必须是"更新 Memory Bank"
- 没有 memory-bank → 第一项是"初始化"，最后一项是"更新"

## 下一步

- [ ] 发布到 npm

## 阻塞项

无
