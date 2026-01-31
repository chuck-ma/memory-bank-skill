# Bash 守卫路径匹配过于激进

> 日期：2026-01-31 | 版本：v6.0.2 | 类型：Bug 修复

---

## 问题

Bash 守卫使用正则匹配任何包含 `memory-bank` 的路径，导致误判：

```bash
# 被错误拦截
git add skills/memory-bank/...
```

根本原因：正则 `/memory-bank/` 匹配了 `skills/memory-bank/`，而实际只应保护**项目根目录**下的 `memory-bank/` 目录。

---

## 错误示例

| 命令 | 应该 | 实际 |
|------|------|------|
| `git add skills/memory-bank/SKILL.md` | ✅ 放行 | ❌ 拦截 |
| `git add memory-bank/MEMORY.md` | ✅ 放行（git 命令） | ✅ 放行 |
| `rm -rf skills/memory-bank/` | ✅ 放行 | ❌ 拦截 |
| `rm -rf memory-bank/` | ❌ 拦截 | ❌ 拦截 |

---

## 修复方案

### 核心思路

两阶段检查：**预筛 + 精确路径解析**

1. **预筛**：substring check `memory-bank`，快速跳过无关命令
2. **精确解析**：解析 argv，提取路径参数，`path.resolve` 到绝对路径后调用 `isMemoryBankPath()`

### 技术要点

- **不再依赖正则判断路径**，正则只用于预筛
- **路径解析**：提取命令中的路径参数，resolve 到绝对路径
- **isMemoryBankPath()**：判断绝对路径是否在 `{projectRoot}/memory-bank/` 下
- **允许所有 git 命令**：因为路径检查会精确判断

### 代码逻辑

```typescript
// 预筛：快速跳过
if (!command.includes('memory-bank')) return { ok: true };

// 精确检查
const argv = parseCommand(command);
const paths = extractPathArgs(argv);
for (const p of paths) {
  const resolved = path.resolve(cwd, p);
  if (isMemoryBankPath(resolved, projectRoot)) {
    // 进一步检查是否写入操作
    if (isWriteOperation(argv[0])) {
      return { ok: false, reason: '...' };
    }
  }
}
```

---

## 教训

| 教训 | 说明 |
|------|------|
| **路径匹配要用路径 API** | 正则匹配路径容易误判，应该 resolve 到绝对路径再比较 |
| **保护范围要精确** | 只保护 `{projectRoot}/memory-bank/`，不是所有包含 `memory-bank` 的路径 |
| **预筛 + 精确分两步** | 预筛用 substring 快速跳过，精确用 path.resolve 判断 |

---

## 相关链接

- [design-write-guard.md](../design/design-write-guard.md) - 写入守卫完整设计
