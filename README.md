# Character Memory System

Character Memory System 是基于 Operit ToolPkg 和原生 Memory API 的角色长期记忆扩展。项目在保留个人 AI 助手能力的基础上，为当前角色卡增加隔离的长期记忆、召回和 Prompt 注入。

当前版本：`1.5.5`。记忆注入已重构为官方附件方案：设置页/输入菜单提供「记忆注入」总开关、「注入内容随消息保存」开关与「每次注入记忆条数」（输入 1-20 防抖保存，默认 5），持久化开关决定注入发生在 `PromptInput`（随消息保存）还是 `PromptFinalize`（仅发送给模型）；默认 Profile 全库召回、联系人属性召回、结构化相关度排序和历史数据对账均已尝试修复并通过本地静态检查，但实际效果尚未经过 Operit 实机测试。UI 已全面改用 `MaterialTheme.colorScheme` token 与官方 Compose 组件。六类生活数据已拆分为独立小文件存储（`life_store.js`，内存缓存 + 防抖写入 + 原子写），并新增数据备份导入导出（`export_backup`/`inspect_backup`/`restore_backup`）。

当前测试包：`dist/com-operit-character-memory-system-v1.5.5.toolpkg`。

ToolPkg 唯一标识为 `com.operit.character_memory_system`。它不会以同 ID 覆盖原 `com.operit.memory_system`；为避免两个自动提取与 Prompt Hook 同时工作，测试和使用时请禁用原 Memory System。

## 首版能力

- 保留 `events`、`todos`、`contacts`、`info`、`finance`、`menstrual` 六类生活助手数据。
- 从 Prompt Hook 的 `metadata.activePrompt` 识别当前角色卡。
- 使用稳定的角色卡 `id` 作为 Persona ID。
- 通过 `callerCardId` 使用角色卡绑定的 Operit Memory Profile，不创建独立记忆数据库。
- 支持 `character`、`relationship`、`preference`、`interaction_rule` 四类角色记忆。
- 召回时合并当前角色记忆与默认生活记忆，并以官方附件方案在发送模型前注入受限背景区块。
- 提供概览、时间线、知识、角色、搜索、设置六个顶层页面。
- 角色页面支持查看当前角色、刷新、新增和删除角色记忆。
- 记忆注入采用官方 `com.operit.message_insert_bundle` 同款附件方案：设置页/输入菜单提供「记忆注入」总开关与「注入内容随消息保存」开关；开启时在 `PromptInput` 注入并随消息保存，关闭时在 `PromptFinalize` 注入且仅进入本次模型请求、不写入聊天记录。
- 原生记忆使用明确的 `source`、分类 `tags` 和角色 `callerCardId`，便于审计与后续迁移。
- 召回合并默认 Profile、插件生活目录和当前角色专属目录，并对结果去重。
- 首次读取结构化数据时尝试执行一次幂等历史对账，将旧六分类条目补齐到 Operit Memory；也可调用 `reconcile_native_memory` 强制重新核对。
- 本地结构化召回包含联系人 `attributes/context/contexts`，使用通用相关度排序而非固定业务词。

## 架构边界

- Operit Memory 是唯一长期记忆核心。
- 本地 JSON 仅保留旧版结构化生活数据、UI 状态和触发水位线。
- 新版本地运行数据目录为 `/sdcard/Download/Operit/character_memory_system_data`，不与原 Memory System 共用目录。
- 角色显示名不作为唯一标识。
- 首版不支持角色组、情绪状态机、关系等级、Reflection 或跨角色共享记忆。
- 角色记忆只作为背景资料，不得覆盖宿主系统规则。
- 角色隔离同时使用 `callerCardId` 与 `character_memory/personas/{personaId}` 专属目录；即使角色卡沿用全局 Memory Profile，插件查询也不会跨 Persona 目录。

## 配置

结构化提取仍使用设置页中的兼容 OpenAI Chat Completions 接口配置：

- `MEMORY_SYSTEM_ENDPOINT`
- `MEMORY_SYSTEM_KEY`
- `MEMORY_SYSTEM_MODEL`

Memory 的创建、查询和删除直接调用 Operit 原生 `Tools.Memory`。

## 测试方法

1. 在 Operit 中导入项目生成的 `.toolpkg`。
2. 启用插件并打开“记忆系统”侧边栏。
3. 在普通对话中确认原有生活数据仍可读取。
4. 启用角色卡 A，发送一条包含明确偏好或互动约定的消息。
5. 等待自动提取，或在角色页手动新增一条角色记忆。
6. 确认角色页显示角色卡 A 的名称、ID 和记忆。
7. 切换角色卡 B，确认看不到 A 的角色记忆。
8. 切回 A，确认记忆恢复可见并能在相关对话中被召回。
9. 验证无角色卡和角色组模式不会误写角色私有记忆。

详细阶段与完成状态见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)。

维护者继续开发前请阅读 [维护交接文档](docs/MAINTAINER_HANDOFF.md)。旧版 Operit 的 string 注入兼容方案及其风险见 [Prompt 注入兼容方案](docs/PROMPT_INJECTION_COMPATIBILITY.md)。

注入方案补充：v1.5.2 已采用 Operit 官方 `com.operit.message_insert_bundle` 的附件注入方式。默认不再使用 `SystemPromptCompose` 注入；由「记忆注入」总开关 +「注入内容随消息保存」开关 +「每次注入记忆条数」（1-20）决定在 `PromptInput/before_process`（随消息保存）或 `PromptFinalize/before_send_to_model`（仅进入本次模型请求、不写入聊天记录）返回附件字符串。实际效果尚未实机验证。

## 已知问题

- 快速在插件界面与 App 外部界面间切换时，偶发「各界面不加载」，角色页尤甚且会连带影响其它 tab；缓慢切换后恢复。已在 v1.5.0–v1.5.2 多轮缓解但未根治，暂缓处理（详见 [维护交接文档](docs/MAINTAINER_HANDOFF.md) 第 7.5 节与 [开发计划](DEVELOPMENT_PLAN.md) 第 12 节）。
- 记忆注入采用官方附件方案后，`PromptFinalize/before_send_to_model` 阶段返回的 XML 附件标签会原样进入模型输入（与官方插件行为一致）；如需避免标签噪音可自行评估，或保持官方兼容不改动。

## 设计来源与注入机制约定

本插件以 `com.operit.memory-system` v1.2.0 为参考基础开发（学习其 Memory API 使用、自动提取、检索与 Persona 隔离思路）。后续 memory-system 若更新，可将其新能力吸收进本插件。

**但注入机制例外**：无论 memory-system 如何演进，本插件的注入机制**永远优先参考官方注入插件** `com.operit.message_insert_bundle`（两阶段附件方案），**不采纳 memory-system 的注入方案**（`PromptFinalize` 返回 `{systemPrompt}` 或拼贴文本块的旧做法）。

## 权威资料

Operit 源码与 API 的最终权威是 [AAswordman/Operit](https://github.com/AAswordman/Operit)。

- 本地权威 Git 仓库：`D:\Operit`
- 本地文档：`D:\Operit\docs`
- 本地类型定义：`D:\Operit\examples\types`
- 本项目摘要：`docs/reference/`

`D:\Operit` 可通过 Git 拉取上游更新。本地源码过时时，应按项目代理规则执行 `git pull`，再以最新 `docs/`、`examples/types/` 和实际实现校正文档与开发判断。
