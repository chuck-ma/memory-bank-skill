# Memory Bank 写入规则

> 此文档定义 Memory Bank 的写入规则。主 Agent 直接执行写入，Plugin 注入 writing guideline（advisory）。

## 写入方式

主 Agent 直接使用 `write`/`edit` 工具写入 `memory-bank/` 下的 `.md` 文件：

```typescript
// 示例：更新 patterns.md
edit({
  filePath: "memory-bank/details/patterns.md",
  oldString: "...",
  newString: "..."
})

// 示例：创建新需求文档
write({
  filePath: "memory-bank/details/requirements/REQ-007-xxx.md",
  content: "# REQ-007: ...\n\n..."
})
```

**Plugin 保护**：
- 只允许 `.md` 文件写入（非 `.md` 会被阻止）
- 不允许通过 bash 写入（必须使用 write/edit 等结构化工具）
- 写入时 Plugin 自动注入 writing guideline 提示

## 写入触发流程（跨 turn）

### 触发时机

| 触发 | 场景 |
|------|------|
| ✅ | 新需求/范围/验收标准明确 |
| ✅ | 新技术决策/模式/约定确定或变更 |
| ✅ | 新经验/踩坑发现（bug 原因、集成陷阱、性能问题） |
| ✅ | 新/变更的命令、工作流、项目结构 |
| ❌ | 问题是关于 Memory Bank 本身 |
| ❌ | 本消息已包含 Proposal |
| ❌ | 用户已拒绝（不用/跳过/mb:no 等） |
| ❌ | 用户消息是确认或拒绝词（直接执行/跳过） |
| ❌ | 上一条消息有 Proposal 且用户未回应 |

### 流程

**Step 1: 提议（本 turn）**

在完成主要任务后，用自然语言询问是否写入：

```
---
💾 要把这次的发现写入 Memory Bank 吗？
   → {target_file}
   → 内容：{要点1}；{要点2}

回复"好"或"写"即可，不需要可忽略。
---
```

**Step 2: 确认（用户 turn）**

**前提**：只有当上一条 assistant 消息包含 💾 写入提示时，才把用户回复解释为确认/拒绝。否则正常处理用户消息。

| 类型 | 触发词 |
|------|--------|
| 确认 | 好 / 写 / 确认 / 可以 / 行 / yes / ok / sure / mb:write |
| 拒绝 | 不用 / 不要 / 跳过 / 算了 / no / skip / mb:no |
| 忽略 | 用户继续下一话题但未回应提示（视为跳过） |

**混合意图**：如果用户确认同时问了其他问题（如"写吧，顺便问一下..."），先执行写入，再回答问题。

**Step 3: 执行（本 turn 或下一 turn）**

收到确认后，直接使用 `write`/`edit` 工具写入，然后展示变更预览。

## Refresh 流程（/memory-bank-refresh）

通过 `/memory-bank-refresh` 触发，执行初始化、升级、迁移或刷新。

### Detect（检测）

```
检测 memory-bank/ 目录结构：

1. 不存在 memory-bank/ 
   → 进入【初始化】流程

2. 存在 memory-bank/MEMORY.md 
   → 读取版本标记 <!-- MEMORY_BANK_TEMPLATE:v7.x -->
   ├─ 版本 >= v7.1 → 进入【刷新】流程
   ├─ 版本 < v7.1 → 进入【升级】流程
   └─ 标记缺失 → 进入【升级】流程

3. 存在旧结构（_index.md, brief.md, active.md）但不存在 MEMORY.md
   → 进入【迁移】流程
```

### Plan（计划）

输出将要执行的操作清单，等待用户确认。

### Apply（执行）

#### 初始化流程

