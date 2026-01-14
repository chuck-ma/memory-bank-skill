# 当前焦点

## 刚完成

### 修复 Memory Bank 触发条件

修复 AI 行为指令中的触发逻辑问题：

- ✅ "首轮回复" → "每次回复"（确保每次对话都确认 Memory Bank）
- ✅ 新增触发条件：AI 修改了代码/配置文件 → active.md
- ✅ 更新 SKILL.md 中的 Bootstrap 流程描述

### v5.0.0 - OpenCode 原生路径

切换到 OpenCode 原生 skill 路径，移除 Claude 兼容层：

- ✅ Skill 安装路径：`~/.claude/skills/` → `~/.config/opencode/skill/`
- ✅ 移除 CLAUDE.md 配置逻辑（OpenCode 不支持）
- ✅ 更新 doctor 检查路径
- ✅ 更新 manifest 路径
- ✅ 简化 README.md

## 下一步

- [ ] 构建并测试安装
- [ ] 发布 v5.0.0 到 npm
- [ ] 清理旧的 `~/.claude/skills/memory-bank/` 目录

## 阻塞项

无
