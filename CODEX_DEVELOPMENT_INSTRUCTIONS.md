# Codex 开发执行指令

开始开发前：

1. 阅读：
- DEVELOPMENT_PLAN.md
- AGENTS.md
- docs/reference/

2. 不立即修改代码。

先输出：
- 项目结构分析
- ToolPkg架构分析
- Memory流程分析
- 风险点

确认后再执行。

开发顺序：

P0 ToolPkg环境确认
P1 UI改造
P2 记忆模型升级
P3 提取Prompt优化
P4 召回优化
P5 角色系统增强
P6 导出迁移

原则：

- 保持Operit API兼容
- 不创建第二套数据库
- 不大规模重写
- 修改保持模块化

Operit 权威来源：

- 最终权威仓库：https://github.com/AAswordman/Operit
- `D:\Operit` 是本地权威 Git 仓库；需要最新内容时按 AGENTS.md 的代理规则执行 `git pull` 后再判断 API。
- 优先核对上游 `docs/`、`examples/types/` 和对应运行时实现；本项目 `docs/reference/` 仅为同步维护的摘要。

每阶段测试：
- 加载
- UI
- Memory.create
- Memory.query
- Prompt注入
- toolpkg导入


# 参考插件使用规则

docs/reference_plugins/ 中包含参考 ToolPkg：

- com-operit-memory-system-v1.2.0.toolpkg
- multi-diary-v2.0.0.toolpkg

这些文件本质是 ZIP 格式 ToolPkg，可直接解压分析。

参考原则：

Memory System:
学习记忆提取、Memory API、Prompt注入。

Multi Diary:
学习角色卡解析、Persona隔离。

禁止：
- 直接复制代码结构
- 替代Operit Memory API
- 使用日记文件作为主要长期记忆

后续如果加入新的参考插件，请先分析其可借鉴设计，再决定是否吸收。


参考方向新增：
- Persona Layer：参考 multi-diary
- Character State Layer：参考 gentle-guardian
- Relationship Layer：参考 dual-life-hub
- Structured Life State：参考 whereabouts


## v6参考架构

开发时参考五个层：

- Memory Layer
- Persona Layer
- Relationship Layer
- Character State Layer
- Structured Life Layer

参考插件只用于设计学习，不直接复制。


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