```
1. 扫描项目结构（README.md、package.json、pyproject.toml 等）
   - 扫描预算：最多 10 个文件，每个最多 200 行

2. 创建 memory-bank/ 目录结构：
   memory-bank/
   ├── MEMORY.md
   └── details/
       ├── tech.md
       ├── patterns.md
       ├── progress.md
       ├── design/           # index.md 可选，仅当文件 > 8 时创建
       ├── requirements/     # index.md 可选，仅当文件 > 8 时创建
       └── learnings/        # index.md 可选，仅当文件 > 8 时创建

3. 生成 MEMORY.md（v7.1 模板）：
   - 版本标记：<!-- MEMORY_BANK_TEMPLATE:v7.1 -->
   - Project Snapshot（从 README.md 等提取）
   - Current Focus（初始为空或基于当前任务）
   - Decision Highlights（初始为空，表格格式）
   - Routing Rules（意图驱动，按场景而非文件列表）
   - Drill-Down Protocol（两层读取协议说明）
   - Write Safety Rules（禁止写入敏感信息）
   - Top Quick Answers（常见问题快速答案，初始为空）

4. 生成详情文件：
   - details/tech.md（技术栈）
   - details/patterns.md（决策记录，初始为空模板）
   - details/progress.md（进度状态，初始为空模板）

5. 二级索引为可选（建议阈值，非硬门槛）：
   - 建议当目录下文件 > 8 时创建 index.md
   - 如果已存在 index.md 则继续维护
   - 否则用 glob 兜底（Reader 自动检测）
```

#### 升级流程（v7.0 → v7.1）

当 MEMORY.md 存在但版本 < v7.1 或版本标记缺失时，执行 in-place 升级。

**前置检查**：
```
检查区块标记完整性：
├─ <!-- MACHINE_BLOCK_START --> 存在
├─ <!-- MACHINE_BLOCK_END --> 存在
├─ <!-- USER_BLOCK_START --> 存在
└─ <!-- USER_BLOCK_END --> 存在

任一缺失 → 中止升级，提示用户手动修复标记
```

**升级步骤（Append-Only）**：
```
1. 保留 USER_BLOCK
   - 原样保持，不做任何修改

2. 更新版本标记
   - 定位 <!-- MACHINE_BLOCK_START --> 后
   - 如存在 MEMORY_BANK_TEMPLATE:v7.x → 替换为 v7.1
   - 如不存在 → 插入 <!-- MEMORY_BANK_TEMPLATE:v7.1 -->

3. 追加缺失区块（在 <!-- MACHINE_BLOCK_END --> 前）
   仅追加不存在的（精确标题匹配）：
   
   - ## Routing Rules（意图驱动）
     如已存在 ## Routing Rules（无后缀）→ 保留不动
     追加新版并在首行注明：
     > 如上方存在旧的 ## Routing Rules，视为 legacy；以本节意图驱动路由为准。
     
   - ## Drill-Down Protocol
   - ## Write Safety Rules
   - ## Top Quick Answers
   
   使用 templates.md 中的标准内容
```

**Plan 输出示例**：
```
检测到 MEMORY.md 版本 < v7.1，将执行升级：
- 更新版本标记为 v7.1
- 追加区块：## Routing Rules（意图驱动）
- 追加区块：## Drill-Down Protocol
- 追加区块：## Write Safety Rules
- 追加区块：## Top Quick Answers

USER_BLOCK 将保持不变。

回复"好"或"确认"执行升级。
```

**设计文档**：详见 `memory-bank/details/design/design-template-upgrade.md`

#### 迁移流程

```
1. 检测模板版本：
   - 读取 MEMORY.md，查找 <!-- MEMORY_BANK_TEMPLATE:v7.x --> 标记
   - 如果不存在或版本 < v7.1，进入迁移

2. 读取旧文件内容：
   - brief.md → 提取 Project Snapshot
   - active.md → 提取 Current Focus
   - patterns.md → 提取 Decision Highlights
   - _index.md → 参考但不迁移

3. 生成 MEMORY.md（v7.1 模板）：
   - 合并 Project Snapshot + Current Focus + Decision Highlights
   - 添加新固定区块：Drill-Down Protocol、Write Safety Rules、Top Quick Answers
   - 添加意图驱动的 Routing Rules（而非旧的文件列表）
   - 添加版本标记：<!-- MEMORY_BANK_TEMPLATE:v7.1 -->

4. 迁移详情文件（使用 git mv 保留历史）：
   - tech.md → details/tech.md
   - patterns.md → details/patterns.md
   - progress.md → details/progress.md（如存在）
   - docs/ → details/design/
   - requirements/ → details/requirements/
   - learnings/ → details/learnings/

5. 处理不匹配内容：
   - 旧 Routing Rules 重命名为"Legacy Routing (Topic)"，保存到 memory-bank/legacy.md
   - 其他无法分类的内容也归档到 legacy.md

6. 二级索引为可选（建议阈值，非硬门槛）：
   - 建议当目录下文件 > 8 时创建 index.md
   - 如果已存在 index.md 则继续维护
   - 否则用 glob 兜底

7. 删除旧入口文件：
   - _index.md
   - brief.md
   - active.md
   
   注意：patterns.md 已迁移到 details/，Decision Highlights 是摘要而非替代。
```

