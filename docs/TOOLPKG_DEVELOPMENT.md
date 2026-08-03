# ToolPkg 开发说明

本项目为 Operit ToolPkg 插件。

开发原则：
- 优先参考 docs/reference 官方文档。
- 修改前确认 ToolPkg API。
- 保持 manifest 兼容。
- 使用 Operit Memory API，不创建第二套数据库。

流程：

源码
↓
修改
↓
构建 ToolPkg
↓
生成 .toolpkg
↓
Operit 导入测试

重点：
先确认官方 ToolPkg 构建流程，再进行功能开发。
