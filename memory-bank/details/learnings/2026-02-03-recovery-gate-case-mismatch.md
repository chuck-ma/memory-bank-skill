# Recovery Gate 路径大小写不一致导致 gate 永不解除

> 日期：2026-02-03 | 版本：v7.3.0 | 类型：Bug 修复

---

## 问题

Recovery Gate 在 macOS 上永远无法解除，即使用户已经 read 了所有要求的 anchor 文件。

**复现步骤**：
1. 触发 compaction（会话压缩）
2. 尝试 edit 操作 → 被 Recovery Gate 阻止
3. read `memory-bank/MEMORY.md`
4. read `memory-bank/details/patterns.md`
5. 再次 edit → **仍然被阻止**

---

## 根因

路径存储和比对时的大小写处理不一致：

### 存入 `recovery.anchorPaths` 时

FALLBACK_ANCHORS 原样存入（`"memory-bank/MEMORY.md"` 大写），compaction hook 未做 canonicalize。

### 比对时

`canonicalizeRelPath()` 在 macOS/Windows 上会 `toLowerCase()`，得到 `"memory-bank/memory.md"`（小写）。

`recovery.anchorPaths.includes(canonical)` 比对失败：`"memory.md" !== "MEMORY.md"`。

Gate 要求所有 anchor 都 read 才解除，一个不匹配就永久卡死。

---

## 修复方案

在存入 `recovery.anchorPaths` 之前，统一 canonicalize 所有路径。同时修复错误消息中的展示路径。

---

## 教训

| 教训 | 说明 |
|------|------|
| **路径比对要统一格式** | 存和取必须用同样的 canonicalize 逻辑 |
| **macOS 大小写不敏感但保留大小写** | 文件系统不区分，但 JS 字符串比较区分 |
| **Set/Map 的 key 必须 canonical** | 否则同一个文件会被当作多个 |

---

## 相关链接

- [design-session-anchors.md](../design/design-session-anchors.md) - Session Anchors 设计文档
- `plugin/memory-bank.ts:536-549` - FALLBACK_ANCHORS 和 canonicalizeRelPath
- `plugin/memory-bank.ts:1092-1109` - compaction hook 设置 recovery
- `plugin/memory-bank.ts:1294-1309` - Recovery Gate read 追踪
