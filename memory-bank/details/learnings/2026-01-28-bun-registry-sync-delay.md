# Bun Registry 同步延迟导致版本解析失败

> 日期：2026-01-28

## 问题

刚发布到 npm 的新版本，用 `bunx package@version` 安装时报错：

```
error: No version matching "x.x.x" found for specifier "memory-bank-skill" (but package exists)
```

但 `npm view` 和 `npm pack` 都能看到该版本。

## 根因

Bun 的 registry 镜像与 npm 主 registry 有 **2-3 分钟** 的同步延迟。

## 解决方案

**必须先等待，再清缓存**：

```bash
# 等待 2-3 分钟让 bun registry 同步
sleep 180

# 清理缓存
bun pm cache rm

# 然后安装
bunx memory-bank-skill@x.x.x install
```

⚠️ **注意**：只清缓存不等待是不够的！必须等 bun registry 同步完成。

## 适用场景

| 场景 | 操作 |
|------|------|
| 刚发布新版本（3分钟内） | 等待 + 清缓存 + 安装 |
| 发布后 3+ 分钟 | 清缓存 + 安装 |
| 正常安装已发布版本 | 直接安装 |

## 验证命令

```bash
# 确认 npm 上有该版本
npm view memory-bank-skill versions --json | tail -5

# 确认能下载
npm pack memory-bank-skill@x.x.x
```
