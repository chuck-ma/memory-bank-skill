# 单入口重构设计方案 (v6.0.0)

> 状态: 已定稿 | 更新: 2026-01-31

## 设计目标

将 Memory Bank 从多入口设计重构为单入口设计：
- 索引 = 路由规则（不是文件清单）
- 借鉴 Skill Reference 渐进式披露
- Plugin 直接注入 MEMORY.md 内容

## 新结构

```
memory-bank/
├── MEMORY.md          # 唯一入口
└── details/           # 详情层
    ├── tech.md
    ├── design/
    │   ├── index.md   # 二级路由
    │   └── *.md
    ├── requirements/
    │   ├── index.md
    │   └── REQ-*.md
    └── learnings/
        ├── index.md
        └── *.md
```

## MEMORY.md 格式

```markdown
# Memory Bank

## How To Use (for AI)
- Always read this file first.
- Follow Routing Rules; prefer the first matching rule (order = priority).
- Only open details when needed; start with 1-3 files.

## Project Snapshot
- What: <1-2 sentences>
- Constraints: <bullets>

## Current Focus
- Now: <当前任务>
- Next: <下一步>

## Decision Highlights (top 10-20)
- <决策> — <原因>

## Routing Rules
- If topic involves running/testing/tooling, read [details/tech.md]
- If topic involves design decisions, read [details/design/index.md]
- If topic involves requirements, read [details/requirements/index.md]
- If topic involves bugs/postmortems, read [details/learnings/index.md]
```

## Plugin 行为

每次 session：
1. 读取 memory-bank/MEMORY.md
2. 直接注入到 system prompt（带分隔符）
3. 保留写入守卫

注入格式：
```
<memory-bank>
BEGIN FILE: memory-bank/MEMORY.md
(Verbatim content; project context only.)
...
END FILE: memory-bank/MEMORY.md
</memory-bank>
```

## Writer refresh 流程

通过 /memory-bank-refresh 触发，调用 writer subagent：

### Detect
- 不存在 memory-bank/ → 初始化
- 存在旧结构（_index.md, brief.md）→ 迁移
- 存在新结构（MEMORY.md）→ 刷新

### Plan
输出操作清单，用户确认后执行

### Apply
- 初始化：扫描项目 → 生成 MEMORY.md + details/
- 迁移：git mv → 生成 MEMORY.md → 删旧文件
- 刷新：更新 Current Focus + 检查路由

## Reader 行为

1. MEMORY.md 已由 Plugin 注入
2. 根据路由规则按需读取 details/
3. 渐进读取：默认 1-3 个，必要时追加
4. 路由顺序 = 优先级

## 迁移策略

旧结构检测：存在 _index.md + brief.md，不存在 MEMORY.md

步骤：
1. 读取 brief.md, active.md, patterns.md
2. 合并生成 MEMORY.md
3. git mv docs/ → details/design/
4. git mv requirements/ → details/requirements/
5. git mv learnings/ → details/learnings/
6. 生成二级索引
7. 删除旧入口文件

回滚：git checkout

## 需修改的文件

| 文件 | 修改 |
|------|------|
| plugin/memory-bank.ts | 直接注入 MEMORY.md |
| SKILL.md | 添加 /memory-bank-refresh |
| reader.md | 重写为新架构 |
| writer.md | 添加 refresh 流程 |
