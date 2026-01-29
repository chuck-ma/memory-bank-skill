# Skill references 目录结构验证

<!-- MACHINE_BLOCK_START -->
> 日期: 2026-01-29
> 类型: integration

## 问题
不确定 `references/` 目录结构是否符合 Claude Code Skill 官方规范

## 调查来源
- 官方文档 code.claude.com/docs/en/skills
- GitHub anthropics/claude-code skill-development SKILL.md

## 发现
- 官方不强制子目录名，`references/` 是可接受的模式
- 关键是在 SKILL.md 中用链接引用，并说明"何时该读"
- GitHub 上的 skill-development 最佳实践明确列出 `references/` 作为推荐目录

## 设计理念：Progressive Disclosure

Skill 的 reference 结构体现了渐进式披露原则：

| 层级 | 文件 | 职责 |
|------|------|------|
| 入口层 | SKILL.md | 核心概念 + 路由（< 500 行） |
| 详情层 | references/*.md | 完整规则，按需加载 |

**关键不只是目录结构，而是引用方式**：

1. **描述性链接**：说明"何时该读"
   - ✅ `需要了解**读取规则**时，见 [reader.md](references/reader.md)`
   - ❌ `| 读取 | [reader.md](references/reader.md) |`

2. **反触发**：说明"何时不读"（降低误路由）

3. **一致的决策语法**：统一模板比内容更重要

4. **入口层提供最小可用上下文**：不只是链接列表，要让读者能判断"是否需要深入"

## 结论
我们的结构符合规范：
```
memory-bank/
├── SKILL.md           # 主入口
└── references/
    ├── reader.md      # 读取规则
    ├── writer.md      # 写入规则
    ├── templates.md   # 文件模板
    └── advanced-rules.md  # 高级规则
```

## 教训
- 验证规范时应查阅官方文档 + 官方 GitHub + 社区最佳实践
- 目录结构只是形式，真正重要的是入口层的路由能力——用描述性引用帮助读者/LLM 判断何时该深入
<!-- MACHINE_BLOCK_END -->

<!-- USER_BLOCK_START -->
## 补充
{用户自由编辑区}
<!-- USER_BLOCK_END -->
