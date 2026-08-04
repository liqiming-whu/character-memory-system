# Character Memory System 开发计划

## 当前版本状态

目标版本：`1.5.3`（召回范围、结构化排序、历史数据对账、官方附件注入、注入条数控制、去重修复与 UI 主题重构版）

实现说明：v1.5.3 的代码修改和本地静态验证已完成，以下修复均属于“已尝试修复”；尚未在 Operit 实机环境验证实际效果。其中记忆注入已从 `SystemPromptCompose` 重构为官方 `com.operit.message_insert_bundle` 同款附件方案（两阶段均返回「原消息 + 单个 XML 附件」），新增「记忆注入」「注入内容随消息保存」「每次注入记忆条数（1-20，默认 5，防抖保存）」设置开关；v1.5.3 额外修复注入设置读回、开关乐观更新、注入内容补全、写入端去重、身份归一化、死代码清理、角色页进入自动加载、写入端 dedupe 缺失导致的冷却结算静默失败、跨源重复注入、部分更新重置设置、合并后统一按注入条数截断、注入条数防抖保存、load_saved_data 首次对账后台异步、用 state 代替持久 useRef 作为加载状态权威，以及全面 UI 主题重构（`MaterialTheme.colorScheme` token + 官方 Compose 组件，新增 `ui/memory_system_ui/theme.js`）。已知疑难：快速切换界面偶发加载失效（见第 12 节）。

ToolPkg ID：`com.operit.character_memory_system`。作为独立插件安装；运行时不与原 `com.operit.memory_system` 同时启用。

本地运行数据目录：`/sdcard/Download/Operit/character_memory_system_data`，与原版缓存隔离。

状态标记：

- `[已实现]`：代码或文档已完成，并通过本地静态检查。
- `[待实机验证]`：实现已完成，但必须在 Operit 设备环境验证。
- `[未开始]`：不属于本次首版交付。

## 1. 项目定位

Character Memory System 是基于 Operit Memory System 的扩展项目。

目标：

在保留 Operit 原有个人 AI 助手能力的基础上，增加长期角色智能能力。

不是替代 Memory System，而是在其上增加：

- 角色身份
- 关系成长
- 状态变化
- 长期互动记忆
- 未来自我反思能力

---

# 2. 总体架构

状态：`[已实现]` 首版采用 Operit 原生 Memory 作为唯一长期记忆核心。

## Memory Core（原始记忆核心）

保持 Operit Memory System v1.2.0 兼容。

原有分类：

|内部字段|UI名称|用途|
|-|-|-|
|events|事件|历史事件记录|
|todos|待办|任务记录|
|contacts|联系人|人物信息|
|info|基础信息|通用事实信息|
|finance|财务信息|收入、支出等财务记录|
|menstrual|健康周期|周期健康记录|

原则：

- 不删除原分类。
- 不改变已有数据含义。
- 保持原插件兼容。

---

# 3. Character Intelligence Layer（新增）

首版范围：

- `character`：`[已实现]`
- `relationship`：`[已实现]`
- `preference`：`[已实现]`
- `interaction_rule`：`[已实现]`
- `personality`：`[未开始]`
- `state`：`[未开始]`

角色隔离：`[已实现]` 从 `metadata.activePrompt.id` 获取稳定角色卡 ID，并通过 Memory API 的 `callerCardId` 选择角色绑定的 Memory Profile。

在 Memory Core 基础上增加角色智能分类。

## character（角色信息）

用途：

- 角色身份
- 角色背景
- 角色设定

---

## relationship（关系）

用途：

- 用户与角色关系
- 关系阶段
- 共同经历

---

## preference（偏好）

用途：

- 用户偏好
- 角色偏好
- 互动习惯

---

## personality（人格）

用途：

- 性格特点
- 价值观
- 表达方式

---

## interaction_rule（互动规则）

用途：

- 称呼规则
- 回复风格
- 长期互动约定

---

## state（状态）

用途：

