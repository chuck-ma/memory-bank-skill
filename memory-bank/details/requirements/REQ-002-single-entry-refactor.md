# REQ-002: 单入口文件重构

> 状态: 设计中 | 创建: 2026-01-31

## 背景

当前 Memory Bank 的索引设计存在问题：

1. **索引无路由价值**：`_index.md` 只是文件清单（path, title, summary），AI 无法根据索引判断该读什么文件
2. **入口分散**：需要读 `_index.md` + `brief.md` + `active.md` 才能开始工作
3. **读取效果差**：AI 读完索引后仍然不知道该加载哪些文件

## 目标

借鉴 Skill Reference 的"渐进式披露"设计，重构为单入口设计：
- 索引应该是**路由规则**，不是文件清单
- 只需要一个入口文件，AI 读这一个就够了

## 核心变更

| 现状 | 目标 |
|------|------|
| `_index.md` + `brief.md` + `active.md` 三文件入口 | 合并为 `MEMORY.md` 单入口 |
| 索引 = 文件清单（path, title, summary） | 索引 = 路由规则（触发条件 + 目标 + 反触发） |
| 扁平目录结构 | `details/` 目录存放详情文件 |

### 路由规则格式

从：
```markdown
| path | title | summary |
| tech.md | 技术栈 | TypeScript + Bun |
```

变为：
```markdown
| 触发条件 | 目标 | 反触发 |
| 涉及技术栈/命令/环境 | details/tech.md | 纯业务讨论 |
```

## 预期结构

```
memory-bank/
├── MEMORY.md          # 唯一入口（项目概述 + 当前焦点 + 路由规则）
└── details/           # 详情层
    ├── tech.md
    ├── design/
    ├── requirements/
    └── learnings/
```

## 验收标准

- [ ] AI 只读 `MEMORY.md` 即可获得足够上下文开始工作
- [ ] 路由规则能有效引导 AI 按需加载详情文件
- [ ] 迁移脚本处理现有 Memory Bank 目录
