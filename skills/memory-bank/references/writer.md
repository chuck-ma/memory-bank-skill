# Memory Bank Writer 规则

> 此文档定义 Memory Bank 的写入规则，由 Writer Agent 执行。

## 调用方式

使用 `proxy_task`（Task tool）同步调用 memory-bank-writer：

```typescript
proxy_task({
  subagent_type: "memory-bank-writer",
  description: "Memory Bank write (confirmed)",
  prompt: "You are updating Memory Bank.\nConstraints:\n- Edit ONLY the target file.\n- Keep changes minimal and consistent with existing format.\n- Do NOT invent facts.\nInput:\nTarget: {target_file}\nDraft:\n1) {bullet_1}\n2) {bullet_2}\nOutput: Show what file changed + brief preview of changes."
})
```

## Writer 自动触发流程（跨 turn）

### 触发时机

| 触发 | 场景 |
|------|------|
| ✅ | 新需求/范围/验收标准明确 |
| ✅ | 新技术决策/模式/约定确定或变更 |
| ✅ | 新经验/踩坑发现（bug 原因、集成陷阱、性能问题） |
| ✅ | 新/变更的命令、工作流、项目结构 |
| ❌ | 问题是关于 Memory Bank 本身 |
| ❌ | 本消息已包含 Proposal |
| ❌ | 用户已拒绝（mb:no） |
| ❌ | 用户消息是 mb:write 或 mb:no（直接执行/跳过） |
| ❌ | 上一条消息有 Proposal 且用户未回应 |

### 流程

**Step 1: 提议（本 turn）**

在完成主要任务后，追加 Proposal：

```
Memory Bank Write Proposal
- Target: `memory-bank/details/patterns.md` | `memory-bank/details/requirements/REQ-xxx.md` | `memory-bank/details/learnings/xxx.md` | `memory-bank/details/progress.md`
- Reason: <1 short sentence>
- Draft:
  1) <concrete bullet>
  2) <concrete bullet>
- Confirm: Reply `mb:write` to apply, or `mb:no` to skip.
```

**Step 2: 确认（用户 turn）**

用户回复 `mb:write` 或 `确认/写入` 表示确认，`mb:no` 或 `不要写/skip` 表示跳过。

**Step 3: 执行（下一 turn）**

收到确认后，调用 memory-bank-writer 执行写入，然后展示变更预览。

## Refresh 流程（/memory-bank-refresh）

通过 `/memory-bank-refresh` 触发，执行初始化、迁移或刷新。

### Detect（检测）

```
检测 memory-bank/ 目录结构：

1. 不存在 memory-bank/ 
   → 进入【初始化】流程

2. 存在 memory-bank/MEMORY.md 
   → 进入【刷新】流程

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
       ├── design/
       │   └── index.md
       ├── requirements/
       │   └── index.md
       └── learnings/
           └── index.md

3. 生成 MEMORY.md：
   - Project Snapshot（从 README.md 等提取）
   - Current Focus（初始为空或基于当前任务）
   - Decision Highlights（初始为空）
   - Routing Rules（标准路由模板）

4. 生成详情文件：
   - details/tech.md（技术栈）
   - details/patterns.md（决策记录，初始为空模板）
   - details/progress.md（进度状态，初始为空模板）

5. 生成二级索引（details/*/index.md）
```

#### 迁移流程

```
1. 读取旧文件内容：
   - brief.md → 提取 Project Snapshot
   - active.md → 提取 Current Focus
   - patterns.md → 提取 Decision Highlights
   - _index.md → 参考但不迁移

2. 生成 MEMORY.md（合并以上内容）

3. 迁移详情文件（使用 git mv 保留历史）：
   - tech.md → details/tech.md
   - patterns.md → details/patterns.md
   - progress.md → details/progress.md（如存在）
   - docs/ → details/design/
   - requirements/ → details/requirements/
   - learnings/ → details/learnings/

4. 生成二级索引（details/*/index.md）

5. 删除旧入口文件：
   - _index.md
   - brief.md
   - active.md
   
   注意：patterns.md 已迁移到 details/，Decision Highlights 是摘要而非替代。
```

#### 刷新流程

```
1. 重新扫描项目结构

2. 更新 MEMORY.md：
   - Project Snapshot（如有明显变化）
   - Routing Rules（检查 details/ 结构变化）

3. 检查二级索引完整性：
   - 新增的详情文件 → 添加路由条目
   - 删除的详情文件 → 移除路由条目
```

---

## 写入触发（日常更新）

| 事件 | 写入目标 |
|------|---------|
| 焦点变更 | MEMORY.md → Current Focus |
| 技术决策 | MEMORY.md → Decision Highlights + details/patterns.md |
| 新需求 | details/requirements/REQ-xxx.md + 更新 index.md |
| 设计文档 | details/design/xxx.md + 更新 index.md |
| Bug/踩坑 | details/learnings/xxx.md + 更新 index.md |

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
4. 更新对应的 index.md 路由
```

### 二级索引更新

每次在 details/ 下创建/删除文件时，同步更新对应的 index.md：

```markdown
# Design Router

- When modifying **xxx**, read [xxx.md](xxx.md)
```

---

## 职责分离（Auto-Trigger 模式）

**Proposal 流程**：主 Agent 提供 Target + Draft，用户确认后 Writer 执行。

| 步骤 | 负责方 | 动作 |
|------|--------|------|
| 1 | 主 Agent | 检测写入时机，输出 Proposal（含 Target + Draft） |
| 2 | 用户 | `mb:write` 确认 或 `mb:no` 拒绝 |
| 3 | 主 Agent | 调用 `proxy_task({ subagent_type: "memory-bank-writer", ... })` |
| 4 | **Writer** | 执行写入（可顺带更新 index.md / MEMORY.md） |

### 主 Agent 的 prompt 格式（调用 Writer 时）

```
Target: memory-bank/details/patterns.md
Draft:
1) {bullet 1}
2) {bullet 2}
```

**说明**：Auto-Trigger 模式下，主 Agent 在 Proposal 中明确指定 Target 文件，用户确认后 Writer 按指定目标执行。

---

## 执行输出格式

```
[Memory Bank Writer 执行完成]

已执行：
- 创建: memory-bank/details/design/xxx.md
- 更新: memory-bank/details/design/index.md
- 更新: memory-bank/MEMORY.md (Current Focus)

状态：成功
```

---

## 守卫机制

Plugin 层面强制执行：
- 只有 `memory-bank-writer` agent 能写入 `memory-bank/`
- 只允许写入 `.md` 文件
- 主 agent 直接写入会被阻止

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
- 不要等待用户确认（确认已由主 Agent 前置完成）
- 不要修改 `memory-bank/` 以外的文件
- 不要删除文件（除非迁移流程明确要求）
- 不要自行决定写入内容（内容由主 Agent 提供）

---

## 安全护栏

禁止写入：
- API 密钥、密码、token
- 客户隐私数据
- 任何凭证信息
