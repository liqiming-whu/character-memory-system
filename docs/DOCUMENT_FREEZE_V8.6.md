# Character Memory System 文档冻结说明 V8.6

## 冻结目的

从 v8.5 开始，项目进入正式开发准备阶段。

本版本冻结：

- 产品定位
- UI结构
- 架构分层
- 参考插件定位
- Codex开发规则

后续修改必须更新本文件并说明原因。

---

# 唯一设计来源

## 产品规划

`DEVELOPMENT_PLAN.md`

负责：

- 功能规划
- 优先级
- UI设计
- 架构设计

---

## Codex入口

`CODEX_FIRST_INSTRUCTION.md`

负责：

- 第一次分析任务

---

## 开发规则

`CODEX_DEVELOPMENT_INSTRUCTIONS.md`

负责：

- 开发约束

---

# 已冻结设计

## UI导航

固定：

- 概览
- 时间线
- 知识
- 角色
- 搜索
- 设置

删除：

- 待办
- 联系人
- 消息

---

## Memory分类

内部字段使用英文不变，如：

- info
- finance
- menstrual

但UI显示使用中文，如：
- 基础信息
- 财务信息
- 健康周期

---

## 时间线

时间线与事件统一。

不再设计独立事件入口。

---

## 架构层

固定：

1. Memory Layer
2. Persona Layer
3. Relationship Layer
4. Character State Layer
5. Structured Life Layer
6. Reflection Layer（未来）

---

# 文档维护规则

禁止：

- 新增重复设计文档
- 使用旧版本方案覆盖当前方案
- 在末尾追加临时补丁代替正文修改

修改原则：

优先修改 DEVELOPMENT_PLAN.md。

