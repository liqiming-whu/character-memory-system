# CMS v1.8.x 数据通道问题与当前状态报告

## v1.8.0问题

现象：

    loadMem success=true
    但 memories缺失

缓存正常：

    memory=31000B

说明数据保存正常。

## v1.8.1关键实验

增加工具出口和前端入口日志。

工具出口：

    lifeData正常
    loadMem count=87正常
    persona正常

前端入口：

出现：

    loadData收到persona响应
    loadMem收到lifeData响应

结论：

不是截断。

不是工具返回错误。

而是：

> Operit bridge并发tool响应错配。

字节对账实锤：

-   工具出口 bytes=8918（lifeData）/ 31039（loadMem）/ 207（persona）全部正确
-   前端收到 9250B（= lifeData完整响应）的 loadMem 调用、207B（= persona响应）的 loadData 调用
-   31KB 的 loadMem 响应完整到达（31065=31039+26 字段差），证明无大小截断

## v1.8.2

主要加载链串行：

    loadPersona
    await
    loadData
    await
    loadMem

结果：

-   loadMem 89/90成功
-   loadPersona 44/44成功

证明：

串行化有效。

## 剩余问题

发现bytes=134异常响应。

定位：

来自未进入队列的工具：

-   trigger_analysis（挂载瞬间自动触发的 IIFE）
-   get_analyzed_chats
-   chat_exporter

这些调用与主加载链并发，污染响应。

## v1.8.3

修复：

所有 ctx.callTool() 统一进入全局串行队列（__serialCtx，挂 ctx 跨模块共享）：

    UI
    ↓
    state
    ↓
    service
    ↓
    serial tool queue
    ↓
    Operit bridge
    ↓
    tools

验证结果（三轮全绿）：

-   loadData 14/14 全部 info=16（零错配）
-   loadMem 107/108 count=87（唯一失败立即重试成功）
-   loadPersona 52/52 全部 HAS（零 EMPTY）
-   异常 0

## v1.8.4

探针关闭（战役收官）：

-   工具侧删除全部 dbgTool 探针（OUT bytes 日志）
-   前端 dbgUi 空转（不再写 dbg_ui.log）
-   保留 __serialCtx 串行队列与响应守卫（防御常驻）

## 开发规则（铁律）

1.  render禁止副作用
2.  模块变量不保存持久状态
3.  debug不能影响业务
4.  tool调用必须统一串行（禁止并发依赖返回顺序）

## 当前状态

CMS已经从脚本式插件升级为分层数据驱动架构：

    UI
    ↓
    state
    ↓
    缓存层（setEnv 首帧兜底）
    ↓
    串行工具队列（bridge 错配免疫）
    ↓
    Operit tools / Memory
