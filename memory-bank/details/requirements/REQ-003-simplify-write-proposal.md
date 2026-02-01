# REQ-003: 简化 Write Proposal 确认流程

> 状态: 进行中 | 创建: 2026-02-01

## 背景

当前 Memory Bank Write Proposal 存在两个问题：

1. **语言障碍**：模板是英文的，对中文用户不友好
2. **确认方式复杂**：使用特殊关键词 `mb:write` / `mb:no`，增加认知负担

示例（当前）：
```
Memory Bank Write Proposal
- Target: `memory-bank/details/learnings/xxx.md`
- Reason: <1 short sentence>
- Draft:
  1) <concrete bullet>
  2) <concrete bullet>
- Confirm: Reply `mb:write` to apply, or `mb:no` to skip.
```

用户反馈：
- 看不懂英文模板
- `mb:write` / `mb:no` 太机械，不像自然对话

## 目标

简化为自然语言交互，降低用户认知负担。

## 核心变更

| 现状 | 目标 |
|------|------|
| 英文模板 | 中文模板 |
| `mb:write` / `mb:no` 特殊指令 | 自然语言确认（"好"/"写"/"不用"） |
| 固定格式 Proposal | 简洁一行说明 + 目标文件 + 要点 |

### 新模板格式

```
---
💾 要把这次的发现写入 Memory Bank 吗？
   → {target_file}
   → 内容：{要点1}；{要点2}

回复"好"或"写"即可，不需要可忽略。
---
```

### 确认词匹配

| 类型 | 触发词 |
|------|--------|
| 确认 | 好 / 写 / 确认 / 可以 / 行 / yes / ok / mb:write |
| 拒绝 | 不用 / 不要 / 跳过 / 算了 / no / skip / mb:no |
| 忽略 | 用户继续下一话题（视为跳过） |

## 涉及文件

- `skills/memory-bank/references/writer.md` - Proposal 模板定义
- `skills/memory-bank/SKILL.md` - 流程描述
- `~/.config/opencode/oh-my-opencode.json` - AMENDMENT B prompt

## 验收标准

- [ ] Proposal 使用中文模板
- [ ] 支持自然语言确认（不限于特定关键词）
- [ ] 兼容旧关键词（mb:write / mb:no）
- [ ] 文档同步更新
