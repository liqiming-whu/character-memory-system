# Character Memory System 开发计划

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

目标：

确认：

- ToolPkg结构
- Memory API
- 数据读取方式
- UI框架

不改变核心数据。

---

## P1：UI改造

完成：

- 导航调整
- 页面布局
- 中文显示
- 数据分类展示

---

## P2：记忆模型升级

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

实现：

- 角色卡绑定
- 角色隔离
- 角色记忆查询
- 关系状态

---

## P4：高级能力

未来：

- Reflection Layer
- 自我分析
- 自适应优化
- 行为改进

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
