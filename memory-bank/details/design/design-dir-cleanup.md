# 目录清理机制设计

## 状态

**简化版 - Writer 自动清理**

## 背景

随着项目推进，memory-bank/ 下的子目录（learnings/、requirements/、docs/ 等）文件数量会持续增长。当单目录文件过多时：
- 检索效率下降
- AI 加载上下文时难以选择
- 维护成本增加

需要一个自动检测 + 提示清理的机制。

## 目标

1. 自动检测 memory-bank/ 递归子目录的文件数量
2. 超过阈值时提醒用户
3. 用户确认后执行整理（迁移/归档/汇编）

## 非目标

1. 不自动执行清理（必须用户确认）
2. 不删除文件（只迁移、归档或汇编）
3. 不强制合并（聚类不确定时只归档）

## 设计方案

> **实现方式变更**：原计划的插件检测方案暂不实现。改为 Writer 写入时自动检查并清理。
> 详见 `skills/memory-bank-writer/SKILL.md` 的"自动清理"章节。

### 检测机制（插件实现）

插件在注入 system prompt 时：

1. 递归扫描 `memory-bank/` 下所有子目录
2. 统计每个目录的 `.md` 文件数
3. 检查冷却期状态
4. 超过阈值（20 个）且通过冷却期检查的目录，注入提醒到上下文

```typescript
interface DirOverflow {
  path: string      // 相对路径，如 "learnings/bugs"
  count: number     // 文件数
}

interface CleanupState {
  overflowDirs: Record<string, {
    firstDetected: string   // ISO 日期
    lastNotified: string    // ISO 日期
    consecutiveHits: number // 连续超阈值次数
  }>
}

function detectOverflow(root: string, state: CleanupState, config: CleanupConfig): DirOverflow[] {
  const results: DirOverflow[] = []
  for (const dir of getAllSubDirs(root)) {
    if (isIgnored(dir, config.ignorePatterns)) continue
    
    const threshold = config.thresholds[dir] ?? config.defaultThreshold
    const count = countMdFiles(dir)
    
    if (count > threshold) {
      const dirState = state.overflowDirs[dir]
      // 冷却期检查：连续两次超阈值 + 7天内未提示
      if (dirState?.consecutiveHits >= 2 && !notifiedWithin7Days(dirState)) {
        results.push({ path: relative(root, dir), count })
      }
    }
  }
  return results
}
```

### 冷却期机制

避免每次注入都刷屏，引入状态缓存和冷却期：

| 规则 | 说明 |
|------|------|
| 连续命中 | 需连续 2 次检测超阈值才触发提醒 |
| 提醒间隔 | 同一目录 7 天内最多提示 1 次 |
| 状态存储 | `.cleanup-state.json` 在 `memory-bank/` 下 |
| 重置条件 | 目录文件数降到阈值以下时重置状态 |

状态文件格式：

```json
{
  "overflowDirs": {
    "learnings/bugs": {
      "firstDetected": "2026-01-20",
      "lastNotified": "2026-01-21",
      "consecutiveHits": 3
    }
  }
}
```

### 提醒格式

```
[Memory Bank 整理提醒]
以下目录文件数超过阈值，建议整理：
- learnings/bugs/: 23 个文件（阈值 20）
- docs/modules/: 25 个文件（阈值 20）

使用 `整理 learnings/bugs --plan` 查看整理计划。
使用 `整理 learnings/bugs --apply` 执行整理。
```

### 执行机制（复用 organize）

复用 `design-organize.md` 的底层逻辑：
- 迁移/重命名
- 索引更新
- 引用修复

解耦为：
- **触发层**：本设计的自动检测
- **执行层**：organize 的整理动作

用户确认后，delegate 给 memory-bank-writer 执行：

1. **分析阶段**（`--plan`）
   - 读取目录下所有文件
   - 按规则聚类（见下文）
   - 输出整理计划，不执行任何操作

2. **执行阶段**（`--apply`）
   - 用户显式确认后执行
   - 创建目录（如需要）
   - 迁移/归档/汇编文件
   - 更新 `_index.md`
   - 修复内部链接

### 整理策略（保守版）

**原则**：优先迁移/归档，谨慎合并

| 优先级 | 场景 | 策略 | 示例 |
|--------|------|------|------|
| 1 | 同主题文件 >= 4 个 | 创建子目录迁移 | 5 个 auth 相关 → `docs/auth/` |
| 2 | 旧文件（> 90 天未修改）| 按时间归档 | 旧文件 → `archive/2026-01/` |
| 3 | 同主题小文件（< 50 行）且聚类确定 | 汇编 + 原文件归档 | 3 个 wechat bug → 汇编文件 + 原文件存档 |
| 4 | 聚类不确定 | 仅归档，不合并 | 杂项 → `archive/` |

