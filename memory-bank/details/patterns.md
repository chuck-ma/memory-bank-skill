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
- 使用 `delegate_task(subagent_type="memory-reader", run_in_background=true)` 启动
- 并行读取：MEMORY.md → 按路由规则读 details/ → 抽样关键源码
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
- 规则：收到相关消息 → 启动 memory-reader（后台）→ 继续工作 → 需要决策时获取结果

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

<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