- 当前情绪
- 当前关系状态
- 当前阶段状态

---

# 4. UI 改造（P1）

状态：`[已实现]` 顶层导航与首版角色管理页面已完成；`[待实机验证]` Compose DSL 渲染与交互。

目标：

让界面同时支持个人 AI 助手能力和角色智能能力。

## 导航

最终导航：

- 概览
- 时间线
- 知识
- 角色
- 搜索
- 设置

删除：

- 待办入口
- 联系人入口
- 消息入口

原因：

这些不是本项目核心 UI。

---

## 知识页面

与原知识页面保持一致

---

## 角色页面

管理：

- 角色卡
- 角色状态
- 关系状态
- 角色记忆筛选

首版已实现：

- 当前角色卡名称和 ID。
- 当前角色 Memory Profile 记忆列表。
- 四类角色记忆手动新增。
- 角色记忆刷新与删除。
- 无角色卡及角色组不支持提示。

关系状态和角色状态编辑：`[未开始]`。

---

# 5. 时间线设计

统一：

时间线（Timeline）

展示：

- 历史事件
- 生活记录
- 共同经历
- 重要记忆节点

原 events 保留作为数据基础。

---

# 6. 开发阶段

## P0：基础兼容

状态：

- ToolPkg 结构与权威 API 对照：`[已实现]`
- Memory 对象参数重载与 `callerCardId` 文档：`[已实现]`
- 本地 JavaScript 语法检查：`[已实现]`
- 插件导入、UI、Memory CRUD、Prompt 注入：`[待实机验证]`

目标：

确认：

- ToolPkg结构
- Memory API
- 数据读取方式
- UI框架

不改变核心数据。

---

## P1：UI改造

状态：`[已实现]`，等待实机验证。

完成：

- 导航调整
- 页面布局
- 中文显示
- 数据分类展示

---

## P2：记忆模型升级

状态：`[部分完成]`

- 原六分类兼容：`[已实现]`
- `character/relationship/preference/interaction_rule`：`[已实现]`
- `personality/state`：`[未开始]`

完成：

Memory Core兼容：

- events
- todos
- contacts
- info
- finance
- menstrual

新增：

- character
- relationship
- preference
- personality
- interaction_rule
- state

---

## P3：角色能力

状态：`[部分完成]`

- 角色卡绑定：`[已实现]`
- 角色隔离：`[已实现]`
- 角色记忆查询：`[已实现]`
- 分层召回与 Prompt 注入：`[已实现]`
- 关系状态模型：`[未开始]`
- 角色组：`[未开始]`

实现：

- 角色卡绑定
- 角色隔离
- 角色记忆查询
- 关系状态

---

## P4：高级能力

状态：`[未开始]`

未来：

- Reflection Layer
- 自我分析
- 自适应优化
- 行为改进

### 经期症状分析（低优先级）

状态：`[未开始]`

定位：经期记录仍属于现有生活记忆，不建立独立数据库；本功能只对已记录数据做趋势分析和风险提示。

计划范围：

- 结构化记录：开始/结束日期、周期长度、经期长度、经量等级、痛经等级、伴随症状、心情、用药和备注。
- 痛经采用 0-3 级记录：0 无痛，1 轻微且不影响活动，2 需要休息或缓解措施，3 严重影响活动；具体文案和处置阈值在实现前需由可靠医学资料复核。
- 数据积累至少 3-5 个完整周期后，再输出周期稳定性、经期长度变化、痛经趋势和症状趋势；数据不足时只展示记录，不给出规律性结论。
- 红旗提示覆盖疼痛进行性加重、常规缓解无效、发热、晕厥、出血量明显突变等情况；规则、阈值和提示等级在实现前需完成医学证据审查。
- 提供可解释的分析结果：展示触发规则、使用了哪些记录、数据完整度及分析时间，不输出无法追溯依据的结论。
- 调理指南必须标注来源、适用范围和更新时间；角色对话中的个人经验仅可作为备注，不可直接成为医疗规则。

