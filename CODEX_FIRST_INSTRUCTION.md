# Codex 第一条指令（v6）

你现在接手 Character Memory System 项目。

这是一个基于 Operit ToolPkg 的角色长期记忆系统。

开始时不要修改代码。

---

## 阅读资料

必须阅读：

- DEVELOPMENT_PLAN.md
- AGENTS.md
- CODEX_DEVELOPMENT_INSTRUCTIONS.md
- docs/REFERENCE_ARCHITECTURE_MATRIX.md

参考：

- docs/reference/
- docs/reference_plugins/

.toolpkg 文件本质为 ZIP，可以解压分析。

---

## 分析参考插件

请分析：

1. memory-system

关注：
- Memory API
- 提取
- 检索
- Prompt注入

2. multi-diary

关注：
- Character Card
- Persona ID
- 角色隔离

3. gentle-guardian

关注：
- 状态系统
- 行为规则

4. whereabouts

关注：
- 结构化状态
- 事件记录
- 备份

5. dual-life-hub

关注：
- 关系模型

---

## 输出开发评估报告

包括：

1. 当前项目架构
2. 当前能力
3. 五个参考插件的可借鉴设计
4. 不应复制的部分
5. 目标融合架构
6. P0实施方案

---

限制：

- 不修改文件
- 不生成代码
- 不重构
- 不猜测API

完成后等待下一步指令。


## v8分类兼容规则

不要删除原 Memory System 分类：
- info
- finance
- menstrual

角色系统扩展必须兼容原生活助手能力。
角色不用某功能，不代表删除该功能。


v8架构要求：
开发过程中必须保留 info、finance、menstrual 基础分类。
不得因为角色系统扩展删除生活助手能力。
