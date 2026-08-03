# Reference Architecture Matrix

Character Memory System 不直接合并参考插件代码，而吸收设计思想。

| Layer | Reference | Purpose |
|---|---|---|
| Memory Layer | memory-system | 长期记忆、提取、检索、Prompt注入 |
| Persona Layer | multi-diary | 角色卡、角色ID、隔离 |
| Character State Layer | gentle-guardian | 情绪、状态、行为规则 |
| Structured Life Layer | whereabouts | 事件、生活状态、备份 |
| Relationship Layer | dual-life-hub | 用户-角色关系模型 |

目标架构：

Character Card
    ↓
Persona Layer
    ↓
Relationship Layer
    ↓
Character State Layer
    ↓
Structured Life Layer
    ↓
Memory Layer
    ↓
Operit Memory API
