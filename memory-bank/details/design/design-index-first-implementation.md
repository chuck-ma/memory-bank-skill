# v7.1 Index-First 实现方案

> 日期：2026-02-02 | 来源：与 Oracle 三轮讨论达成的实现共识

---

> **注意**：本文档中的代码示例为设计时的预期实现，实际代码可能已更新。
> 若需查看当前实现，请直接参考 `plugin/memory-bank.ts` 源码。
> 
> 最后同步检查：2026-02-02（v7.1 第二轮修复后）

## 实现决策摘要

| 决策点 | 结论 |
|--------|------|
| 模板版本标记 | HTML 注释 `<!-- MEMORY_BANK_TEMPLATE:v7.1 -->`，不用 YAML frontmatter |
| 迁移检测 | 先查标记，回退到章节存在性检测 |
| Decision Highlights | best-effort 从 patterns.md 抽取 + 手动覆盖支持 |
| Gating 满足条件 | 读 patterns.md 或调用 memory-reader |
| 高风险写入判定 | 收紧判定，multiedit/apply_patch 默认 Medium；加 safe-path 白名单 |
| Routing Rules | 初始化生成通用意图表 + 空的项目特定扩展区 |
| Legacy 内容处理 | 移到 `memory-bank/legacy.md`，MEMORY.md 只放链接 |

---

## 1. 模板版本检测

### 1.1 版本标记

在 MEMORY.md 开头（`<!-- MACHINE_BLOCK_START -->` 之后）添加：

```html
<!-- MEMORY_BANK_TEMPLATE:v7.1 -->
```

### 1.2 检测优先级

```python
def detect_template_version(content: str) -> str:
    # 1. 查找标记注释（权威）
    if "MEMORY_BANK_TEMPLATE:v7.1" in content:
        return "v7.1"
    if "MEMORY_BANK_TEMPLATE:" in content:
        return extract_version(content)
    
    # 2. 回退到章节检测
    has_drill_down = "## Drill-Down Protocol" in content
    has_write_safety = "## Write Safety Rules" in content
    if has_drill_down and has_write_safety:
        return "v7.1"  # 推测
    
    # 3. 未知版本
    return "unknown"
```

---

## 2. 迁移方案

### 2.1 迁移触发

`/memory-bank-refresh` 检测到以下情况时触发迁移：
- MEMORY.md 存在但版本 < v7.1
- MEMORY.md 缺少必要章节（Drill-Down Protocol / Write Safety Rules）

### 2.2 迁移操作（非破坏性）

| 操作 | 说明 |
|------|------|
| 保留原内容 | Project Snapshot / Current Focus 原样保留 |
| 追加固定章节 | Drill-Down Protocol / Write Safety Rules / Top Quick Answers |
| 转换 Routing Rules | 旧版改名为 `Legacy Routing (Topic)`，新增意图驱动版本 |
| 处理无法映射内容 | 移到 `memory-bank/legacy.md` |
| 添加版本标记 | 插入 `<!-- MEMORY_BANK_TEMPLATE:v7.1 -->` |

### 2.3 Legacy 文件处理

```markdown
# memory-bank/legacy.md

> 此文件包含迁移时无法自动映射的旧内容。
> 请审核后删除或合并到对应的 details/ 文件。
> 
> 迁移时间：{datetime}

---

{原始内容}
```

MEMORY.md 中添加提示：
```markdown
> ⚠️ 迁移说明：部分旧内容已移至 [legacy.md](legacy.md)，请审核后处理。
```

---

## 3. 初始化方案

### 3.1 MEMORY.md 生成策略

| 章节 | 生成方式 |
|------|----------|
| Project Snapshot | 从 README.md / package.json 提取（best-effort） |
| Current Focus | 空模板 |
| Decision Highlights | 空表 + 指向 patterns.md 的链接 |
| Routing Rules | 通用意图表（固定）+ 项目特定扩展区（空） |
| Drill-Down Protocol | 固定文案 |
| Write Safety Rules | 固定文案 |
| Top Quick Answers | 空槽位 + 规则说明 |

### 3.2 通用 Routing Rules 模板

```markdown
## Routing Rules（意图驱动）

按"你想做什么"选择 1-3 个最相关的文件读取。

### 通用意图

| 意图 | 目标文件 |
|------|----------|
| 了解技术栈/命令/环境 | `memory-bank/details/tech.md` |
| 查看技术决策/约定 | `memory-bank/details/patterns.md` |
| 查看进度/最近变更 | `memory-bank/details/progress.md` |
| 查找需求文档 | `memory-bank/details/requirements/index.md` |
| 查找踩坑经验 | `memory-bank/details/learnings/index.md` |
| 不确定文件名 | 先 `glob` 再读 |

### 项目特定意图（按需添加）

| 意图 | 目标文件 |
|------|----------|
| （示例：改注入逻辑） | （示例：plugin/xxx.ts） |
```

---

## 4. Plugin Protocol 变更

### 4.1 新 Protocol 文案（~10 行）

```text
## Memory Bank Protocol
protocol_version: memory-bank/v1
template_version: v7.1
fingerprint: MEMORY.md | {chars} chars | mtime {iso} | hash {hash}

trigger: 涉及项目实现/设计/历史原因
drill_down: Step1 direct-read 1-3 相关 details/*; Step2 需要证据/冲突/跨文件 → memory-reader
output: 回答必须给引用指针（文件路径）
gating: 高风险写前需已读 patterns.md 或调用过 memory-reader

write: proxy_task(subagent_type="memory-bank-writer", ...)
more: 完整规范见 /memory-bank skill
```

### 4.2 代码变更位置

`plugin/memory-bank.ts` 的 `behaviorProtocol` 变量（约 296-322 行）

---

## 5. Gating 门槛变更