界面计划：

- 经期记录表单增加痛经等级、经量、伴随症状、心情与用药字段。
- 概览提供本周期摘要；详情页提供周期、经期长度与痛经等级趋势。
- 红旗信号使用显著但不制造恐慌的提示，并明确建议联系医疗专业人员。

安全边界：

- 不诊断疾病，不替代医生，不根据单次记录判定“月经不调”。
- 医疗规则与阈值必须在开发阶段引用权威资料并接受人工复核。
- 支持用户修正原始记录；重新分析时保留规则版本，避免结果不可追踪。

验收标准：

- 可完整新增、编辑、删除和查询上述经期字段，且继续使用 Operit 原生 Memory。
- 少于最低周期数时明确显示“数据不足”，不会生成规律性判断。
- 0-3 级痛经记录、趋势统计和红旗规则均有正常、边界及异常输入测试。
- 每条风险提示可追溯到具体记录和规则版本，且包含非诊断声明。

---

# 7. 参考插件

## memory-system

学习：

- Memory API
- 提取
- 检索
- 注入

## multi-diary

学习：

- Persona隔离

## gentle-guardian

学习：

- 状态系统
- 行为规则

## whereabouts

学习：

- 结构化生活数据
- 备份

## dual-life-hub

学习：

- 关系模型

---

# 8. 开发原则

- 不破坏原 Memory System。
- 不删除已有生活助手能力。
- 内部字段保持英文。
- UI展示使用中文。
- 新功能通过扩展层实现。

---

# 9. 首版测试清单

- ToolPkg 导入与启用：`[待实机验证]`
- 六类生活助手数据读取：`[待实机验证]`
- 无角色卡时不写入角色记忆：`[待实机验证]`
- 识别 `metadata.activePrompt.id`：`[待实机验证]`
- 角色 A 的 Memory 创建和查询：`[待实机验证]`
- 角色 A/B 记忆隔离：`[待实机验证]`
- 切回角色 A 后记忆恢复：`[待实机验证]`
- 角色页新增、刷新和删除：`[待实机验证]`
- 默认生活记忆与角色记忆合并召回：`[待实机验证]`
- Prompt 注入不覆盖宿主系统规则：`[待实机验证]`
- 原生 Memory 与本地六类结构化数据合并注入：`[已实现]`，`[待实机验证]`
- Hook 缺少角色元数据时保留最近一次有效角色卡上下文：`[已实现]`，`[待实机验证]`
- 连续静默 20 分钟后在下一次 Hook 结算对话：`[已实现]`，`[待实机验证]`
- 切换对话时立即结算旧对话：`[已实现]`，`[待实机验证]`
- Hook 与侧边栏使用同一份按对话水位线：`[已实现]`，`[待实机验证]`
- 侧边栏自动分析同步写入本地六类数据、原生 Memory 和当前角色 Profile：`[已实现]`，`[待实机验证]`
- 概览和角色页在宿主缓存页面重入时主动刷新：`[已实现]`，`[待实机验证]`
- 移除不存在的 `memories.json` 读取，记忆列表直接查询原生 Memory：`[已实现]`
- 手动分析补齐角色四类提取及原生 Memory 入库：`[已实现]`，`[待实机验证]`
- 本地 events 支持中文时间与行程语义召回，原生 Memory 零命中时仍可注入：`[已实现]`，`[待实机验证]`
- 自动分析优先选择当前角色卡绑定对话，并同步更新触发状态中的角色信息：`[已实现]`，`[待实机验证]`
- 移除行程、出差和具体星期等专项召回词，统一使用文本片段相关度：`[已实现]`，`[待实机验证]`
- 前端改为首次按需加载与明确事件刷新，取消 1.5 秒重绘刷新：`[已实现]`，`[待实机验证]`
- Prompt 注入采用官方附件方案（`PromptInput/before_process` 或 `PromptFinalize/before_send_to_model` 返回附件字符串），设置页/输入菜单提供「记忆注入」与「注入内容随消息保存」开关：`[已实现]`，`[待实机验证]`
- Prompt Hook 无 `setEnv` 时仍保留角色上下文：`[已实现]`
- 分析 JSON 模板直接声明角色四类字段，并返回分类计数：`[已实现]`，`[待实机验证]`
- 知识/搜索区合并全局与当前角色 Profile 记忆：`[已实现]`，`[待实机验证]`
- 角色页空状态自动重试，底部导航内容强制居中：`[已实现]`，`[待实机验证]`
- `after_process` 按 `chatId` 缓存输入，供 UI 相关召回使用：`[已实现]`，`[待实机验证]`
- 记忆注入关闭 `persist` 时仅返回本次请求附件，不写入聊天记录：`[已实现]`，`[待实机验证]`
- `load_memories` 支持 global/persona/all、关键词兜底和向量补充：`[已实现]`，`[待实机验证]`
- 移除异步回调内 Hook 与 render 阶段直接状态更新：`[已实现]`，`[待实机验证]`
- 角色读取串行调度并增加超时、失败退避：`[已实现]`，`[待实机验证]`
- 导航 label 使用居中 Box，不依赖实机无效的 `textAlign`：`[已实现]`，`[待实机验证]`
- 通配查询摘要通过原生 `Memory.getByTitle` 分批补全，不建立第二套记忆索引：`[已实现]`，`[待实机验证]`
- 角色页自动读取迁移到组件 `onLoad`，移除渲染阶段延时状态更新：`[已实现]`，`[待实机验证]`
- Operit 当前 Profile 的向量权重由宿主搜索设置控制，ToolPkg 暂不能覆盖：`[已确认平台限制]`
- v1.4.0 ToolPkg 已生成并通过本地 ZIP 结构与 Manifest 检查；覆盖导入：`[待实机验证]`

