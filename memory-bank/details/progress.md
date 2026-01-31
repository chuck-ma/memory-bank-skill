# 完成状态与历史变更

> 更新于: 2026-01-31

## 已完成

- [x] v5.18.0: Writer 调用方式迁移（delegate_task → Task tool）
- [x] v1: Write/Edit 拦截 + Bash 启发式 + Late registration
- [x] v2: realpath symlink 解析 + 大小写不敏感 + MultiEdit/apply_patch
- [x] Oracle double check - PASS (v1 + v2)
- [x] CLI 版本号改为从 package.json 读取
- [x] 记录 bun registry 同步延迟问题
- [x] 写入守卫 v5.7.1-5.7.7: Bash 修复 + git 放行 + CLI agent 注册
- [x] v5.8.0: 修复 skill 路径（skill/ → skills/）
- [x] Memory-first V2 方案实现（Plugin 极简注入 + Skill 渐进式披露 + 职责分离）
- [x] Writer 职责分离实现（主 Agent 只说诉求，Writer 自主判断写入目标）
- [x] 合并 writer skill 到 references/writer.md，发布 v5.13.0

## 最近变更

| 日期 | 变更 |
|------|------|
| 2026-01-30 | 发布 5.18.0：Writer 调用方式从 delegate_task 改为 Task tool（subagent_type 方式） |
| 2026-01-29 | 发布 5.17.0：patterns.md 主动触发规则 + SKILL.md 描述性引用 |
| 2026-01-28 | 发布 5.13.0：合并 writer skill 到 references/ |
| 2026-01-28 | 决定合并 writer skill 到 references/，简化结构 |
| 2026-01-28 | 发布 5.9.0：Memory-first V2（极简注入 + 职责分离） |
| 2026-01-28 | 发布 5.8.0：修复 skill 路径为复数 skills/ |
| 2026-01-28 | 发布 5.7.0：realpath + 大小写 + MultiEdit/apply_patch 支持 |
| 2026-01-28 | 发布 5.6.2：CLI 版本号从 package.json 读取 |
| 2026-01-28 | 实现写入守卫 v1：Write/Edit 拦截 + Bash 启发式 |
| 2026-01-27 | 修复 OpenCode 缓存版本不一致导致 Bun segfault 问题 |
