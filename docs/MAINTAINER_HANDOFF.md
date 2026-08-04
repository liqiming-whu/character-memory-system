# Character Memory System 维护交接

更新时间：2026-08-04

## 1. 项目与权威来源

- 项目仓库：`D:\Character-Memory-System`
- Operit 本地权威 Git 仓库：`D:\Operit`
- Operit 上游权威仓库：`https://github.com/AAswordman/Operit`
- API 判断顺序：`D:\Operit\docs`、`D:\Operit\examples\types`、Operit 运行时源码、本项目 `docs/reference`
- ToolPkg ID：`com.operit.character_memory_system`
- 当前版本：`1.5.2`
- v1.5.2 状态：代码已尝试修复并完成本地静态验证，实际效果尚未经过 Operit 实机测试。
- 当前包：`dist/com-operit-character-memory-system-v1.5.2.toolpkg`
- v1.5.2 SHA-256：`34bea2765b0db9eab710f3be77e011efe8cc0ccbfb72d1134e005a0fed1f9b6c`
- 设备数据目录：`/sdcard/Download/Operit/character_memory_system_data`

开始修改前必须阅读 `AGENTS.md`、`CODEX_DEVELOPMENT_INSTRUCTIONS.md`、`DEVELOPMENT_PLAN.md` 和 `docs/reference/`。不要假设工作区只含本次改动；先检查 `git status`，保留用户已有修改。

## 2. 当前架构

- `main.js`：Hook 注册、角色上下文持久化、输入缓存、自动分析、记忆注入（官方附件方案）与输入菜单开关。
- `packages/memory_system.js`：侧边栏工具、结构化数据读取、手动分析、Operit Memory CRUD、角色上下文读取、注入设置读写。
- `ui/memory_system_ui/`：Compose DSL 侧边栏 UI；核心逻辑不得搬进 UI。
- `extracted.json`：兼容旧版的六类结构化生活数据，不是独立通用记忆数据库。
- Operit Memory：唯一长期记忆核心。角色隔离同时使用 `callerCardId` 和 `character_memory/personas/{personaId}`。
- `last_input.json`：已废弃（v1.4.1 注入改用 `processedInput` 直接召回，不再依赖输入缓存）；如存在旧文件可忽略。
- `settings.json`：记忆注入设置（`injection.enabled` / `injection.persist`），JSON 持久化，与数据一起可导出。
- 记忆注入（官方 `com.operit.message_insert_bundle` 同款附件方案）：`persist=true` 走 `PromptInput/before_process`（随消息保存），`persist=false` 走 `PromptFinalize/before_send_to_model`（仅本次模型请求，不写回聊天记录）；已废弃 `SystemPromptCompose -> {systemPrompt}` 注入。

## 3. v1.5.2 当前实现

- ToolPkg ID 与数据目录已从原插件隔离。
- 支持生活六分类及 `character/relationship/preference/interaction_rule` 四类角色记忆。
- 自动分析使用角色卡绑定会话，并把识别结果写入 `active_persona.json` 和触发状态。
- 记忆注入已重构为官方 `com.operit.message_insert_bundle` 同款附件方案：设置页/输入菜单提供「记忆注入」与「注入内容随消息保存」开关（JSON 存于 `settings.json`）；`persist=true` 走 `PromptInput/before_process` 随消息保存，`persist=false` 走 `PromptFinalize/before_send_to_model` 仅进入本次模型请求；已废弃 `SystemPromptCompose` 注入。
- 注入附件为单个 `type="text/plain"`，XML 转义，ID 前缀 `character_memory_` + filename 前缀 `CMS`，注入前剥离并检测已有附件防重入叠加；三路查询复用会话 id 前 6 位作为快照 id，避免同一会话重复注入同一条记忆。
- `load_memories` 支持 `global/persona/all`、本地关键词兜底和原生综合检索。
- 针对 Operit `query:"*"` 只返回 10 字摘要的问题，v1.3.9 使用 `Memory.getByTitle` 分批补全全文。
- 角色页自动读取已从渲染阶段 `setTimeout` 调度迁移到组件 `onLoad`；仍需实机回归。
- 底部导航 label 已使用居中 Box；仍需实机回归。
- 记忆召回已合并当前 Persona 专属目录、`character_memory/global` 和不带 `folderPath` 的默认 Profile 查询，并移除 `threshold:0.5` 硬门槛。
- 本地结构化召回已改为通用相关度评分，最多 10 条且受 1800 字符预算限制，不再按数组倒序抢占固定 6 个名额。
- 联系人召回和原生同步已包含 `attributes/context/contexts/relation`。
- 新增 `reconcile_native_memory`；首次 `load_saved_data` 会尝试自动执行一次，成功后写入 `reconcile_v1_4_0.json`，失败不会写完成标记。
- 新提取的六分类条目已复用幂等 upsert；稳定标题使用结构身份哈希，避免相同分类下的不同事实互相覆盖。
- 上述 v1.5.2 项目均未经过实机验证，不能标记为实际修复完成。

## 4. 已确认的 Operit 平台行为

### 通配查询截断