### 5.1 contextSatisfied 条件

```typescript
// 旧实现（过宽 - 已废弃）
// if (relativePath.includes("MEMORY.md") || 
//     relativePath.includes("patterns.md") ||
//     relativePath.includes("details/")) {
//   gatingState.contextSatisfied = true
// }

// 当前实现（v7.1 - 精确匹配 + 大小写归一）
const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\//, "").toLowerCase()
const isPatterns = normalizedPath === "memory-bank/details/patterns.md"
if (isPatterns) {
  gatingState.contextSatisfied = true
}

// memory-reader 调用也满足（保持不变）
if (subagentType === "memory-reader") {
  gatingState.contextSatisfied = true
}
```

### 5.2 高风险判定调整

```typescript
// 调整后的 assessWriteRisk
function assessWriteRisk(toolName: string, args: Record<string, unknown>, projectRoot: string): RiskLevel {
  // Safe-path 白名单（强制 Low）
  const safePaths = [
    /^memory-bank\/details\/progress\.md$/,
    /^memory-bank\/details\/learnings\//,
    /^memory-bank\/details\/requirements\//,
    /^memory-bank\/details\/.*\/index\.md$/,
  ]
  
  const targetPath = extractPrimaryPath(args)
  if (targetPath && safePaths.some(p => p.test(targetPath))) {
    return "low"
  }
  
  // multiedit / 多文件 patch → Medium（原来是 High）
  if (toolName === "multiedit") return "medium"
  if (toolName === "apply_patch" && countPatchFiles(args) > 1) return "medium"
  
  // 敏感路径才是 High
  const sensitivePatterns = [
    /^src\/auth\//i, /^src\/security\//i,
    /package\.json$/i, /docker\//i, /\.env/i,
    /plugin\/.*\.ts$/i,  // 插件核心代码
  ]
  if (sensitivePatterns.some(p => p.test(targetPath))) return "high"
  
  return "low"
}
```

---

## 6. reader.md 变更

### 6.1 新结构

```markdown
# Memory Bank Reader 规则

## Direct-First 读取流程（默认）

1. **从 MEMORY.md Routing Rules 选择 1-3 个最相关文件**
2. **直接 `read` 读取**
3. **信息足够则停止**；不足则继续读取或升级到 memory-reader

## 升级到 memory-reader 的触发条件

以下任一满足时，升级到 memory-reader：

| 触发条件 | 说明 |
|----------|------|
| 用户要求证据/引用 | "给出处"、"引用来源"、"为什么" |
| 需要冲突检测 | 怀疑文档与代码不一致 |
| 跨文件综合 | 涉及 3+ 个 details 文件 |
| 预估行数 > 300 | 单文件很长或多文件累加 |
| 跨多个主题目录 | 同时涉及 tech + patterns + learnings |

## memory-reader 调用方式（仅升级时使用）

{保留原有内容}
```

### 6.2 确定性阈值

| 阈值 | 值 | 说明 |
|------|-----|------|
| 文件数上限 | 3 | Step1 最多直接读 3 个；第 4 个就升级 |
| 行数上限 | 300 | 总读取量预估 |
| 跨目录阈值 | 2 | 涉及 2 个以上不同主题目录就升级 |

---

## 7. writer.md 变更

### 7.1 初始化流程变更

```markdown
#### 初始化流程（v7.1）

1. 扫描项目结构（README.md、package.json 等）
2. 创建 memory-bank/ 目录结构
3. 生成 MEMORY.md（v7.1 模板）：
   - 添加版本标记 `<!-- MEMORY_BANK_TEMPLATE:v7.1 -->`
   - 生成 Project Snapshot（从扫描结果）
   - 生成 Current Focus（空模板）
   - 生成 Decision Highlights（空表）
   - 生成 Routing Rules（通用意图表 + 项目特定扩展区）
   - 生成 Drill-Down Protocol（固定文案）
   - 生成 Write Safety Rules（固定文案）
   - 生成 Top Quick Answers（空槽位）
4. 生成 details/ 文件（tech.md, patterns.md, progress.md）
5. **不强制创建 details/*/index.md**（用 glob 兜底）
```

### 7.2 迁移流程变更

```markdown
#### 迁移流程（v7.1）

1. 读取旧 MEMORY.md，检测版本
2. 生成迁移补丁（非破坏性）：
   - 保留 Project Snapshot / Current Focus 原内容
   - 追加缺失章节（Drill-Down Protocol / Write Safety Rules / Top Quick Answers）
   - 旧 Routing Rules 改名为 "Legacy Routing (Topic)"
   - 新增 "Routing Rules (Intent-Driven)" 章节
   - 无法映射的内容移到 legacy.md
3. 输出变更预览，等待用户确认
4. 执行写入，添加版本标记
```

---

## 8. templates.md 变更

### 8.1 新 MEMORY.md 模板

完整模板见 templates.md 更新内容。

关键变更：
- 添加版本标记
- 三段式格式（结论+边界+指针）
- Routing Rules 意图驱动
- 新增 Drill-Down Protocol / Write Safety Rules / Top Quick Answers

---

## 9. SKILL.md 变更

### 9.1 读取阶段变更

```markdown
### 读取阶段

1. **MEMORY.md 已由 Plugin 注入**
2. **Direct-first**：按 Routing Rules 直接读取 1-3 个 details 文件
3. **升级条件**：需要证据链/冲突检测/跨文件汇总时调用 memory-reader
4. **回答时必须给引用指针**
```

### 9.2 memory-reader 定位

```markdown
> memory-reader 是"升级路径"，不是默认调用。
> 日常读取使用 direct read；复杂场景才升级到 memory-reader。
```

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-02-02 | 初稿：与 Oracle 讨论达成实现共识 |
