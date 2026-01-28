# Memory Bank Writer Skill

Memory Bank 专用写入 Agent 的技能定义。

## 用途

主 Agent 无法直接写入 `memory-bank/` 目录，必须通过 delegate 调用此 Agent。

## 调用方式

```
delegate_task(
    subagent_type="memory-bank-writer",
    load_skills=["memory-bank-writer"],
    prompt="更新设计文档：[内容]"
)
```

## 内置规则

- 写入前 Glob 检查已有文件
- 优先更新而非创建
- 自动更新 `_index.md`

## 文件

- `SKILL.md` - 技能定义和规则
