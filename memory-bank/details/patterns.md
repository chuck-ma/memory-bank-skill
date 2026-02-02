# 技术决策与约定

<!-- MACHINE_BLOCK_START -->

## Skill 结构

| 决策 | 日期 | 原因 |
|------|------|------|
| 合并 writer skill 到 references/ | 2026-01-28 | 简化结构，避免两个独立 skill 的 manifest 同步问题 |
| patterns.md 主动触发规则 | 2026-01-29 | 原本只有被动触发（用户问"为什么"、引用链），实际很少被读取 |
| SKILL.md 描述性引用格式 | 2026-01-29 | 官方规范推荐用自然语言说明"何时该读"，而不是纯表格链接 |

**详细说明**：

`memory-bank-writer` 不再作为独立 skill，而是作为 `memory-bank` skill 的参考文档存在：
- `skills/memory-bank-writer/SKILL.md` → `skills/memory-bank/references/writer.md`
- 主 Agent 加载 `memory-bank` skill 后，按需读取 `references/writer.md`
- 删除 `memory-bank-writer/` 目录

**原因**：
1. `memory-bank-writer` 缺少独立的 `.manifest.json`，导致 skill 加载异常
2. 两个 skill 共享同一个 manifest 会造成混淆
3. Writer 规则本质上是 memory-bank 的一部分，不需要独立存在

## patterns.md 主动触发规则

| 决策 | 日期 | 原因 |
|------|------|------|
| 在 reader.md 中增加 patterns.md 主动触发场景 | 2026-01-29 | 原本只有被动触发条件（用户问"为什么"、引用链），实际很少被读取 |

**触发场景**：
- 技术选型
- 创建新模块/组件
- 架构决策
- 修改公共模块
- 重构迁移

**判断方式**：不确定是否涉及时，宁可多读。

## SKILL.md 引用方式改进

| 决策 | 日期 | 原因 |
|------|------|------|
| SKILL.md 中对 references/ 文件的引用改用描述性格式 | 2026-01-29 | 官方规范推荐用自然语言说明"何时该读"，而不是纯表格链接 |

**格式示例**：
```markdown
- 需要了解**读取流程**时，见 [reader.md](references/reader.md)
- 需要了解**写入规则**时，见 [writer.md](references/writer.md)
```

## memory-reader 并行子任务设计

| 决策 | 日期 | 原因 |
|------|------|------|
| 引入 memory-reader agent 并行读取上下文 | 2026-01-31 | 解决"AI 不信任摘要，仍去读源码验证"的问题 |

**核心问题**：
- 当前 Plugin 将 MEMORY.md 注入 system prompt
- 但 AI 不信任摘要，仍然去读源码验证
- Memory Bank 的价值没有充分发挥

**解决方案**：
- 使用 `proxy_task(subagent_type="memory-reader")` 同步调用
- 同步读取：MEMORY.md → 按路由规则读 details/ → 抽样关键源码
- 返回"可直接使用的上下文包"

**memory-reader 输出格式（三层结构）**：
1. **Context Summary**：项目目标、当前焦点、关键技术栈、关键约定（给主任务直接用）
2. **Evidence**：来源文件 + 原文摘录 + mtime（让主任务放心）
3. **Open Questions**：Memory Bank 未覆盖的信息 + 建议查找路径（防止瞎编）

**触发条件**：
- ❌ 不是首条消息就触发
- ✅ 当内容涉及项目具体背景时触发
- ✅ 当 Memory Bank 有相关存储时触发
- ❌ 简单追问、闲聊不触发

**冲突检测功能**：
- memory-reader 发现记忆与实现冲突时，主动告知主 Agent
- 建议调用 Memory Bank Writer 更新记忆

**Plugin 注入内容变化**：
- 从"注入大段上下文"改为"注入行为规则"
- 规则：收到相关消息 → 调用 memory-reader → 获取上下文 → 继续工作

**工作量估算**：
- 可用原型：1-4 小时
- 完善版本：1-2 天

## Skill 与 Plugin 分层互补

| 决策 | 日期 | 原因 |
|------|------|------|
| Skill 与 Plugin 分层互补架构 | 2026-01-31 | 避免 Skill 与 Plugin 内容重复，同时保证 fallback 可用 |