## 10. v1.4.0 召回修复计划

状态：`[已尝试修复，待实机验证]`。本节记录 2026-08-04 实机发现的两类漏召回：默认 Operit Memory 文件夹中的用户习惯无法命中，以及仅存在于 `extracted.json` 的历史事件无法命中。

### P0：扩大原生 Memory 查询范围

实施状态：`[已尝试修复，待实机验证]`。

- 保留当前角色专属目录查询：`callerCardId + character_memory/personas/{personaId}`。
- 保留插件生活目录 `character_memory/global` 查询。
- 增加不带 `folderPath` 的默认 Profile 全库查询，用于召回 `user_input` 等由 Operit 或其他入口创建的个人记忆。
- 三路结果按稳定键去重并统一排序；不得把具体角色卡 ID、对话 ID、星期、城市或“出差”等业务词写死在代码中。
- 默认 Profile 全库查询不得携带其他角色的 `callerCardId`，角色私有记忆仍只从当前 Persona 目录读取，避免跨角色混库。
- 当前 Operit API 不能从 ToolPkg 覆盖检索权重；下一版取消 `threshold: 0.5` 的硬门槛，使用宿主默认阈值，并将原生查询结果视为综合检索结果而非纯向量结果。

验收：默认文件夹中 `source=user_input` 的稳定个人事实能被召回；角色 A/B 隔离测试继续通过。

### P0：完善本地结构化召回

实施状态：`[已尝试修复，待实机验证]`。

- `contacts` 序列化必须包含 `attributes`、`context` 和兼容旧数据的 `contexts`。
- 所有六类数据先转换成统一召回条目，再计算相关度；禁止依赖数组顺序或“从后往前取前 6 条”。
- 排序优先级采用通用规则：完整查询命中、完整 token 命中、较长文本片段命中、较短片段命中，最后才以时间作为同分项排序。
- 使用字符预算和最大条数双重限流；初始建议最多 10 条，但最终以 Prompt 总长度测试确定。
- 日程召回依赖标题、描述、结构化日期及通用时间归一化，不针对“下周一”“杭州”“出差”等样例添加专项分支。
- 用户明确表达的稳定习惯、作息和长期个人事实，后续提取优先归入 `info/用户习惯`；已有 `contacts.attributes` 继续兼容，但不得为了召回而永久保存两份互相独立的事实。

