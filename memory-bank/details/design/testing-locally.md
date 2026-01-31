# 本地测试指南

## 目的

在本项目中测试 memory-bank-skill 插件，不影响全局 `~/.config/opencode/` 配置。

## 方法：使用项目级 opencode.json

OpenCode 支持项目级配置文件，会覆盖全局配置中的相应字段。

### 1. 创建测试配置

在项目根目录创建 `opencode.json`：

```json
{
  "plugin": [
    "file://./dist/plugin.js"
  ]
}
```

这会让 OpenCode 加载本地编译的插件，而不是 npm 包。

### 2. 编译插件

```bash
bun run build
```

### 3. 启动 OpenCode 测试

```bash
opencode
```

### 4. 测试完成后清理

```bash
rm opencode.json
```

## 注意事项

### 不要提交测试配置

`opencode.json` 已在 `.gitignore` 中（如果没有，请添加）。

### 调试模式

启用调试日志：

```bash
MEMORY_BANK_DEBUG=1 opencode --print-logs
```

### 常见问题

#### 缓存版本不一致

如果遇到 Bun segfault 崩溃，可能是 OpenCode 缓存不一致：

```bash
rm -rf ~/.cache/opencode/node_modules/memory-bank-skill
```

或清理整个缓存：

```bash
rm -rf ~/.cache/opencode
```

#### 使用固定版本

推荐在配置中使用固定版本号避免缓存问题：

```json
{
  "plugin": [
    "memory-bank-skill@5.5.2"
  ]
}
```

## 测试场景

### 场景 1：测试本地修改

```json
{
  "plugin": ["file://./dist/plugin.js"]
}
```

### 场景 2：测试 npm 发布版本

```json
{
  "plugin": ["memory-bank-skill@5.5.2"]
}
```

### 场景 3：测试与其他插件组合

```json
{
  "plugin": [
    "oh-my-opencode@3.1.2",
    "file://./dist/plugin.js"
  ]
}
```
