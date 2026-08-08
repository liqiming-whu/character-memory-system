# Character Memory System

## 当前版本：v2.3.3（Analysis Result File Channel Fix，已真机验证 ✅）
v2.3.3 修复自动分析"显示分析中但随后超时"（v2.3.2 引入的显示链路最后一环）：
1. **根因**：分析完成信号走 `setEnv('MEMORY_SYSTEM_TRIGGER_RESULT')`，但该写入发生在工具调用结束后的异步回调里，活动 callRuntime 已失效 → 写入失败被吞 → UI 轮询读不到 → 90s 显示"分析超时"（trigger.json 实锤分析实际已完成并落盘）。
2. **修复（同 CME 方案）**：改为**文件通道**——`_runAutoAnalysis` 完成/失败时写 `trigger_result.json`（原子写），新增 `get_trigger_result` 工具供 UI 轮询读取；UI 轮询从读 env 改为调工具。
3. 版本号 2.3.2 → 2.3.3。**20:07 真机验证 PASS：自动分析全流程（分析中→完成）自动显示，不再超时。**
---
## 上一版本：v2.3.2（Async Render Fix Release）
本次修复自动分析结果「切 tab 才显示」的遗留问题（12.2，v2.0.0 起）：
1. **onLoad action 窗口 120s**：根节点 onLoad 结束后保持 120s 订阅窗口，期间自动分析轮询等异步 setState 触发平台中间渲染实时推送——异步路径不再需要切 tab 才显示「分析中」/「分析完成」与数据刷新（同 CME v2.3.2 方案，源码级机制：UI 树只在初始渲染/action 分发/文本输入/平台侧 rerender 时重建）。
2. **自动分析延迟 8s 触发**：确保 `trigger_analysis` 的 callTool 返回与轮询刷新落在 onLoad 窗口内（同 CME v2.3.2）。
3. 版本号 2.1.0 → 2.3.2（与 CME 同版本战役对齐）。
---
## 上一版本：v2.1.0（Rendering Hotfix Release）
本次热修复聚焦渲染链路稳定性，消除快速切换选项卡时的偶发 compose_dsl 崩溃：
1. **移除角色页渲染闭包内残留探针**（`tabs/character.js` 的 `Tools.Files.write`）：每次角色页渲染同步写文件，快速切 tab 渲染风暴时文件 I/O 竞争 → 中间渲染失败 → Operit DSL 动作表竞态 → `compose_dsl runtime error: not a function`（operit.log 实锤 `__operit_dispatch_compose_dsl_action`）。
2. 与 CME 同源优化对齐（CME `89076ea`）：渲染闭包内禁止任何文件 I/O 与工具调用；探针统一走限频路径或整体关闭。
3. 修复后快速连续切换 tab（含角色页）不再触发 DSL 崩溃。
提交：`ad295cc`
---
## 上一版本：v2.0.0（Frontend Overhaul & Memory Pipeline Release）

本次发布以「前端体验修复 + 记忆分析链路根治」为主题，跨 CMS/CME 双端共 15 个提交。CMS 侧核心：

**记忆管理 UI**

1. 知识页「记忆」栏目新增删除按钮（两段式：删除→确认），与「信息」栏目对齐；删除按钮移到条目标最右侧，不再紧贴时间徽标。
2. 删除链路修复：前端补传 `caller_card_id`（persona 目录定位）、CMS 删除按 `title` 传参（对齐原生 `delete_memory` 语义）。
3. 幽灵记忆处理：删除遇 `Memory not found` 时本地清理缓存；真空加载（查询成功但 0 条）清空历史幽灵缓存，UI 不再显示假条目。

**错误提示**

4. `fmtErr` 收紧为只匹配工具缺失类报错（`tool(s) not found` / `no tool`）才追加「请在配置中启用」，数据错误（如 Memory not found）显示原始信息，不再误导。

**分析链路（根治「无新对话内容」）**

5. 消息时间戳健壮化 `tsToMs`：兼容 epoch 毫秒 / epoch 秒 / ISO 带时区 / 本地无时区串四种形态，统一转毫秒比较，水位线过滤不再因格式变化失效。
6. 窗口修复（根因）：`Tools.Chat.getMessages` 每次最多返回约 195 条，且 `order:'asc'` 取最早窗口（旧对话）、`desc` 取最新窗口，两窗口不连续。原 asc 拉取在消息量越过窗口后永远拿不到新消息 → 水位线过滤后恒为「无新对话内容」。
7. 设计定稿：分析统一只取**时间最近的 200 条**（`desc + limit:200 + reverse`），侧边栏自动检测（trigger_analysis）、手动分析（analyze_saved_messages）与 main.js processCooldown 三处一致。
8. 双时区端到端验证：Etc/UTC 与 Asia/Shanghai 下新消息 timestamp 均为 epoch 毫秒（时区无关），`desc` 增量检测两种时区均正常（4 条 / 2 条命中），水位线连续推进——确认改 UTC 不影响拉取最新，纯属窗口取错。

