# Memory Bank 结构化输出 Schema（Legacy）

> **⚠️ Legacy 文档**：此文件定义的 JSON 格式是 v6.x 设计，v7.1 已改用 YAML 格式。
> 当前规范见 [memory-reader-prompt.md](memory-reader-prompt.md) 和 [reader.md](reader.md)。
>
> 此文件保留用于历史参考和潜在的工具集成场景。

---

> 此文件定义 Memory Bank 操作的结构化输出格式，用于决策审计和工具集成。

---

## 文件选择输出

当 AI 决定加载哪些文件时，输出此格式：

```json
{
  "schemaVersion": "2.0",
  "action": "select_files",
  "files": [
    "details/requirements/REQ-003-payment.md",
    "details/learnings/2024-01-20-payment-timeout.md"
  ],
  "reason": "用户讨论支付超时，加载相关需求和历史 bug 经验",
  "budget": {
    "filesSelected": 2,
    "filesLimit": 5,
    "linesSelected": 270,
    "linesLimit": 500
  },
  "riskAlerts": [
    {
      "level": "warning",
      "file": "details/learnings/2024-01-20-payment-timeout.md",
      "message": "历史上支付模块有超时问题，建议查看"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `schemaVersion` | string | Schema 版本号 |
| `action` | string | 操作类型，固定为 `select_files` |
| `files` | string[] | 选中的文件路径列表（相对于 memory-bank/） |
| `reason` | string | 选择这些文件的原因 |
| `budget.filesSelected` | number | 已选文件数 |
| `budget.filesLimit` | number | 文件数上限（5） |
| `budget.linesSelected` | number | 已选文件总行数 |
| `budget.linesLimit` | number | 行数上限（500） |
| `riskAlerts` | object[] | 风险提示列表 |
| `riskAlerts[].level` | string | 风险级别：info / warning / error |
| `riskAlerts[].file` | string | 相关文件 |
| `riskAlerts[].message` | string | 提示消息 |

---

## 写入计划输出

当 AI 计划写入 Memory Bank 时，输出此格式：

```json
{
  "schemaVersion": "2.0",
  "action": "memory_ops",
  "operations": [
    {
      "type": "create",
      "path": "details/requirements/REQ-004-refund.md",
      "reason": "用户确认新增退款功能需求"
    },
    {
      "type": "update",
      "path": "MEMORY.md",
      "block": "MACHINE_BLOCK",
      "section": "Current Focus",
      "changes": "更新当前焦点为退款功能"
    },
    {
      "type": "update",
      "path": "details/requirements/index.md",
      "changes": "添加 REQ-004 路由条目"
    }
  ],
  "requiresConfirmation": true
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `schemaVersion` | string | Schema 版本号 |
| `action` | string | 操作类型，固定为 `memory_ops` |
| `operations` | object[] | 操作列表 |
| `operations[].type` | string | 操作类型：create / update / delete |
| `operations[].path` | string | 目标文件路径（相对于 memory-bank/） |
| `operations[].block` | string | 更新哪个区块：MACHINE_BLOCK / USER_BLOCK（仅 update） |
| `operations[].changes` | string | 变更描述 |
| `operations[].reason` | string | 操作原因（仅 create） |
| `requiresConfirmation` | boolean | 是否需要用户确认（通常为 true） |

---

## 用户确认格式

向用户展示写入计划时，使用此格式：

```
[Memory Bank 更新计划]
- 创建: details/requirements/REQ-004-refund.md（退款功能需求）
- 更新: MEMORY.md（更新 Current Focus）
- 更新: details/requirements/index.md（添加路由条目）

是否执行？[Y/n]
```
