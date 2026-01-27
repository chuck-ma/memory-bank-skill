# OpenCode 缓存版本不一致导致 Bun Segfault

## 日期
2026-01-27

## 问题描述
安装 memory-bank-skill 插件后，OpenCode 启动时必现崩溃（Bun segfault）。

## 错误信息
```
ERROR service=default error=[object Object] tui bootstrap failed
panic(main thread): Segmentation fault at address 0x143E802A7
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

## 根因分析

### 直接原因
OpenCode 缓存目录 `~/.cache/opencode/` 中存在版本不一致：

```bash
# package.json 记录的版本
$ cat ~/.cache/opencode/package.json | jq '.dependencies["memory-bank-skill"]'
"5.3.2"  # 旧版本

# 实际 node_modules 中的版本
$ cat ~/.cache/opencode/node_modules/memory-bank-skill/package.json | jq '.version'
"5.5.1"  # 新版本
```

### 触发机制
1. OpenCode 启动时检查 `dependencies["memory-bank-skill"]` = "5.3.2"
2. 用户配置 `memory-bank-skill` (latest) 或 `memory-bank-skill@5.5.1`
3. 版本不匹配，触发 `bun add --force` 重新安装
4. 安装过程与 TUI bootstrap 产生竞态
5. 竞态条件触发 Bun 运行时的 segfault

### 关键证据
同一个文件 (hash: `628745c5a097e32efd8ce5309f0d8109988a1b3c361573330d79b9eae49df1e9`)：
- 通过 `file://` 加载 → **正常**
- 通过包名加载 → **崩溃**

这证明问题不在插件代码，而在 OpenCode 的包加载机制。

## 解决方案

### 临时规避（用户侧）
```bash
rm -rf ~/.cache/opencode
```
清理缓存后重启 OpenCode 即可。

### 永久修复（我们侧）
1. **安装时使用固定版本号**：`memory-bank-skill@5.5.1` 而不是 `memory-bank-skill`
2. **安装时检测缓存不一致**：对比缓存版本，不一致时提示用户清理
3. **提供 upgrade 命令**：方便用户升级到新版本

## 教训
1. 使用 `latest` 隐式版本可能导致缓存一致性问题
2. OpenCode 的包缓存机制存在竞态风险
3. 应该始终使用固定版本号来避免这类问题

## 相关文件
- `src/cli.ts` - CLI 安装逻辑
- `~/.cache/opencode/package.json` - OpenCode 包缓存记录
