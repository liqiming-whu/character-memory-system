# CMS v2.0.0 前端大修与记忆链路修复报告

> 版本：v2.0.0（Frontend Overhaul & Memory Pipeline Release）
> 发布时间：2026-08-08
> 主题：前端体验修复 + 记忆分析链路根治（跨 CMS/CME 双端共 15 个提交）

---

## 一、战役背景

v1.8.x 完成架构级修复（UI 卡死 / 空加载 / 数据通道错配）后，前端功能层面的历史欠账集中暴露：

1. 知识页「记忆」栏目缺少删除按钮，记忆无法在 UI 中管理；
2. 删除按钮位置贴日期徽标、删除必报 `Memory not found`、错误提示误导（把数据错误也提示成"请在配置中启用"）；
3. 分析链路存在「无新对话内容」假阴性——表面是时区问题，实为消息拉取窗口取错。

本次发布围绕「前端可管理性」与「分析链路正确性」两个主轴，一次清完。

---

## 二、修复清单

### A. 记忆管理 UI（CMS）

| # | 问题 | 修复 | 提交 |
|---|------|------|------|
| 1 | 知识页「记忆」栏目无删除按钮 | screen.js 新增 `deleteMemory` + knowledge.js 记忆条挂删除按钮（两段式：删除→确认，与「信息」栏目一致） | `de47925` |
| 2 | 删除按钮贴日期徽标 | 按钮从内层 Row 移到最外层 Row 末尾（最右，与图标/内容同一行） | `4cb7c83` |
| 3 | 点删除报 `Memory not found with title：…` | 前端按 `m.title` 传参（CMS 的 `delete_memory` 把 `memory_id` 当 title 用）；非 `m.id` | `4cb7c83` |
| 4 | 删除时未传 `caller_card_id` | 前端从 `screenPersonaState` 取，无则调 `get_persona_context` 回退——记忆存于角色卡 persona 目录，不传必找不到 | `3674f30` |
| 5 | 幽灵记忆（UI 显示但原生库不存在） | 双保险：删除遇 `Memory not found` → `dropMemoryFromCache` 本地清理；真空加载（查询成功但 0 条）→ 清空幽灵缓存 | `cc7f627` |

### B. 错误提示（CMS/CME 同步）

| # | 问题 | 修复 | 提交 |
|---|------|------|------|
| 6 | `fmtErr` 匹配所有 `not found`，数据错误也被追加"请在配置中启用" | 正则收紧为 `/tools?\s+not\s*found/i` 或 `/no\s+tool/i`，只匹配工具缺失类；数据错误透传原始信息 | CMS `4cb7c83` / CME `6cb625d` |

### C. 分析链路（根治「无新对话内容」）

| # | 问题 | 修复 | 提交 |
|---|------|------|------|
| 7 | 消息时间戳格式在时区变更后可能混存（毫秒/秒/ISO/本地串），水位线比较失效 | 新增 `tsToMs`：数字毫秒（>1e12）原样 / 数字秒 ×1000 / ISO 带时区 `Date.parse` / 本地无时区串补时区后解析；三处水位线过滤与 maxTs 计算统一走 tsToMs | `f1175e9` |
| 8 | **根因**：`Tools.Chat.getMessages` 每次最多返回约 195 条，`order:'asc'` 取最早窗口、`desc` 取最新窗口，两窗口不连续。asc 拉取在消息量越过窗口后永远拿不到新消息 → 水位线过滤后恒为「无新对话内容」 | 改为 `desc + limit:200 + reverse` | `25c8c63` |
| 9 | 手动分析与自动检测拉取策略不统一 | 设计定稿：分析统一只取**时间最近的 200 条**——trigger_analysis（侧边栏自动检测）、analyze_saved_messages（手动分析）与 main.js processCooldown 三处一致，注释写明设计意图 | `b276df7` |

### D. 验证（测试数据与双时区端到端）

| 验证项 | 结果 |
|--------|------|
| 测试记忆写入 → 加载 → 删除 | 3 条测试记忆（挂小玲角色卡）写入/加载/两段式删除全链路通过，原生库 0 残留 |
| 幽灵识别 | 删除不存在的记忆不再报错（本地清理）；真空加载不再显示假条目 |
| Etc/UTC 时区 | 新消息 timestamp 仍为 epoch 毫秒（时区无关）；`desc` 增量检测命中 4 条，水位线推进 |
| Asia/Shanghai 时区 | 命中 2 条，水位线推进 |
| 结论 | **改 UTC 不影响拉取最新，纯属窗口取错**——asc 取旧窗口导致水位线过滤后恒为 0 |

---

## 三、CME 端同步（待切回 CME 时烧录生效）

CME 当前处于禁用状态，以下修复已推送，下次启用 CME 时随烧录一起生效：

| 修复 | 提交 |
|------|------|
| 前端 messages.js 分析工具名修正：`memory_system:analyze_saved_messages`（不存在）→ `memory_engine:analyze_chat`（真实存在），批量/单条分析去掉不支持的 `message_indices`/`message_index` 参数 | `a685981` |
| `import_legacy_backup` 丢子标题：导入时 `p["category"] = cat` 强制覆盖成大类，改为旧数据 category 是子标题时保留（worker 提取 schema 中 info 的 category 即子标题） | `5cc6923` |
| 时间线/知识删除按钮改为单击直删（与 CMS 两段式方案对齐双端交互差异） | `16ad03f` |
| 知识页记忆列表删除按钮 + fmtErr 收紧 + 删除按钮最右 | `1c8794d` / `6cb625d` |
| 幽灵记忆处理（删除容错 + 真空清缓存） | `8bec923` |
| **同款窗口修复**：memory_engine.js:471（手动分析）与 main.js:105（自动分析）两处 `order:'asc'` → `desc + reverse` | `622365c` |

> 排查结论：CME 同样通过前端 `Tools.Chat.getMessages` 取对话（worker 只接收 `chat_text` 字符串），存在与 CMS 修复前完全相同的 asc 旧窗口问题；因无水位线机制，症状更隐蔽——分析"看似正常"但内容停留在旧对话。本次一并根治。

---

## 四、遗留事项

1. **CME 烧录**：下次切回 CME 时烧录最新代码（含 `a685981`、`5cc6923`、`16ad03f`、`1c8794d`、`6cb625d`、`8bec923`、`622365c` 七个提交）。
2. **engine 项目**：自动分析提取稳定性优化未开始（高优先级待办②）。
3. **UI 自动化 / code_runner 权限**：待复测（凌晨调试时曾卡住）。
4. **测试待办**：「测试跳转-1~4」仍在数据中（曾用于概览跳转测试，用户确认后可清理）。

---

## 五、技术要点备忘

- `Tools.Chat.getMessages` 窗口行为：asc/desc 各返回一端约 195 条，两窗口不连续（实测缺口约 1.7 天）；`limit` 传 500 也无效（内部有上限）。**任何"取最新消息"的调用都必须 `desc + limit:200 + reverse`**。
- 消息 `timestamp` 为 epoch 毫秒，与时区无关；tsToMs 仅作格式双保险。
- 原生 Memory 删除的稳定标题带 `[cms:xxx]` 后缀（reconcile 写入）；删除必须带 `caller_card_id` 才能命中 persona 目录。
- 幽灵记忆 = UI 缓存（`CACHED_KNOWLEDGE_MEMORIES`）显示但原生库不存在的条目；删除容错 + 真空清缓存双保险根治。