**设计原则**：
- **Plugin**：注入 ~10 行 "Memory Bank Protocol"，包含 trigger/skip/invoke/output/conflict 规则
- **Skill**：提供完整规范、fallback 规则、消费契约

**优先级规则**：
- 检测 `protocol_version: memory-bank/v1` 判断 Protocol 是否存在
- Protocol 存在 → 按 Protocol 执行
- Protocol 不存在 → 按 Skill fallback 执行
- Skill 与 Protocol 不一致 → 视为漂移，优先遵循 Protocol

**文档分工**：
| 文档 | 职责 |
|------|------|
| Plugin Protocol | 最小行为闭环（~10 行） |
| SKILL.md | 优先级规则 + 命令 + 目录结构 |
| reader.md | Fallback 触发条件 + 消费契约 |
| memory-reader-prompt.md | Agent 系统提示词 + 输出格式 |

**Oracle 建议（待实现）**：
- 添加 YAML schema 防止输出格式漂移
- 定义 drift 检测与处理机制
- 使用 allowlist + denylist 双重安全

## v6.1.0 统一 Task Tool 架构

| 决策 | 日期 | 原因 |
|------|------|------|
| Reader/Writer 统一使用同步 Task | 2026-01-31 | 掌控感 > 后台能力，用户希望看到 subagent 做了什么 |
| Writer 自动触发 + Proposal 流程 | 2026-01-31 | 检测写入时机 → 提议 → 用户确认 → 执行，跨 turn 流程 |
| Loop Guards 防护 | 2026-01-31 | 避免重复提议和无限循环 |

**核心变更**：

1. **统一 Task Tool**：
   - 放弃 `delegate_task` 后台执行
   - Reader/Writer 全部改为同步 `proxy_task` 调用
   - 用户能看到 subagent 的完整执行过程

2. **Writer 自动触发流程**：
   ```
   keyTrigger 检测写入时机
   ↓
   输出 Proposal（本 turn）
   ↓
   用户回复 mb:write 确认
   ↓
   执行写入（下一 turn）
   ```

3. **跨 Turn 流程**：
   - 提议和执行分属不同 turn
   - 用户确认是流程的必要环节
   - 支持 `mb:write`（确认）和 `mb:no`（拒绝）

4. **Loop Guards**：
   - **Command Guard**：用户消息包含 `mb:write` 或 `mb:no` 时，不再发起新提议
   - **Repeat Guard**：防止对同一内容重复提议

**设计理念**：
- 掌控感优先：用户能看到 AI 做了什么，而不是后台黑盒
- 确认优先：写入操作需要用户明确确认
- 简单优先：统一使用一种调用方式，减少复杂度

## oh-my-opencode keyTrigger 集成方案

| 决策 | 日期 | 原因 |
|------|------|------|
| 使用 prompt_append 模拟内置 keyTrigger | 2026-01-31 | Sisyphus Phase 0 在 Memory Bank Protocol 前执行，导致规则冲突 |
| Oracle double check 改进 | 2026-01-31 | 措辞强化、递归保护精确化、双 orchestrator 支持、缓存 TTL |

**核心问题**：
- Sisyphus orchestrator 的 Phase 0 Intent Gate 在 Memory Bank Protocol 之前执行
- AI 按 Phase 0 规则分类后才看到 Memory Bank Protocol，产生冲突
- 需要让 Memory Bank 触发规则与 Sisyphus keyTrigger 同等优先级

**关键发现（Oracle 多轮讨论确认）**：
1. oh-my-opencode 的 keyTrigger 不是代码逻辑，而是纯文本指令
2. 内置 keyTrigger 只是被插入到 Phase 0 开头的一段文本（见 `dynamic-agent-prompt-builder.ts`）
3. 内置优势仅是文本位置（早 vs 晚），没有代码强制执行

**解决方案**：
使用 `agents.sisyphus.prompt_append` 在配置中添加一条格式相同的 keyTrigger 规则：
- 标记为 "Amendment to Key Triggers"
- 措辞要求 Sisyphus 将其视为第一条 keyTrigger
- 包含 `delegate_task` 的精确调用方式
- 包含 opt-out 和递归保护

