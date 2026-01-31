# Memory Bank 透明性设计

## 背景

> 注意：当前 `plugin/memory-bank.ts` 中 session.idle 相关提醒逻辑已暂时禁用，本设计作为历史方案参考。

当前 Memory Bank 的读写透明性不对称（历史行为）：
- **写入**：过去仅在 session.idle 时提醒，AI 工作时没有"要记录"的意识
- **读取**：隐式注入 system prompt，用户看不到

用户核心诉求：
1. 读取应该显式可见
2. 写入意识应该在**头部**就注入，让 AI 自己语义判断
3. 都通过 skill 来指导行为

---

## 设计方案

### 核心原则

1. **Skill 是统一入口**：读写都通过加载 skill 来指导行为
2. **头尾结合**：头部注入意识，尾部兜底提醒
3. **语义优先**：让 AI 自己判断事件类型，不依赖关键词检测

---

### 1. 头部通知（message.updated，已禁用）

> 当前 `sendContextNotification` 已注释，现仅通过 system prompt 注入 Memory Bank Bootstrap 指令。

**目的**：让 AI 从一开始就知道：
- 加载了什么上下文（读）
- 如果涉及特定事件，工作完成后要输出更新计划（写）

**格式**：

```markdown
## [Memory Bank]

**已加载**: brief.md, active.md, _index.md (1,568 chars)

**写入提醒**：如果本轮涉及以下事件，工作完成后输出更新计划：
- 新需求 → requirements/
- 技术决策 → patterns.md  
- Bug修复/踩坑 → learnings/
- 焦点变更 → active.md

操作：加载 `/skill memory-bank` 按规范处理。
```

**时机**：`message.updated` (role=user，当前已禁用)

**去重**：使用 `message.id` 去重

---

### 2. 尾部兜底（session.idle，已禁用）

> 当前提醒链路已禁用，以下内容为历史方案描述。

**目的**：如果 AI 没有主动输出更新计划，兜底提醒

**触发条件**：
- 检测到代码变更（git status）
- 且 AI 本轮没有输出更新计划

**格式**：

```markdown
## [SYSTEM REMINDER - Memory Bank Update]

本轮检测到以下变更：

**变更文件**：
- src/cli.ts
- plugin/memory-bank.ts
(+3 more)

**操作**：加载 `/skill memory-bank` 处理更新。
```

**与头部的关系**：
- 头部是"主动意识注入"，让 AI 自己判断
- 尾部是"被动兜底"，防止遗漏

---

### 3. 不拆分 Skill

保持单一 skill，因为：
- Skill 同时指导读取行为和写入规则
- 拆分只增加认知负担

---

## 头尾对比

| 维度 | 头部通知 | 尾部兜底 |
|------|----------|----------|
| **时机** | message.updated（已禁用） | session.idle（已禁用） |
| **目的** | 注入读写意识 | 防止遗漏 |
| **判断方式** | AI 语义理解 | 关键词 + git status |
| **必要性** | 核心机制 | 兜底机制 |

---

## 实现清单（当前禁用）

### Plugin 修改

| 位置 | 修改 |
|------|------|
| `buildMemoryBankContext()` | 重构：返回 `{text, files, totalChars, truncated}` |
| `message.updated` (role=user) | 发送头部通知（读 + 写意识） |
| `session.idle` | 尾部兜底提醒（已禁用） |
| 去重逻辑 | 使用 message.id 防止重复 |

### Skill 修改

SKILL.md 已有写入规则，需补充**读取行为规范**章节（已完成）。

---

## 简化决策

- **不需要配置选项**：始终显示透明化信息
- **每次都发头部通知**：保证每轮都有读写意识
- **尾部仅作兜底**：头部已经注入意识，尾部只在必要时触发
- **无 Memory Bank 时**：不发通知，由 INIT reminder 处理
