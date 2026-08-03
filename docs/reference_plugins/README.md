# Reference Plugins 参考说明

本目录用于存放 Character Memory System 开发过程中参考的 Operit ToolPkg。

注意：

这些文件本质是 .toolpkg 文件。

.toolpkg 本质为 ZIP 格式压缩包，可以直接解压查看：

- manifest.json
- main.js / main.ts
- packages/
- ui/

用途：

## 1. com-operit-memory-system-v1.2.0.toolpkg

参考来源：
Operit Memory System

重点学习：

- Memory API 使用方式
- 自动记忆提取流程
- Prompt Finalize Hook
- Memory.create / Memory.query
- 记忆注入流程

不要直接复制其生活助手数据模型。

---

## 2. multi-diary-v2.0.0.toolpkg

参考来源：
Multi Diary 多人格日记系统

重点学习：

- Character Card 解析
- Persona ID设计
- 角色隔离
- Persona Resolver
- 多人格空间管理

不要直接复制文件日记存储模式。

---

## Character Memory System 应融合：

Memory System:
- 记忆提取
- 向量存储
- 检索注入

Multi Diary:
- 角色身份
- Persona隔离
- Character ID

目标：

形成：

Character Card
        |
        v
Persona Layer
        |
        v
Character Memory
        |
        v
Operit Memory API


---

## 3. com-community-dual-life-hub-v1.0.3.toolpkg

参考方向：

- 双人关系模型
- 共同生活空间设计

可借鉴：

- user/character 双主体关系
- 关系数据模型

不采用：

- 财务、日历等生活管理模型作为核心记忆。

---

## 4. com-operit-gentle-guardian-v0.6.2.toolpkg

参考方向：

- 动态人格状态系统

重点学习：

- 状态机设计
- 情绪/关系状态变化
- 状态影响 Prompt 行为

适合 Character Memory System 的：

Character State Layer。

不替代：

- 长期 Memory
- Persona Layer

---

## 5. com-operit-whereabouts-v0.4.23.toolpkg

参考方向：

- 结构化生活状态
- 事件记录
- 数据备份

重点学习：

- state/event 数据组织
- 本地结构化数据
- 导出恢复设计

不替代：

- Operit Memory API

---

## 综合架构参考

Character Memory System 应融合：

Memory System:
- 长期语义记忆
- Memory API
- Prompt注入

Multi Diary:
- Persona ID
- 角色隔离

Gentle Guardian:
- 动态状态
- 情绪/关系变化

Whereabouts:
- 生活状态
- 事件档案
- 备份导出

Dual Life Hub:
- 双主体关系模型


---

# 新增参考插件（v6）

## com-operit-gentle-guardian-v0.6.2.toolpkg

定位：
Character State Layer / Behavior Rule Layer 参考。

学习：

- 动态角色状态
- 状态变化规则
- 状态影响角色行为
- 工作流规则设计

不要直接复制：

- 具体巡检逻辑
- 非通用业务规则

---

## com-operit-whereabouts-v0.4.23.toolpkg

定位：
Structured Life Layer / Backup Layer 参考。

学习：

- 结构化事件记录
- 生活状态管理
- 本地数据组织
- 导出与恢复设计

不要替代：

- Operit Memory API
- 向量记忆系统

---

## com-community-dual-life-hub-v1.0.3.toolpkg

定位：
Relationship Layer 参考。

学习：

- 双主体关系模型
- 用户与角色关系数据

不要直接采用：

- 财务管理
- 日历管理等生活助手功能

---

# 参考插件分层

Tier 1：核心记忆

- memory-system
- multi-diary

Tier 2：角色增强

- gentle-guardian
- whereabouts

Tier 3：关系模型

- dual-life-hub
