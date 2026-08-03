# AGENTS.md

项目：Character Memory System

规则：

1. 修改前阅读：
- DEVELOPMENT_PLAN.md
- CODEX_DEVELOPMENT_INSTRUCTIONS.md
- docs/reference/

2. 不要：
- 创建独立记忆数据库
- 替换 Operit Memory API
- 猜测 ToolPkg API

3. Memory：
使用 Operit 原生 Memory。

4. UI：
保持与核心逻辑分离。

5. 修改后测试：
- 插件加载
- UI
- Memory创建
- Memory查询
- Prompt注入
- ToolPkg导入


## 参考插件

参考插件位于：
docs/reference_plugins/

.toolpkg 文件可以直接解压查看。

参考代码只能用于理解设计，不直接复制。
