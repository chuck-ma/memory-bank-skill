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

<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
