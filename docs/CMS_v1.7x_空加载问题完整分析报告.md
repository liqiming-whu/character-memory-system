# CMS v1.7.x 空加载问题完整分析报告

## 问题定义

空加载指：

> UI正常显示，但数据条目为空。

不是白屏，而是：

    UI结构存在
    ↓
    props数据为空
    ↓
    列表无item

## v1.7.0

发现：

-   mount正常
-   Screen重复初始化
-   onLoad次数与sched对应

说明问题属于生命周期和数据初始化。

## v1.7.1

探针确认：

-   cache正常命中
-   模块级变量每次挂载重置
-   getEnv首帧不可可靠读取

原因：

    getEnv
    ↓
    runtime.callRuntime
    ↓
    首次render未注入
    ↓
    返回undefined

而setEnv走native，可以提前写入。

## v1.7.2

修复：

onLoad阶段缓存恢复。

流程：

    onLoad
    ↓
    读取缓存
    ↓
    填充state
    ↓
    ready=true

## v1.7.3

发现：

调试探针params变量错误。

影响：

    ReferenceError
    ↓
    load失败
    ↓
    空列表

结论：

debug代码也必须安全。

## v1.7.4

定位知识页空条目：

    loadKnowledgeMemories
    ↓
    get_persona_context空壳
    ↓
    personaId为空
    ↓
    memory查询失败

修复：

复用screenPersona。

## v1.7.5

修复"不恢复"（空界面一直没数据）：

-   知识页缓存兜底（memoryState 初始值读缓存）
-   tab 重入触发重载（重置模块级 boot 锁）

## v1.7.6

统一memory查询范围：

角色页与知识页使用一致的数据源（scope='all'）。

## v1.7.7

指数退避重试 + 信息区加载态：

-   __backoffMs：300ms × 2^(n-1)，上限 10s
-   5 处重试全部指数退避，上限提升到 10 次
-   信息计数加载中显示"--"，空态显示"正在读取生活数据..."

## v1.7.8

工具侧根治：

-   readTextFile 内部重试 3 次（300ms 间隔）
-   readCategory 失败不缓存空（失败不再污染缓存，下次调用重读自愈）

## v1.7.9

缓存全覆盖：

-   onLoad 补缓存扩展至生活数据（CACHED_ALL_DATA）
-   信息计数加载中显示"--"（不闪误导性 0）

## 总结

空加载不是单一问题，而是：

1.  首帧缓存时序
2.  persona初始化链
3.  数据入口不统一
4.  工具响应可靠性

最终架构：

    缓存
    ↓
    数据服务
    ↓
    state
    ↓
    render纯函数
    ↓
    UI
