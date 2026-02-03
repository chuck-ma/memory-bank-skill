# REQ-001: Memory Bank 模板版本升级路径

> 创建于: 2026-02-02
> 状态: Proposed

## 背景

当前 `/memory-bank-refresh` 命令覆盖三种场景：
1. **初始化**：无 memory-bank/ → 创建 v7.1 结构
2. **迁移**：旧结构（brief.md, active.md, _index.md）→ v7.1
3. **刷新**：已有 v7.1 → 更新 Routing Rules 等

但缺少 **v7.0 → v7.1 的 in-place 升级路径**：
- 刷新流程检测到版本 < v7.1 → 说"建议运行迁移"
- 迁移流程期望旧文件（brief.md）→ v7.0 没有这些文件
- 结果：v7.0 用户无法升级到 v7.1

## 需求

### 必须支持

1. 检测 MEMORY.md 版本标记 `<!-- MEMORY_BANK_TEMPLATE:v7.x -->`
2. 当版本 < v7.1 且 MEMORY.md 已存在时，执行 in-place 升级
3. 保留用户已有内容（Project Snapshot, Current Focus, Decision Highlights 等）
4. 添加 v7.1 新增区块（如缺失）：
   - Routing Rules（意图驱动格式）
   - Drill-Down Protocol
   - Write Safety Rules
   - Top Quick Answers
5. 升级后更新版本标记为 v7.1

### 可选支持

- 版本号跳跃升级（如 v6.0 → v7.1）
- 自动备份旧 MEMORY.md（如 MEMORY.md.bak）

## 验收标准

1. v7.0 MEMORY.md 执行 `/memory-bank-refresh` 后升级为 v7.1
2. 用户自定义内容（USER_BLOCK）完整保留
3. 机器区块（MACHINE_BLOCK）内容不丢失，格式更新
4. 版本标记正确更新

## 约束

- 必须通过 memory-bank-writer 执行（安全边界）
- 升级前必须输出计划，等待用户确认
- 不得覆盖 USER_BLOCK 内容

## 开放问题

1. 如何处理用户在 MACHINE_BLOCK 中的自定义修改？
2. v7.0 → v7.1 之间的具体区块差异是什么？
3. 是否需要支持降级（v7.1 → v7.0）？
