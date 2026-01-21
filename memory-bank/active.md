# 当前焦点

## 刚完成

### Plugin 改为 npm 包形式安装 (v5.3.0)

问题：之前 plugin 需要复制到 `~/.config/opencode/plugin/` 目录，管理不方便。

解决方案：Plugin 作为 npm 包的 main 入口发布，在 opencode.json 中直接引用包名。

核心改变：
- package.json：添加 `main: dist/plugin.js`，`peerDependencies` 包含 `@opencode-ai/plugin`
- 构建脚本：同时编译 CLI 和 Plugin 到 `dist/`
- CLI：简化为 2 步（安装 skill 文件 + 配置 opencode.json 中的包名）
- opencode.json 配置：`"plugin": ["memory-bank-skill"]`

## 下一步

- [ ] 发布 v5.3.0 到 npm

## 阻塞项

无
