# v7.0 → v7.1 模板升级设计

> 创建于: 2026-02-02
> 状态: 已确认（Oracle 3 轮讨论达成共识）
> 关联需求: [REQ-004-template-upgrade.md](../requirements/REQ-004-template-upgrade.md)

## 设计背景

`/memory-bank-refresh` 当前覆盖：
1. **初始化**：无 memory-bank/ → 创建 v7.1
2. **迁移**：旧结构（brief.md, active.md）→ v7.1
3. **刷新**：已有 v7.1 → 更新

**缺口**：v7.0 → v7.1 升级路径缺失。刷新流程检测到低版本会建议"运行迁移"，但迁移流程期望旧文件，导致 v7.0 用户无法升级。

## 设计决策

| 决策 | 选项 | 结论 |
|------|------|------|
| 升级策略 | 重建 vs 追加 | **追加**：保留全部内容，仅追加缺失区块 |
| Legacy 内容处理 | 归档到 legacy.md vs 保留原位 | **保留原位**：不移动、不重命名 |
| Routing Rules 冲突 | 跳过 vs 追加新版 | **追加新版**：用 `（意图驱动）` 后缀区分 |
| 版本检测 | 标记 + 内容推断 vs 仅标记 | **仅标记**：缺失标记视为需升级 |
| 作用域 | MEMORY.md + details/ vs 仅 MEMORY.md | **仅 MEMORY.md** |

## 检测流程

```
读取 memory-bank/MEMORY.md
├─ 不存在 → 走初始化流程（已有）
├─ 存在，检测版本标记 <!-- MEMORY_BANK_TEMPLATE:v7.x -->
│   ├─ 版本 >= v7.1 → 走刷新流程（已有）
│   ├─ 版本 < v7.1 → 走升级流程（新）
│   └─ 标记缺失 → 走升级流程（新）
└─ 检测到旧结构 (brief.md, active.md) → 走迁移流程（已有）
```

## 升级算法（Append-Only）

### 前置检查

```
检查区块标记完整性：
├─ MACHINE_BLOCK_START 存在 ✓
├─ MACHINE_BLOCK_END 存在 ✓
├─ USER_BLOCK_START 存在 ✓
└─ USER_BLOCK_END 存在 ✓

任一缺失 → 中止升级，提示用户手动修复标记
```

### 执行步骤

1. **保留 USER_BLOCK**：原样保持，不做任何修改

2. **更新版本标记**：
   - 定位 `<!-- MACHINE_BLOCK_START -->` 后第一行
   - 如存在 `MEMORY_BANK_TEMPLATE:v7.x` → 替换为 `v7.1`
   - 如不存在 → 插入 `<!-- MEMORY_BANK_TEMPLATE:v7.1 -->`

3. **追加缺失区块**（在 `<!-- MACHINE_BLOCK_END -->` 前）：

   按顺序检查，仅追加不存在的：
   
   | 区块 | 检测条件 | 追加内容 |
   |------|----------|----------|
   | `## Routing Rules（意图驱动）` | 精确标题匹配 | templates.md 中的意图驱动路由模板 |
   | `## Drill-Down Protocol` | 精确标题匹配 | templates.md 中的两层读取协议 |
   | `## Write Safety Rules` | 精确标题匹配 | templates.md 中的写入安全规则 |
   | `## Top Quick Answers` | 精确标题匹配 | templates.md 中的快速答案模板 |

4. **Routing Rules 冲突处理**：
   - 如已存在 `## Routing Rules`（无后缀）→ 保留不动
   - 追加 `## Routing Rules（意图驱动）` 并在首行注明：
     > 如上方存在旧的 `## Routing Rules`，视为 legacy；以本节意图驱动路由为准。

## 用户交互

保持现有 `/memory-bank-refresh` 流程：

```
[Plan 阶段]
检测到 MEMORY.md 版本 < v7.1，将执行升级：
- 更新版本标记为 v7.1
- 追加区块：## Routing Rules（意图驱动）
- 追加区块：## Drill-Down Protocol
- 追加区块：## Write Safety Rules
- 追加区块：## Top Quick Answers

USER_BLOCK 将保持不变。

回复"好"或"确认"执行升级。

[Confirm 阶段]
用户回复确认词 → 执行升级

[Apply 阶段]
执行升级 → 输出变更预览
```

## 错误处理

| 情况 | 处理 |
|------|------|
| 区块标记缺失 | 中止，提示手动修复 |
| 文件读取失败 | 中止，输出错误信息 |
| 写入失败 | 中止，不留下半成品 |

## 范围限制

**包含**：
- MEMORY.md 版本标记更新
- MEMORY.md 缺失区块追加

**不包含**：
- details/ 目录结构检查/修复
- 缺失文件创建（tech.md, progress.md 等）
- index.md 自动创建
- 内容合并/重构

## 实现位置

| 文件 | 变更 |
|------|------|
| `skills/memory-bank/references/writer.md` | 在 Refresh 流程中增加 Upgrade 分支 |
| `src/cli.ts` | 更新 `/memory-bank-refresh` 命令描述，提及升级 |

## 后续事项（不在本需求范围）

- Plugin 版本检测：`plugin/memory-bank.ts` 当前固定报告 `template_version: v7.1`，应改为实际检测