`D:\Operit\app\src\main\java\com\ai\assistance\operit\core\tools\defaultTool\standard\MemoryQueryToolExecutor.kt` 的 `buildResultData` 对普通记忆执行 `memory.content.take(10)`，条件是查询为 `"*"`。当前 ToolPkg API 没有 `includeContent/fullContent` 开关；非通配查询和 `Memory.getByTitle` 返回完整正文。

### 检索权重

`query_memory` 从当前 Profile 的 `MemorySearchSettingsPreferences` 读取权重。当前默认 `vectorWeight=0.0`；`BALANCED` 模式本身没有强制关闭向量，只是零权重乘倍率后仍为零。当前 ToolPkg 查询参数不能覆盖 `scoreMode` 或各项权重。

### Hook 返回值

- `PromptFinalize` 阶段返回 `{systemPrompt}` 在已测正式版和 beta 中均未生效。
- 官方 `com.operit.message_insert_bundle` v0.3.0 已证明：在 `PromptFinalize/before_send_to_model` 返回 string，只修改本次模型请求的 current user turn，不写回聊天记录。
- 同样的 string 若在 `PromptInput/before_process` 返回，则属于可持久化输入处理路径。是否落盘由 Hook 阶段决定，不由 string 类型或 attachment 标签决定。
- `SystemPromptCompose/after_compose_system_prompt` 返回 `{systemPrompt}` 曾被验证可增加系统提示词长度且模型可感知，但 v1.4.1 已废弃该注入路径，改用官方附件方案（见下）。
- v1.4.1 记忆注入按 `settings.json` 的 `injection.persist` 选择：`true` → `PromptInput/before_process` 返回「原输入 + 单 text/plain attachment」随消息保存；`false` → `PromptFinalize/before_send_to_model` 返回同一附件字符串仅进入本次模型请求。
- 官方非持久化附件实现、宿主调用链和剩余缺点见 `PROMPT_INJECTION_COMPATIBILITY.md`。

## 5. v1.5.2 已尝试修复、等待验证的问题

### A. 默认 Operit Memory 中的个人记忆漏召回

旧实现只查询当前 Persona 专属目录和 `character_memory/global`。v1.4.0 已增加默认 Profile 全库查询，并过滤默认查询中标题以 `[persona:` 开头的条目；需要实机确认 `source=user_input` 的习惯可以进入注入且不会跨角色泄漏。

### B. 旧 `extracted.json` 条目未进入 Operit Memory

v1.4.0 已加入自动一次及手动强制对账。需要实机确认历史事件成功创建、第二次运行不重复，以及首次进入 UI 的耗时可接受。

### C. 本地结构化排序存在位置偏差

v1.4.0 已改为完整查询、token 和 2-4 字片段的通用评分，并补齐联系人属性。需要用真实输入确认习惯和历史事件优先于技术记录。

### D. 记忆注入机制（v1.5.2）

v1.5.2 将记忆注入从 `SystemPromptCompose -> {systemPrompt}` 重构为官方 `com.operit.message_insert_bundle` 同款附件方案：两阶段均返回「原消息 + 单个 XML 附件」，设置项含注入开关、注入内容随消息保存、每次注入记忆条数（1-20，默认 5，防抖保存）。需实机确认：persist 关闭时附件只进入本次模型请求而不写入聊天记录；persist 开启时随消息保存；重复发送/重试不叠加附件；同一会话通过快照 id 去重。

## 6. v1.5.2 实机验证与后续处理顺序

完整状态和验收标准见 `DEVELOPMENT_PLAN.md` 的“v1.4.0 召回修复计划”。代码已经按以下顺序尝试实现，接手者应先验证而不是重新实现：

1. 抽取统一的六分类 `serializeLifeEntry`，由 Prompt 本地召回、自动同步和历史对账共同使用。
2. 修复联系人序列化，包含 `attributes/context/contexts`。
3. 将本地召回改成通用相关度评分后排序，再按最大条数和字符预算截断；不要为“下周一”“杭州”“出差”写专项规则。
4. 原生召回增加默认 Profile 全库查询，同时保留插件 global 和当前 Persona 专属目录，合并去重。
5. 移除 `threshold:0.5` 硬门槛；不要把原生综合查询标成纯 vector。
6. 增加幂等的 `reconcile_native_memory`，补齐历史六分类数据；重复执行不得新增重复条目。
7. 所有新写入入口复用统一同步函数，避免本地与原生 Memory 再次分叉。
8. 记忆注入改为官方附件方案（`PromptInput` / `PromptFinalize` 双阶段 + 设置开关），不再使用 `SystemPromptCompose`。
9. 根据实机日志修正失败项；未取得实测证据前保持“已尝试修复，待实机验证”状态。

## 7. 关键设计决定