**Oracle Double Check 改进（2026-01-31）**：

| 改进项 | 原方案 | 改进后 |
|--------|--------|--------|
| keyTrigger 措辞 | "Amendment to Key Triggers" | "AMENDMENT to Phase 0" + "insert Step 0"，增加 Sisyphus 服从度 |
| 递归保护 | 已有 `memory_reader:` 就跳过 | `user_question` 完全匹配才跳过，避免误判 |
| Orchestrator 支持 | 仅 Sisyphus | 同时支持 Sisyphus 和 Atlas |
| 缓存策略 | 永久缓存 keyTrigger 检测结果 | 60 秒 TTL，平衡性能与新鲜度 |

**可靠性评估**：
| 方案 | 可靠性 |
|------|--------|
| 真正内置（改 AgentFrontmatter） | ~95% |
| prompt_append 模拟（改进后） | ~85% |
| 仅 CLAUDE.md Protocol | ~70% |

**Oracle 最终评估**：
- **Production-ready for most users**
- 剩余风险是 prompt-based enforcement 固有的，不是实现问题
- 如果 >5% misroute 率，建议考虑代码级改动（提 PR 改 oh-my-opencode）

## v7.0 Gating 架构设计

| 决策 | 日期 | 原因 |
|------|------|------|
| Plugin Gating 机制 | 2026-02-01 | 解决"触发逻辑太弱"问题，从 prompt 规则升级为工具层硬约束 |
| Reader 去 subagent 化 | 2026-02-01 | 主 agent 直接读，Plugin 做 gating 确保读过上下文 |
| Writer 保留 subagent | 2026-02-01 | 安全边界必须保留，"mb:write 解锁主 agent 写"会打穿权限边界 |
| 渐进式启用策略 | 2026-02-01 | 默认 warn 不阻断，仅高风险写才 block |
| 减少 OpenCode 配置耦合 | 2026-02-01 | oh-my-opencode keyTrigger 降级为可选增强 |

### 核心问题

1. **触发逻辑太弱**：依赖 prompt 规则，AI 经常忽略
2. **太耦合 OpenCode 配置**：需要 oh-my-opencode.json、prompt_append 等
3. **Reader/Writer 可能冗余**：规范已在 Skill 里

### 三层架构设计

```
┌──────────────────────────────────────────────────────────────────┐
│                        Plugin (Runner)                            │
│  • 注入 MEMORY.md + Read Hints                                    │
│  • Gating: 写工具前检查是否读过上下文                               │
│  • 检测写入时机，触发 Proposal 提醒                                │
│  • 维护 writer session guard                                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                          Skill                                    │
│  • 规范"怎么做"（读什么、写什么、Proposal 格式）                    │
│  • 主 agent 直接按 Skill 读取 details/（无需 reader subagent）     │
│  • Proposal → mb:write → 调用 writer                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    memory-bank-writer (保留)                      │
│  • 唯一允许写 memory-bank/ 的 agent                               │
│  • 特权执行器：工具集可控、行为可控、guard 可控                     │
│  • 安全边界：主 agent 永久无权写，writer 有 guard 豁免              │
└──────────────────────────────────────────────────────────────────┘
```

### Gating 机制详细设计

**核心思想**：在 AI 尝试"写代码"之前，Plugin 检查它是否已经"读过上下文"。

**状态追踪**：
```typescript
interface MessageState {
  readFiles: Set<string>           // 已读取的 memory-bank/ 文件
  contextSatisfied: boolean        // 是否满足最低上下文要求
}
```

**捕获读操作**（tool.execute.before）：
- 当 AI 调用 read/glob 读取 memory-bank/ 下文件时，记录到 readFiles
- 如果读了 patterns.md 或 MEMORY.md，标记 contextSatisfied = true

**拦截写操作**（tool.execute.before）：
- 当 AI 调用 edit/write/apply_patch 时，检查 contextSatisfied
- 高风险写 + 未读上下文 → throw Error 阻止
- 低风险写 + 未读上下文 → warn 警告（默认不阻止）