**关键约束**：
- 合并改为"汇编"：生成汇编文件 + 原文件迁到归档子目录
- 聚类不确定时**绝不自动合并**，只归档

### 聚类策略

**规则优先**（确定性高）：

| 信号 | 权重 | 示例 |
|------|------|------|
| 文件名前缀 | 高 | `wechat-*.md` |
| 日期前缀 | 中 | `2026-01-*` |
| H1 标题关键词 | 中 | `# WeChat Token 刷新问题` |
| Front matter tags | 高 | `tags: [wechat, auth]` |

**语义兜底**（保守）：
- 仅在规则无法聚类时使用
- 置信度 < 80% 时不建议合并，只归档
- 输出时标注"低置信度"让用户判断

### 汇编文件格式

当执行汇编时，生成的文件格式：

```markdown
# {主题} 汇编

> 汇编自 {N} 个文件，生成于 {日期}

## 来源文件

| 原路径 | 归档路径 | 标题 |
|--------|----------|------|
| learnings/bugs/2026-01-15-wechat-token.md | archive/cleanup-2026-01/2026-01-15-wechat-token.md | WeChat Token 过期 |
| learnings/bugs/2026-01-18-wechat-callback.md | archive/cleanup-2026-01/2026-01-18-wechat-callback.md | WeChat 回调失败 |

---

## 2026-01-15: WeChat Token 过期

{原文件内容}

---

## 2026-01-18: WeChat 回调失败

{原文件内容}
```

**可追溯性**：
- 来源列表记录原路径和归档路径
- 原文件完整保留在 `archive/cleanup-{YYYY-MM}/`
- 支持回滚：删除汇编文件 + 从归档恢复原文件

### 阈值配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `defaultThreshold` | 20 | 触发提醒的文件数 |
| `consecutiveHits` | 2 | 连续超阈值次数 |
| `cooldownDays` | 7 | 同目录提醒冷却天数 |
| `archiveAgeDays` | 90 | 文件多久未修改视为"旧" |
| `clusterMinFiles` | 4 | 创建子目录的最小文件数 |
| `mergeMaxLines` | 50 | 可汇编的单文件最大行数 |

### 配置文件

#### `.cleanup-ignore`（glob 模式）

```
# 忽略特定目录
drafts/**
experiments/**

# 忽略特定文件
notes.md
```

#### `.cleanup-config`（可选，阈值覆盖）

```json
{
  "defaultThreshold": 20,
  "thresholds": {
    "learnings/bugs": 25,
    "docs/modules": 15
  },
  "cooldownDays": 7
}
```

### 保护规则

不参与清理的文件/目录：
- 根目录文件：`_index.md`、`brief.md`、`tech.md`、`active.md`、`patterns.md`、`progress.md`
- `archive/` 目录（已归档内容）
- `.cleanup-*` 配置/状态文件

### 指令格式

结构化指令，减少误触发：

| 指令 | 作用 |
|------|------|
| `整理 {dir} --plan` | 输出整理计划，不执行 |
| `整理 {dir} --apply` | 执行整理（需先 --plan） |
| `整理全部 --plan` | 所有超阈值目录的计划 |
| `整理全部 --apply` | 执行所有（需先 --plan） |

## 实现位置

| 组件 | 文件 | 职责 |
|------|------|------|
| 插件 | `src/plugin.ts` | 检测 + 冷却期管理 + 注入提醒 |
| 状态文件 | `memory-bank/.cleanup-state.json` | 持久化检测状态 |
| Writer Skill | `skills/memory-bank-writer/SKILL.md` | 定义整理规则 |
| Organize 逻辑 | 复用 `design-organize.md` | 迁移/索引/链接修复 |

## 风险与兜底

| 风险 | 兜底措施 |
|------|----------|
| 聚类不准确 | 输出计划让用户确认；低置信度时只归档不合并 |
| 信息丢失 | 汇编文件记录来源；原文件保留在归档目录 |
| 链接断裂 | 执行后检查并修复 `[text](path.md)` 链接 |
| 提醒过频 | 冷却期机制：连续 2 次 + 7 天间隔 |

## 与 organize 的关系

| 功能 | dir-cleanup | organize |
|------|-------------|----------|
| 触发方式 | 自动检测超阈值 | 用户手动触发 |
| 作用范围 | 单个超阈值目录 | 整个 memory-bank |
| 主要动作 | 迁移/归档/汇编 | 分类迁移 |
| 底层逻辑 | 复用 organize | 独立实现 |

## 待定问题

1. 状态文件是否需要加入 `.gitignore`（倾向不加，方便团队共享状态）
