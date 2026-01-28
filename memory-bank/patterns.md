# 技术决策与约定

<!-- MACHINE_BLOCK_START -->

## Skill 结构

| 决策 | 日期 | 原因 |
|------|------|------|
| 合并 writer skill 到 references/ | 2026-01-28 | 简化结构，避免两个独立 skill 的 manifest 同步问题 |

**详细说明**：

`memory-bank-writer` 不再作为独立 skill，而是作为 `memory-bank` skill 的参考文档存在：
- `skills/memory-bank-writer/SKILL.md` → `skills/memory-bank/references/writer.md`
- 主 Agent 加载 `memory-bank` skill 后，按需读取 `references/writer.md`
- 删除 `memory-bank-writer/` 目录

**原因**：
1. `memory-bank-writer` 缺少独立的 `.manifest.json`，导致 skill 加载异常
2. 两个 skill 共享同一个 manifest 会造成混淆
3. Writer 规则本质上是 memory-bank 的一部分，不需要独立存在

<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