**风险评估函数**：
```typescript
function assessRisk(tool, args): "high" | "medium" | "low" {
  // 多文件写 = 高风险
  if (tool === "multiedit") return "high"
  if (tool === "apply_patch" && countPatchFiles(args.patch) > 1) return "high"
  
  // 敏感路径 = 高风险
  const sensitivePatterns = [
    /^src\/auth\//, /^src\/security\//, /package\.json$/,
    /tsconfig\.json$/, /docker\//, /infra\//
  ]
  if (sensitivePatterns.some(p => p.test(targetPath))) return "high"
  
  return "low"
}
```

### Reader 去 subagent 化

**之前**：proxy_task({ subagent_type: "memory-reader", ... })
**之后**：主 agent 直接用 read/glob/grep 按 Skill 规范读取

**理由**：
- Reader 做的事情（读几个 markdown 文件）很简单
- Plugin gating 确保"写之前至少读过"，不依赖 subagent
- 减少 agent 调用开销

### Writer 保留 subagent 的理由（Oracle 强调）

**必须保留的核心原因**：Writer 不是为了"写 Markdown 更方便"，而是**安全边界**。

如果改成"mb:write 后解锁主 agent 写"，需要实现：
- 解锁窗口的生命周期（多久？只限本 turn？跨 turn？）
- 解锁的作用域（只允许一个文件？允许哪些工具？）
- 防绕过（主 agent 解锁后可用任何写工具写任意内容）
- 防 prompt injection（诱导用户到 mb:write 就等于提权）

**结论**：保留 writer subagent 比实现"细粒度 ACL + 状态机 + 工具沙箱"成本低且更安全。

### 渐进式启用策略

| 模式 | 行为 |
|------|------|
| MEMORY_BANK_GUARD_MODE=off | 只做注入与写保护（最轻） |
| MEMORY_BANK_GUARD_MODE=warn | 默认档；仅提醒，不拦截 |
| MEMORY_BANK_GUARD_MODE=block | 仅对高风险写拦截 |

**启用条件**：memory-bank/ 目录不存在时不启用 gating。

### Oracle 讨论关键结论

1. **"中控 Runner"应放在 Plugin 内**，不需要另一个 Agent 或 MCP
2. **触发可靠性的核心**：从 prompt 规则升级为工具层 gating
3. **极简替代方案（预注入 details + mb:write 解锁）的致命问题**：
   - 预注入会造成 token/注意力污染
   - mb:write 解锁会打穿安全边界
4. **一句话总结**："在任何写工具执行前，如果本轮没读过 memory-reader 且写入风险高，则阻止写入并给出唯一下一步"

## v7.1 Index-First + Direct-First 架构

| 决策 | 日期 | 原因 |
|------|------|------|
| Routing Rules 意图驱动 | 2026-02-02 | 从"主题导向"改为"行动导向"，减少 agent 猜错文件 |
| Drill-Down Protocol 两层读取 | 2026-02-02 | 确定性流程：direct read → memory-reader 升级 → 引用指针 |
| Reader 去强依赖 | 2026-02-02 | 小读取直接读，大读取才用 reader；减少调度开销 |
| Gating 门槛收紧 | 2026-02-02 | 高风险写前必须读 patterns.md（非 MEMORY.md） |
| 两层足够原则 | 2026-02-02 | 不强推 details/index.md；用 glob 兜底 |
| 信息密度三段式 | 2026-02-02 | 结论优先 + 边界条件 + 指针 |
| MEMORY.md 新模板 | 2026-02-02 | 增加 Drill-Down Protocol / Write Safety / Top Quick Answers |

**设计来源**：wechat_context 知识库设计启示 + Oracle 三轮讨论共识

**核心问题**：
1. Agent 不知道该读哪个文件（主题导向路由的歧义）
2. Reader 开销大但不调又容易幻觉（缺少升级路径）
3. MEMORY.md 内容策略不清晰（L1 vs L2 边界模糊）

**解决方案**：
1. **意图驱动路由**：按"你想做什么"触发，不按"这属于什么主题"分类
2. **两层读取协议**：direct read 1-3 文件 → 不够再升级 memory-reader → 回答必须有引用
3. **确定性触发**：不做复杂度判断，用关键词/操作类型/文件数阈值

**详细设计**：见 [design-index-first-architecture.md](design/design-index-first-architecture.md)

<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
