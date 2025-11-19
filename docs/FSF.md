# FSF (Flexible Scene Feed) 灵活场景推送系统 - 功能说明书

## 1. 系统概述
FSF 是一个基于 "场景(Scene)" + "订阅(Subscription)" 模式的灵活消息推送系统。它允许管理员配置不同的数据源（场景），并定义灵活的推送规则（订阅），将数据推送到飞书、钉钉、企业微信或自定义 Webhook。

## 2. 核心业务逻辑

### 2.1 概念模型
*   **场景 (Scene)**: 数据源的抽象。定义了"数据从哪里来" (Handler) 以及"缓存多久" (TTL)。
    *   *例子*: 微博热搜、GitHub Trending、系统告警。
*   **订阅 (Subscription)**: 推送规则的配置。定义了"数据推给谁" (Target)、"什么格式" (Template) 以及"何时推送" (Trigger)。
    *   *例子*: "每天早上9点把微博热搜推送到飞书群"。

### 2.2 数据流转
1.  **触发**: 定时任务(Cron) 或 手动触发(Manual) 启动流程。
2.  **获取数据**: 系统根据订阅关联的场景，调用对应的数据处理器(Handler)。
    *   *缓存机制*: 优先读取 Redis 缓存，未命中则调用 Handler 并写入缓存。
3.  **适配与渲染**: 获取到的数据根据订阅配置的模板(Template)进行渲染。
4.  **推送**: 将渲染后的数据发送到目标地址(Target URL)。
    *   *重试机制*: 推送失败会自动重试 (默认3次)。

## 3. 功能特性

### 3.1 触发方式
1.  **Cron 定时触发**: 支持标准的 Cron 表达式 (如 `0 9 * * *`)，由系统内置调度器自动执行。
    *   *特性*: 订阅创建/更新时自动注册任务，支持秒级精度。
    *   *校验*: 在配置阶段即严格校验 Cron 表达式的合法性。
2.  **Manual 手动触发**: 管理员通过 API 立即触发一次推送。
    *   *特性*: **异步执行**，接口立即返回，后台处理推送任务，避免阻塞。
3.  **Passive 被动拉取**: 第三方系统携带 Token 主动调用 API 获取场景数据。

### 3.2 推送目标 (Target)
支持以下类型，且具备 **SSRF (服务端请求伪造) 防护**，禁止配置内网 IP (如 127.0.0.1, 192.168.x.x) 作为目标地址。
*   **Feishu (飞书)**: 适配飞书群机器人 Webhook。
*   **DingTalk (钉钉)**: 适配钉钉群机器人 Webhook。
*   **WeChatWork (企业微信)**: 适配企业微信群机器人 Webhook。
*   **HTTP**: 通用 Webhook，支持自定义 Header 和 Auth (Bearer/Basic)。

### 3.3 安全机制
*   **权限控制**: 场景和订阅管理仅限 **Admin** 角色。
*   **网络安全**: 目标 URL 强制校验，拒绝私有 IP 地址。
*   **事务一致性**: 订阅配置与定时任务状态保持强一致，数据库操作失败或任务注册失败会自动回滚。
*   **Token 安全**: 登录及刷新 Token 采用轮换机制 (Rotation)，最大限度防止令牌泄露。

## 4. 数据源开发指南
开发者只需在 `src/services/notification/sources/` 下添加新的处理函数，并在 `dataSources.ts` 中注册即可。系统会自动识别并列出可用的 Handler。

### 示例代码
```typescript
// 1. 定义获取数据的函数
export async function fetchMyData() {
  return { title: "Hello", value: 123 };
}

// 2. 在 dataSources.ts 中注册
registerDataSource('my-source', fetchMyData);
```
