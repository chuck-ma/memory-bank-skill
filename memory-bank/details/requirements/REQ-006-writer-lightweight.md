# REQ-006: Writer 轻量化改造 — 去 subagent，主 agent 直写

> 创建于: 2026-02-13
> 状态: 设计中

---

## 问题

当前 Memory Bank 写入流程：

```
主 agent 组织内容 → 打包上下文 → 启动 writer subagent → subagent 重新理解上下文 → 执行写入 → 汇报回来
```

**痛点**：
1. **上下文损耗**：主 agent 已经完全理解当前背景，转手给 subagent 需要重新传递完整上下文，经常丢失细节
2. **调用开销大**：改几行 markdown，不值得一次 subagent 调用的成本（token + 延迟）
3. **流程繁琐**：用户体感上多了一步"委托"，等待时间长

**对比 Gating 机制**：Gating（v7.0）用 warn/block 模式成功实现了"在 tool 执行前注入提示"的轻量守卫。写入守卫可以采用同样的思路。

---

## 目标

将 Memory Bank 写入从"委托给 subagent 执行"改为"主 agent 直接写 + plugin 注入 writing guideline"。

### 核心改动

| 维度 | 现状（Before） | 目标（After） |
|------|--------------|--------------|
| 写入执行者 | writer subagent | 主 agent 直接写 |
| 安全边界 | 进程级隔离（subagent） | writing guideline prompt 注入 |
| Plugin 行为 | 拦截非 writer 写入 → throw Error | 检测 memory-bank/ 写入 → 注入 writing rules prompt |
| Proposal 确认 | 保留 | **保留**（主 agent 提议 → 用户确认 → 写入） |
| writer agent | 必须注册 | 可移除 |

### 不改的

- Proposal → 用户确认流程（保留）
- 写入规则本身（目标文件判断、区块分离等 — 保留）
- 安全护栏（禁止写入敏感信息 — 保留）
- 只允许 .md 文件写入 memory-bank/（保留）
- Gating 机制（保留，不受影响）
- Session Anchors / Recovery Gate（保留，不受影响）
- Doc-First Gate（保留，不受影响）

---

## 设计

### 新写入流程

```
主 agent 检测到写入时机
    ↓
主 agent 用自然语言询问（Proposal）
    ↓
用户确认
    ↓
主 agent 直接调用 write/edit 写入 memory-bank/
    ↓
Plugin 在 tool.execute.before 检测到写入目标是 memory-bank/
    ↓
Plugin 注入 writing guideline prompt（类似 gating warn 的方式）
    ↓
写入执行
```

### Plugin 改动（memory-bank.ts）

#### 1. Write Guard 行为变更

**Before**：检测到非 writer agent 写 memory-bank/ → `throw Error()`（阻止）

**After**：检测到写 memory-bank/ → 注入 writing guideline prompt（不阻止）

#### 2. Writing Guideline Prompt

写入 memory-bank/ 时注入的提示内容：

```
## [Memory Bank Writing Guide]

写入 memory-bank/ 文件时，请遵循以下规则：
1. 区块分离：保留 MACHINE_BLOCK / USER_BLOCK 分区，不覆盖 USER_BLOCK
2. 追加优先：patterns/learnings 只追加不重写
3. 格式一致：匹配目标文件现有格式
4. 禁止敏感信息：不写入 API key、密码、token 等
5. 最小变更：只改需要改的部分，不重排全文
```

#### 3. 可移除的代码

- WRITER_AGENT_NAME 常量和相关引用
- writerSessionIDs Set 和相关逻辑
- agentBySessionID Map 和相关逻辑
- isWriterAllowed() 函数
- blockWrite() 函数（改为 guideline 注入）

### Skill 改动

- SKILL.md：移除"主 Agent 禁止直接写入"约束，改为"主 Agent 直接写入，遵循 writing guideline"
- writer.md：移除 proxy_task 调用方式，改为直接 write/edit 调用指引

### Protocol 改动

```
// BEFORE
write: proxy_task(subagent_type="memory-bank-writer", prompt="Target:...\nDraft:...")

// AFTER  
write: 直接 write/edit，写入前 Proposal 确认。Plugin 自动注入 writing guide。
```

### opencode.json 改动

- 移除 memory-bank-writer agent 注册
- CLI install 逻辑同步更新

---

## 安全分析

| 风险 | 原设计缓解方式 | 新设计缓解方式 | 评估 |
|------|--------------|--------------|------|
| 主 agent 乱写 | subagent 隔离 | guideline + .md 限制 + Proposal 确认 | 可接受 |
| 写入非 .md | writer 代码控制 | Plugin 硬拦截（保留 throw） | 等效 |
| 写入敏感信息 | writer Skill 规则 | guideline prompt 提醒 | 等效 |
| 覆盖 USER_BLOCK | writer Skill 规则 | guideline prompt 提醒 | 等效 |

---

## 影响范围

| 文件 | 变更类型 |
|------|---------|
| plugin/memory-bank.ts | 核心改动：Write Guard 从 block 改为 guideline 注入 |
| skills/memory-bank/SKILL.md | 更新写入流程描述 |
| skills/memory-bank/references/writer.md | 移除 subagent 调用，改为直接写入指引 |
| src/cli.ts | 移除 writer agent 注册逻辑 |
| README.md | 更新安装说明 |

---

## 验收标准

1. 主 agent 可以直接 write/edit memory-bank/ 下的 .md 文件
2. 写入非 .md 文件仍然被阻止
3. 写入时 Plugin 注入 writing guideline prompt（去重，每轮只注入一次）
4. Proposal → 确认流程仍然生效（Skill 规范层面）
5. opencode.json 中不再需要 memory-bank-writer agent
6. 现有 Gating / Session Anchors / Doc-First Gate 不受影响