#### 刷新流程

```
1. 检测模板版本：
   - 读取 MEMORY.md，查找 <!-- MEMORY_BANK_TEMPLATE:v7.1 --> 标记
   - 如果版本 < v7.1，建议用户运行迁移流程

2. 重新扫描项目结构

3. 更新 MEMORY.md：
   - Project Snapshot（如有明显变化）
   - Routing Rules（检查 details/ 结构变化，保持意图驱动格式）

4. 检查二级索引（可选）：
   - 仅当目录下文件 > 8 时检查 index.md 完整性
   - 新增的详情文件 → 添加路由条目（如有 index.md）
   - 删除的详情文件 → 移除路由条目（如有 index.md）
```

---

## 写入触发（日常更新）

| 事件 | 写入目标 |
|------|---------|
| 焦点变更 | MEMORY.md → Current Focus |
| 技术决策 | MEMORY.md → Decision Highlights + details/patterns.md |
| 新需求 | details/requirements/REQ-xxx.md（如 index.md 存在则同步更新） |
| 设计文档 | details/design/xxx.md（如 index.md 存在则同步更新） |
| Bug/踩坑 | details/learnings/xxx.md（如 index.md 存在则同步更新） |

---

## 写入规则

### MEMORY.md 更新

| 区块 | 更新规则 |
|------|---------|
| Project Snapshot | 稳定，仅在项目定位变化时更新 |
| Current Focus | 高频更新，任务完成/变更时更新 |
| Decision Highlights | 新增决策时追加（保持 10-20 条以内） |
| Routing Rules | 仅在 details/ 结构变化时更新 |

### 详情文件写入

```
1. 解析诉求类型（设计/需求/经验）
2. 确定目标目录（details/design/ 或 details/requirements/ 或 details/learnings/）
3. Glob 检查现有文件：
   - 找到相关文件 → 更新
   - 没找到 → 创建新文件
4. 如果对应目录下 index.md 已存在 → 同步更新路由条目
   如果不存在且目录文件数 > 8 → 创建 index.md
   否则 → 跳过（用 glob 兜底）
```

### 二级索引更新

当对应目录下 index.md **已存在**时，在 details/ 下创建/删除文件后同步更新：

```markdown
# Design Router

- When modifying **xxx**, read [xxx.md](xxx.md)
```

---

## 写入流程

**Proposal 流程**：主 Agent 提议 → 用户确认 → 主 Agent 直接执行写入。

| 步骤 | 负责方 | 动作 |
|------|--------|------|
| 1 | 主 Agent | 检测写入时机，自然语言询问是否写入 |
| 2 | 用户 | 自然语言确认（"好"/"写"）或拒绝（"不用"/"跳过"） |
| 3 | 主 Agent | 直接使用 `write`/`edit` 工具写入目标文件 |

---

## 执行输出格式

```
[Memory Bank 写入完成]

已执行：
- 创建: memory-bank/details/design/xxx.md
- 更新: memory-bank/details/design/index.md
- 更新: memory-bank/MEMORY.md (Current Focus)

状态：成功
```

---

## 守卫机制

Plugin 层面强制执行：
- 主 Agent 直接使用 `write`/`edit` 写入 `memory-bank/`
- 只允许写入 `.md` 文件（非 `.md` 会被阻止）
- 不允许通过 bash 写入（必须使用结构化工具）
- 写入时 Plugin 自动注入 writing guideline 提示

---

## 区块分离

每个文件分为两个区块：

```markdown
<!-- MACHINE_BLOCK_START -->
（AI 自动维护）
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
（用户自由编辑，AI 不覆盖）
<!-- USER_BLOCK_END -->
```

---

## 禁止行为

- 不要跳过 Glob 检查
- 不要修改 `memory-bank/` 以外的文件
- 不要删除文件（除非迁移流程明确要求）

---

## 安全护栏

禁止写入：
- API 密钥、密码、token
- 客户隐私数据
- 任何凭证信息
