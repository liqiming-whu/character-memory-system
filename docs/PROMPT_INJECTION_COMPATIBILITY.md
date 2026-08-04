# Prompt 注入兼容与非持久化方案

当前状态（v1.4.1）：角色记忆系统已按官方 `com.operit.message_insert_bundle` 方案重构。不再使用 `SystemPromptCompose` 注入；改为在设置页/输入菜单提供「记忆注入」总开关与「注入内容随消息保存」开关，根据持久化开关选择在 `PromptInput/before_process`（随消息保存）或 `PromptFinalize/before_send_to_model`（仅进入本次模型请求）返回附件字符串。实际效果尚未重新实机验证。

## 官方参考实现

权威源码：

- `D:\Operit\examples\message_insert\src\main.ts`
- `D:\Operit\examples\message_insert\src\shared.ts`
- `D:\Operit\app\src\main\java\com\ai\assistance\operit\api\chat\EnhancedAIService.kt`
- `D:\Operit\app\src\main\java\com\ai\assistance\operit\plugins\toolpkg\ToolPkgPromptHookBridge.kt`

官方示例版本为 `com.operit.message_insert_bundle` v0.3.0。它提供两种保存策略，但最终都返回修改后的 string：

### 保存注入内容

当 `persistInjectedContent=true` 时，插件在 `PromptInput` 的 `before_process` 阶段执行注入：

```ts
if (stage === "before_process" && loadSettings().persistInjectedContent) {
  return appendExtraInfoToMessage(processedInput, chatId, activePrompt);
}
```

该阶段位于输入处理和消息保存链路之前，因此注入后的附件可以随用户消息一起保存。

### 不保存注入内容

当 `persistInjectedContent=false` 时，`PromptInput` 不修改输入；插件改在 `PromptFinalize` 的 `before_send_to_model` 阶段返回 string：

```ts
if (stage === "before_send_to_model" && !loadSettings().persistInjectedContent) {
  return appendExtraInfoToMessage(processedInput, chatId, activePrompt);
}
```

这一阶段已经晚于历史准备。Operit 将 string 解析为 `PromptHookMutation(processedInput = decoded)`，随后仅通过 `applyFinalizedCurrentUserTurn(...)` 把修改后的 `finalProcessedInput` 放入本次模型请求的 `requestHistory`。聊天记录仍保留原始用户消息。

因此，决定是否落盘的关键是 **Hook 阶段**，不是 string 本身：

|模式|Hook|阶段|返回值|聊天记录|
|-|-|-|-|-|
|保存注入|PromptInput|before_process|string|保存修改后的内容|
|仅本次请求|PromptFinalize|before_send_to_model|string|保存原始消息，注入只进入本次模型请求|

## 附件格式与去重

官方插件不是直接拼一段无标记文本，而是生成显式附件：

```xml
<attachment id="message_insert_extra_bundle_..."
            filename="Time:..."
            type="text/plain"
            size="...">经过 XML 转义的内容</attachment>
```

相关实现特点：

- 对 `& < > " '` 做 XML 转义。
- 使用稳定的附件 ID 前缀和 filename 前缀识别已有注入。
- `containsExtraInfoAttachment()` 在生成前检查标记，避免同一输入重复附加。
- 多类额外信息合并到一个附件中，减少消息结构碎片。
- 记忆检索先剥离已有 attachment、workspace attachment、reply 和代理发送者标记，再生成检索词。
- 记忆查询可以按会话复用 snapshot ID，避免同一会话连续命中同一条记忆。

附件格式用于结构化、转义和去重；它不是“不写入聊天记录”的原因。非持久化来自 `PromptFinalize/before_send_to_model` 的调用时机。

## 角色记忆系统 v1.4.1 注入方案

v1.4.1 已按官方 `com.operit.message_insert_bundle` 的方式重构，不再保留旧的 `SystemPromptCompose -> {systemPrompt}` 路径：

- 设置项（JSON 持久化于 `settings.json`，与数据一起可导出）：
  1. `injection.enabled`：记忆注入总开关（设置页与输入菜单同一切换，状态同步）。
  2. `injection.persist`：注入内容随消息保存。
- 运行时 Hook：
  - `persist = true` → `PromptInput/before_process` 返回「原输入 + 单个 text/plain attachment」字符串，随处理后的消息一起保存。
  - `persist = false` → `PromptFinalize/before_send_to_model` 返回同样的字符串，仅进入本次模型请求，不写入聊天记录。
- 注入附件约束：
  - 单一 `type="text/plain"` 附件，对标题/正文做 XML 转义。
  - 使用项目独有 ID 前缀 `character_memory_` 与 filename 前缀 `CMS`；注入前剥离并检测已有附件，防止 Hook 重入或用户重试时重复拼接。
  - 三路查询复用会话 id 前 6 位作为 `snapshotId`（与官方 `message_insert_bundle` 一致），由宿主快照排除本会话已注入过的记忆。
  - 召回范围保持三路合并：默认 Profile 全库 + 插件 `character_memory/global` + 当前 Persona 专属目录（`callerCardId` 角色隔离），并保留本地 `extracted.json` 结构化兜底召回。
  - 使用 `processedInput` 直接召回；本地 `last_input.json` 输入缓存已废弃（v1.4.1 不再依赖）。
  - 限制记忆条数与总字符数。

## 修正此前判断

此前文档把“PromptFinalize 返回 string”概括为“会污染聊天历史”。根据官方示例和宿主源码，这一判断不准确：

- 在 `PromptInput/before_process` 返回 string，可能随处理后的消息保存。
- 在 `PromptFinalize/before_send_to_model` 返回 string，只修改本次模型请求，不写回聊天记录。

实机曾观察到 string 区块出现在模型可见输入中，这只能证明模型收到了修改后的请求，不能证明数据库保存了该区块。后续测试应分别检查模型行为、聊天 UI、导出内容和本地消息数据库。

## 非持久化 string 方案仍有的缺点

1. **语义层级较低**：附件仍位于当前 user turn，不具备 system prompt 的指令优先级。
2. **单轮 Token 成本**：不会在历史中累计，但每次相关请求仍会增加输入 Token。
3. **模型可见性**：模型会看到附件内容；不得注入无关敏感信息。
4. **Hook 顺序影响**：多个 PromptFinalize 插件可能依次修改同一个 `processedInput`，必须做好标记和去重。
5. **版本兼容风险**：本结论来自当前 `D:\Operit` 源码和官方示例；正式版较旧时仍需实机确认阶段行为。
6. **附件解析差异**：不同模型或 Provider 对 XML 风格附件的理解可能不同，需要覆盖主要 Provider 测试。

## 验收要求

- 模型能够读取注入的相关记忆附件。
- persist 关闭时：聊天 UI、导出内容和本地消息数据库只保存原始用户消息。
- persist 开启时：注入内容随消息一起落盘保存。
- 连续发送、重试和编辑消息不会重复叠加同一附件。
- 切换角色后不会召回上一角色的 Persona 私有记忆。
- 与官方额外信息注入插件同时开启时，两种附件能够共存且互不误删。
- 设置页与输入菜单开关状态同步。
- 结果记录 Operit 版本和 Provider。
