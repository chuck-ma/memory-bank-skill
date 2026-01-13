# 当前焦点

## 刚完成

### 自动提交模式 (v4.1.0)

实现了 Memory Bank 自动提交机制：

- ✅ INIT 提醒：检测到无 `memory-bank/` 目录时自动触发
- ✅ 自动提交选项："初始化并提交" / "更新并提交"
- ✅ Preflight 检查：git 仓库、非 merge/rebase、无冲突、有身份配置
- ✅ 全有或全无：要么更新+提交，要么都不做
- ✅ SKILL.md 更新：添加自动提交规则
- ✅ README.md 更新：添加触发条件说明

### 设计文档

- `memory-bank/docs/design-auto-commit.md` - 自动提交机制设计（经 Oracle 审查）

## 下一步

- [ ] 发布 v4.1.0 到 npm
- [ ] 测试新触发逻辑（重启 OpenCode 后）
- [ ] 考虑添加 `uninstall` 命令

## 阻塞项

无
