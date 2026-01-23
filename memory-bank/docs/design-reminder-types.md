# 提醒类型分离设计

> 解决 INIT 提醒后阻塞 UPDATE 提醒的问题

> 注意：当前 `plugin/memory-bank.ts` 中 session.idle 相关提醒逻辑已暂时禁用，本设计作为历史方案参考。

## 问题描述

### 现象
1. 会话开始 → 检测到没有 memory-bank 目录 → 触发 INIT 提醒
2. 用户回复"初始化并提交" → 创建 memory-bank
3. 用户修改代码文件
4. `session.idle` 事件触发 → **没有 UPDATE 提醒**

### 根因
`reminderFired` 是全局一次性开关，一旦 INIT 提醒触发后设为 `true`，所有后续 UPDATE 提醒都被阻塞。

```typescript
// 问题代码
if (state.reminderFired) {
  return  // 直接跳过，不检查是否需要 UPDATE
}
```

## 解决方案

### 状态结构变更

**旧结构**：
```typescript
interface RootState {
  // ...
  memoryBankUpdated: boolean  // 粘性，一旦 true 永不重置
  reminderFired: boolean      // 全局一次性开关
}
```

**新结构**：
```typescript
interface RootState {
  filesModified: string[]
  hasNewRequirement: boolean
  hasTechDecision: boolean
  hasBugFix: boolean
  
  memoryBankReviewed: boolean   // 逃逸阀
  skipInit: boolean             // 逃逸阀
  
  initReminderFired: boolean              // INIT 提醒已触发
  lastUpdateReminderSignature?: string    // 上次 UPDATE 提醒的触发签名
  lastSyncedTriggerSignature?: string     // MB 更新后的触发签名
}
```

### 触发签名

用于 UPDATE 提醒去重，避免重复提醒相同变更：

```typescript
function computeTriggerSignature(state: RootState): string {
  return JSON.stringify({
    files: [...state.filesModified].sort(),
    flags: {
      hasNewRequirement: state.hasNewRequirement,
      hasTechDecision: state.hasTechDecision,
      hasBugFix: state.hasBugFix,
    }
  })
}
```

### 逻辑流程

```
session.idle 事件:
  1. 通过 git status 检测变更文件
  2. 检测 memory-bank/ 是否存在
  
  3. 若不存在（INIT 场景）:
     - 若 skipInit = true → 跳过
     - 若 initReminderFired = true → 跳过
     - 否则 → 触发 INIT 提醒，设置 initReminderFired = true
     - 返回（INIT 场景不检查 UPDATE）
  
  4. 若存在（UPDATE 场景）:
     - 重置 initReminderFired = false（目录已存在）
     - 计算当前 triggerSignature
     - 若无触发事件 → 跳过
     - 若 signature = lastSyncedTriggerSignature → 跳过（已同步）
     - 若 signature = lastUpdateReminderSignature → 跳过（已提醒）
     - 否则 → 触发 UPDATE 提醒，设置 lastUpdateReminderSignature
```

### 同步标记

当用户执行更新操作后，设置 `lastSyncedTriggerSignature`：

```typescript
// 用户回复"更新"或"更新并提交"后
state.lastSyncedTriggerSignature = computeTriggerSignature(state)
```

## 边界情况

| 场景 | 行为 |
|------|------|
| 用户忽略 INIT 提醒，继续修改文件 | 不触发 UPDATE（目录不存在时 INIT 优先） |
| 用户说"跳过初始化"，然后修改文件 | 不触发任何提醒（skipInit 生效） |
| INIT 后立即修改文件 | 触发 UPDATE 提醒 ✅ |
| 同样的文件再次修改 | 不重复提醒（签名相同） |
| 新文件修改 | 触发 UPDATE 提醒（签名不同） |

## 实现检查清单

> 已实现但当前提醒链路未启用，仅作历史记录。

- [x] 更新 `RootState` 接口
- [x] 实现 `computeTriggerSignature()` 函数
- [x] 修改 `getRootState()` 默认值
- [x] 重写 `evaluateAndFireReminder()` 逻辑
- [x] 删除 `memoryBankUpdated` 和 `reminderFired` 字段
- [x] 更新日志输出的字段名
- [x] 删除 message.updated 中的 `reminderFired = false` 重置逻辑
