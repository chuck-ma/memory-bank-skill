# Memory Bank Reader 规则

> 此文档定义 Memory Bank 的读取规则。

## Memory Gate（强制）

**MEMORY.md 已由 Plugin 自动注入 system prompt**，无需手动读取。

如果需要更详细的信息，根据 MEMORY.md 的 **Routing Rules** 按需读取 `details/` 下的文件。

---

## 读取流程

```
1. MEMORY.md 内容已注入（包含 Project Snapshot + Current Focus + Routing Rules）

2. 根据当前任务匹配路由规则：
   - 匹配到 → 读取对应的 details/ 文件
   - 无匹配 → 不需要读取详情

3. 渐进读取：
   - 默认读取 1-3 个详情文件
   - 信息不足 → 继续读取更多
   - 足够回答 → 停止读取
```

---

## 路由优先级

路由规则按**书写顺序**优先（第一条命中优先）。

- **作者责任**：把更具体的规则写在更前面
- **入口优先**：MEMORY.md 的路由优先于二级 index.md 的路由

---

## Memory-first 原则

**任何问题，先假设"可能已经记录过"**。

| 问题类型 | 查找位置 |
|---------|---------|
| 当前在做什么/下一步 | MEMORY.md → Current Focus |
| 项目是什么/概述 | MEMORY.md → Project Snapshot |
| 怎么跑/怎么测试 | details/tech.md |
| 设计决策/架构 | details/design/index.md → 具体文件 |
| 需求背景/功能定义 | details/requirements/index.md → 具体文件 |
| 遇到过这问题吗 | details/learnings/index.md → 具体文件 |

**搜索顺序**：MEMORY.md 路由 → details/ 二级索引 → 具体文件 → 代码

---

## 二级索引读取

当路由指向目录（如 `details/design/`）时：

1. 先读取 `details/design/index.md`（二级路由）
2. 根据 index.md 的路由规则选择具体文件
3. 读取匹配的具体文件

**Fallback**：如果 `index.md` 不存在，直接列出目录下的文件，读取最相关的 1-2 个。建议运行 `/memory-bank-refresh` 重建索引。

---

## 冲突处理

当 MEMORY.md 与 details/ 内容不一致时：

- **以 details/ 为准**（更详细、更新）
- 建议更新 MEMORY.md 的相关摘要

当文档与代码不一致时：

- **以代码为准**
- 建议通过 Writer 更新文档

---

## 风险提示

如果 `details/learnings/` 下有相关历史经验，主动提醒：

```
注意：历史上有类似问题 → {file}
```

---

## 声明上下文来源

回答问题时，简短说明参考了哪些 Memory Bank 文件：

```
基于 MEMORY.md 和 details/design/xxx.md，...
```