验收：相关条目不会被较新的技术记录挤出；联系人属性和位于 events 较早位置的事件均可命中。

### P0：历史结构化数据对账到原生 Memory

实施状态：`[已尝试修复，待实机验证]`。

- 新增可显式触发、可重复执行的 `reconcile_native_memory`，遍历现有 `extracted.json` 六分类并同步到 Operit 原生 Memory。
- 使用规范化标题、分类、内容指纹和明确的 `source/tags` 判断创建或更新，重复执行不得产生重复记忆。
- 对账只补建或更新插件管理的 `character_memory_life_*` 条目，不自动删除用户在 Operit 中创建的记忆。
- 新提取链路与手动结构化写入链路复用同一个序列化和同步函数，避免今后再次出现“本地有、原生 Memory 没有”。
- `extracted.json` 继续作为兼容旧版 UI 的结构化数据，不升级为第二套通用长期记忆数据库；Operit Memory 仍是 Prompt 原生召回的唯一核心。

验收：对账前仅存在本地的历史事件，对账后可从原生 Memory 查询；连续执行两次条目数量不增长。

### P1：Prompt 注入兼容模式

实施状态：`[已实现，待实机验证]`。v1.4.1 已将注入重构为官方 `com.operit.message_insert_bundle` 同款附件方案。

- 废弃 `SystemPromptCompose/after_compose_system_prompt -> {systemPrompt}` 注入路径，不再作为选项存在。
- 新增「记忆注入」总开关与「注入内容随消息保存」开关，JSON 持久化于 `settings.json`，设置页与输入菜单同步。
- `persist = true` → `PromptInput/before_process` 返回附件字符串，随消息保存。
- `persist = false` → `PromptFinalize/before_send_to_model` 返回附件字符串，仅进入本次模型请求、不写入聊天记录。
- 单附件 `type="text/plain"`，XML 转义，ID 前缀 `character_memory_` + filename 前缀 `CMS`，注入前剥离并检测已有附件防重入叠加。
- 召回保持三路合并（默认 Profile + 插件 global + 当前 Persona 目录，`callerCardId` 角色隔离）+ 本地 `extracted.json` 结构化兜底。
- 官方实现、宿主调用链、修正后的风险判断和验收要求见 `docs/PROMPT_INJECTION_COMPATIBILITY.md`。

验收：persist 关闭时模型能读取注入附件，但聊天 UI、导出内容和本地消息数据库只保存原始用户消息；persist 开启时随消息落盘；重复发送/重试不叠加附件；切换角色不泄漏上一角色私有记忆。

---

# 11. v1.5.2 数据备份导入导出计划

状态：`[未开始]`。参考实现为 `docs/reference_plugins/` 中 `com-operit-whereabouts-v0.4.23.toolpkg` 的 `shared/backup_store.js`（Tier 2 Structured Life Layer / Backup Layer）。本计划把该插件的备份设计吸收进 Character Memory System：设置、六类结构化生活数据、角色 Persona 数据与当前角色上下文一起打包导出，并支持校验后的导入恢复。

## 目标与边界

- 目标：一键导出插件全部本地可导出数据（含 `settings.json` 注入设置、`extracted.json` 六分类、`active_persona.json`、`reconcile_v1_4_0.json` 标记、UI 状态），并可从 ZIP 校验后导入。
- 不导出：Operit 原生 Memory 内容（宿主管理，插件不拷贝）；不创建第二套记忆数据库。
- 设计遵循：不删除用户在 Operit 中手工创建的数据；导入以 `merge` 或 `overwrite` 两种模式运行；`overwrite` 前自动生成一次保护性备份。

## 导出文件清单（对齐 whereabouts DATA_FILES）