**CME 端同步**（下次切回 CME 时随烧录生效）：分析工具名修正（`memory_system:analyze_saved_messages` → `memory_engine:analyze_chat`）、import_legacy_backup 子标题丢失修复、时间线/知识删除按钮单击直删、fmtErr 收紧、幽灵记忆处理、同款窗口修复（两处 `order:'asc'` → `desc + reverse`）。

详细报告见 [CMS_v2.0.0_前端大修与记忆链路修复报告](docs/CMS_v2.0.0_前端大修与记忆链路修复报告.md)。

---

## 更早版本：v1.8.4（Architecture Fix Release）

本次发布确定了整个 CMS/CME 系列插件在 Operit 上的正确开发范式，修复三大架构级问题：

1. **UI 卡死（v1.6.9 治本）**：render 阶段调用 state setter 导致无限重建循环（mount 风暴）→ 铁律：render 必须纯函数，数据同步只发生在生命周期/action 阶段。
2. **空加载（v1.7.x 全面根治）**："有 UI 没条目"——首帧缓存时序 / persona 初始化链 / 数据入口不统一 / 工具响应空壳，四层防御：setEnv 首帧缓存 → 空壳守卫（失败不覆盖旧数据）→ 指数退避重试（10 次上限）→ 加载态（-- 与"正在读取"）。
3. **数据通道错配（v1.8.x 根治）**：Operit bridge 并发工具调用响应错配（工具出口正确、前端入口收到别的调用响应）→ 全局串行队列 `__serialCtx`（挂 ctx 跨模块共享，全文件所有 callTool 统一入队）+ 响应字段守卫（success=true 但缺关键字段 → 重试不当成功）。

完整战役报告见 `docs/`：

- `CMS_v1.6.x_卡死问题完整排查记录.md`
- `CMS_v1.7.3_探针故障复盘与开发规范.md`
- `CMS_v1.7x_空加载问题完整分析报告.md`
- `CMS_v1.8x_数据通道问题与当前状态报告.md`

开发范式四条铁律（已写入 TOOLPKG_DEVELOPMENT.md）：

1. render 禁止副作用（Compose DSL 渲染期 setState = 无限循环）
2. 模块级变量不可靠（每次挂载重新 require，不能做 boot 锁/缓存/防重入）
3. debug 不能影响业务（探针参数表达式先于函数体求值，dbgUi 内部 try 救不了）
4. tool 调用必须统一串行（Operit bridge 并发响应会错配，禁止 Promise.all 并发依赖返回顺序）

Character Memory System 是基于 Operit ToolPkg 和原生 Memory API 的角色长期记忆扩展。项目在保留个人 AI 助手能力的基础上，为当前角色卡增加隔离的长期记忆、召回和 Prompt 注入。

当前版本：`2.1.0`（渲染稳定性热修版，见上文）。记忆注入已重构为官方附件方案：设置页/输入菜单提供「记忆注入」总开关、「注入内容随消息保存」开关与「每次注入记忆条数」（输入 1-20 防抖保存，默认 5），持久化开关决定注入发生在 `PromptInput`（随消息保存）还是 `PromptFinalize`（仅发送给模型）。注入改用宿主 `query_memory` 工具，范围仅覆盖 Operit 默认记忆库（不再注入 memory_system 的 persona/global 目录与本地六类数据）。UI 已全面改用 `MaterialTheme.colorScheme` token 与官方 Compose 组件。六类生活数据已拆分为独立小文件存储（`life_store.js`，内存缓存 + 防抖写入 + 原子写），并新增数据备份导入导出（`export_backup`/`inspect_backup`/`restore_backup`）。

当前测试包：`com-operit-character-memory-system-v2.1.0.toolpkg`（部署于 /sdcard/Download/Operit/packages/ 与 /sdcard/Download/）。

> ⚠️ **v1.5.7 是支持「同时注入 memory_system + Operit 默认记忆库」的最后一个版本**。从 v1.5.8 起，注入范围仅覆盖 Operit 默认记忆库。

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
