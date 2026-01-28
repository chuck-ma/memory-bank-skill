# Active Context

<!-- MACHINE_BLOCK_START -->
> 更新于: 2026-01-28

## 当前焦点

- 发布 v5.8.0：修复 skill 路径 + 写入守卫完整版

## 下一步

- [ ] 在实际项目中测试写入守卫
- [ ] 在实际项目中测试"整理记忆"功能

## 已完成（待归档）

- [x] v1: Write/Edit 拦截 + Bash 启发式 + Late registration
- [x] v2: realpath symlink 解析 + 大小写不敏感 + MultiEdit/apply_patch
- [x] Oracle double check - PASS (v1 + v2)
- [x] CLI 版本号改为从 package.json 读取
- [x] 记录 bun registry 同步延迟问题
- [x] 写入守卫 v5.7.1-5.7.7: Bash 修复 + git 放行 + CLI agent 注册
- [x] v5.8.0: 修复 skill 路径（skill/ → skills/）

## 阻塞项

- 无

## 最近变更

| 日期 | 变更 |
|------|------|
| 2026-01-28 | 发布 5.8.0：修复 skill 路径为复数 skills/ |
| 2026-01-28 | 发布 5.7.0：realpath + 大小写 + MultiEdit/apply_patch 支持 |
| 2026-01-28 | 发布 5.6.2：CLI 版本号从 package.json 读取 |
| 2026-01-28 | 实现写入守卫 v1：Write/Edit 拦截 + Bash 启发式 |
| 2026-01-27 | 修复 OpenCode 缓存版本不一致导致 Bun segfault 问题 |
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 用户笔记
{用户自由编辑区}
<!-- USER_BLOCK_END -->