- 不建立 `memory-index.json` 作为第二套权威数据库。若使用缓存，只能是可删除、可由 Operit Memory 重建的性能缓存。
- 不把同一“用户习惯”永久复制到联系人和 info 两套独立事实中。新数据优先规范化为 `info/用户习惯`，旧联系人属性在读取和迁移时兼容。
- 不写死具体用户、角色卡 ID、对话 ID、日期、星期、城市、行程类型或测试样例。
- 默认 Profile 全库只用于个人通用记忆；角色私有召回继续要求当前 `callerCardId` 和 Persona 专属目录。
- 历史对账不自动删除原生 Memory 中用户手工创建的数据。
- 数据备份导出：参考 `com-operit-whereabouts-v0.4.23` 的 `backup_store.js`，JSON 文件集 + `manifest.json`（size/digest 校验）+ ZIP；`merge`/`overwrite` 两种恢复模式，`overwrite` 前自动生成保护性备份。计划见 `DEVELOPMENT_PLAN.md` 第 11 节，`[未开始]`。
- 设计来源：本插件以 `com.operit.memory-system` v1.2.0 为参考基础开发，后续 memory-system 更新可吸收其新能力。**但注入机制例外**：永远优先参考官方注入插件 `com.operit.message_insert_bundle`（两阶段附件方案），**不采纳 memory-system 的注入方案**（`PromptFinalize` 返回 `{systemPrompt}` 或拼贴文本块的旧做法）。

## 7.5 疑难问题（暂缓）

### 快速切换界面导致加载失效

状态：`[未解决，暂缓]`。用户已决定暂不关注，待以后解决。

现象（实机 v1.5.0–v1.5.2）：

- 快速在「插件界面」与「App 外部界面」之间来回切换时，偶尔出现**所有界面都不加载**（空白）。
- 角色页尤甚：切换后可能出现「只加载角色卡、记忆不加载」或「角色卡也不加载」。
- 角色页出问题时，切换到其它 tab 发现**整个插件都被影响，全部不加载**。
- 缓慢切换（等待加载完成）后，各界面逐渐恢复正常。

已排除/尝试的方向：

- 初始以为是 `load_saved_data` 同步对账阻塞 → 已改为后台异步（好转，但未根治）。
- 初始以为是子组件副作用不可靠 → 已改为 screen 根 onLoad + render 顶部 `setTimeout` 共享 state（好转，未根治）。
- 已确认 Compose DSL 的 `useRef` 在实例复用时**持久保留 current**，快速切换时可能残留 `true` 导致加载调度被跳过 → 已把加载状态权威从持久 ref 改为 state（`dataLoadedState`/`screenPersonaState`/`screenCharMemoriesState`），并去掉 `screenPersonaLoadingRef`。**仍有小概率触发**。

疑似方向（后续排查）：

- 多个 `setTimeout` 调度在快速切换时**回调被宿主丢弃**，`characterLoadScheduledRef`/`memoryLoadScheduledRef` 残留 `true` 挡后续加载。
- Compose DSL 的实例复用对 `useState` 初始值/`useRef` 语义可能与本项目假设不同，需在 Operit 宿主源码确认 `useRef` 生命周期。
- 角色页 `loadScreenPersona` 是唯一串行 await「角色上下文 → 角色记忆」的链路，快速切换中断时 state 更新顺序可能错乱。

备注：概览页 ↔ App 切换基本不触发；角色页 ↔ App 切换高概率触发，且角色页作为触发源会连带影响全局。优先级低于功能正确性，暂缓。

## 8. v1.5.2 必测场景

1. 默认 Operit Memory 文件夹中的用户习惯能够注入。
2. `contacts.attributes` 中位于正文后部的习惯能够注入。
3. 仅存在于旧 `extracted.json` 的事件，在本地相关度排序中能够命中。
4. 执行历史对账后，该事件可由 Operit Memory 查询并注入。
5. 对账连续执行两次，原生 Memory 条数不增加。
6. 输入不包含固定测试词时，任意日期、地点和活动类型仍按文本相关度工作。
7. 角色 A 查询不到角色 B 的私有记忆。
8. 「记忆注入」关闭时完全不修改用户消息；开启后以附件形式注入，且不重复叠加。
9. 「注入内容随消息保存」关闭时：聊天 UI、导出和本地消息数据库只保存原始用户消息；开启时随消息落盘。
10. 设置页与输入菜单的注入开关状态同步。
11. 角色页首次进入自动显示当前角色，退出重进仍正常，手动刷新仍可用。

## 9. 打包与验证

至少执行：

```powershell
node --check main.js
node --check packages/memory_system.js
node --check ui/memory_system_ui/screen.js
node --check ui/memory_system_ui/tabs/character.js
```

ToolPkg 是标准 ZIP，包内至少应包含 `manifest.json`、`main.js`、`packages/` 和 `ui/`。打包后重新打开 ZIP，核对 Manifest 版本、入口和角色页文件，再计算 SHA-256。

## 10. v1.5.2 交付物

已打包并验证：

- ToolPkg：`dist/com-operit-character-memory-system-v1.5.2.toolpkg`
- SHA-256：`34bea2765b0db9eab710f3be77e011efe8cc0ccbfb72d1134e005a0fed1f9b6c`
- 验证边界：仅本地语法、Manifest 和 ZIP 结构检查（15 个文件与源码逐文件 SHA 一致）；未进行 Operit 实机功能测试