| 内部文件 | 导出键 | 内容 |
|---|---|---|
| `extracted.json` | `extracted` | 六类结构化生活数据 |
| `settings.json` | `settings` | 记忆注入开关等插件设置 |
| `active_persona.json` | `active_persona` | 最近一次角色卡上下文 |
| `reconcile_v1_4_0.json` | `reconcile` | 历史对账完成标记 |
| `last_ui_state.json` | `ui_state` | 界面恢复状态 |
| `trigger.json` | `trigger` | 自动分析水位线（可选择性排除） |

## 实施步骤（参考 backup_store.js）

1. **新增 `packages/backup.js`**（或在 memory_system.js 内新增函数）：
   - `normalizeAndroidPath`：接受 `/storage/emulated/0/...` 或 `/sdcard/...`，拒绝 `..` 与未知路径。
   - `export_backup(reason?)`：把清单内 JSON 文件收集到 `.stage` 临时目录，写入 `manifest.json`（`format`、`version:1`、`createdAt`、`reason`、每文件 `size` + MD5 摘要），再 `Tools.Files.zip` 到 `/sdcard/Download/Operit/character_memory_system_data/backups/`。
   - `inspect_backup(path)`：解压到临时目录，校验 `manifest.json` 与每个文件的 size/digest，返回 `{valid, version, createdAt, fileCount, ...}`，不落地写入。
   - `restore_backup(path, mode)`：`merge` 逐集合按行合并（以 `updatedAt/createdAt` 较新者优先），`overwrite` 直接替换；`overwrite` 前先执行一次保护性导出。
2. **工具注册**：在 `packages/memory_system.js` 元数据与导出函数中新增 `export_backup` / `inspect_backup` / `restore_backup`。
3. **UI**：设置 tab 增加「数据备份」区块：导出按钮（写 `/sdcard/Download/Operit/character_memory_system_data/backups/`）、选择备份文件进行校验与恢复、恢复模式选择（merge/overwrite）。导入路径由系统文件选择器提供。
4. **安全边界**：
   - ZIP 解压后文件数与单文件大小上限（对齐 whereabouts：文件数 ≤ 20000，解压后总量 ≤ 2GB）。
   - 拒绝清单外的未知文件与路径穿越（`..`、绝对路径）。
   - `merge` 不删除现有行；`overwrite` 前生成保护性备份。
   - `settings.json` 仅在 `overwrite` 时覆盖，不参与 merge，避免把旧开关状态静默合并进来。
5. **测试**：导出→空数据目录→导入的往返验证；损坏/篡改 ZIP 校验失败；`merge` 不丢新数据；`overwrite` 回滚有保护备份。

## 验收标准

- 导出产物可在另一台设备或清除数据后导入恢复，设置开关、六分类数据、角色上下文均还原。
- 导入前可先 `inspect_backup` 预检，损坏包直接拒绝。
- `merge` 导入不清除目标设备已有数据；`overwrite` 导入前自动生成保护性备份。
- 对账标记恢复后不会触发重复对账。
- 全部实现项保持 `[待实机验证]` 直至 Operit 实机测试通过。

---

# 12. 疑难问题记录（暂缓）

## 12.1 快速切换界面导致插件加载失效

状态：`[未解决，暂缓]`。实机观察到快速在插件界面与 App 外部界面间切换时，偶发「所有界面不加载」，角色页尤甚，且会连带影响其它 tab；缓慢切换后恢复。

已尝试：对账异步化、角色加载改为 screen 根 onLoad + setTimeout 共享 state、加载状态权威从持久 `useRef` 改为 `useState`、移除 `screenPersonaLoadingRef`。均有所好转但未根治。

疑似方向：Compose DSL `useRef` 在实例复用时持久保留 current 导致 `ScheduledRef` 残留；多个 setTimeout 快速切换时回调被宿主丢弃；角色页串行 await 链路在切换中断时 state 更新错乱。

详见 `docs/MAINTAINER_HANDOFF.md` 第 7.5 节。优先级低于功能正确性，暂缓处理。
