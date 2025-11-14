# FSF (Flexible Scene Feed) 消息推送系统

FSF 是一个灵活的场景化消息推送系统，支持多种数据源、多种推送目标和多种触发方式。

## 核心概念

### 1. 场景 (Scene)
场景是数据的语义化标识，每个场景对应一个数据处理函数。例如：
- `weibo`: 微博热搜榜单
- `news`: 新闻头条

### 2. 订阅 (Subscription)
订阅定义了如何将场景数据推送到目标系统，包括：
- 推送目标（飞书/钉钉/企业微信/HTTP Webhook）
- 触发方式（定时/手动/被动）
- 数据模板
- 重试策略

### 3. 触发类型

#### Cron (定时触发)
使用 cron 表达式定时推送数据
```json
{
  "triggerType": "cron",
  "triggerConfig": {
    "cron": "*/30 * * * *",  // 每30分钟
    "timezone": "Asia/Shanghai"
  }
}
```

#### Manual (手动触发)
通过 API 手动触发推送
```bash
POST /api/fsf/subscriptions/:id/trigger
```

#### Passive (被动拉取)
第三方系统主动拉取数据
```bash
GET /api/fsf/msg/:sceneName
Authorization: Bearer YOUR_TOKEN
```

## API 接口

### 场景管理

#### 获取场景列表
```bash
GET /api/fsf/scenes
Authorization: Bearer ADMIN_TOKEN
```

#### 创建场景
```bash
POST /api/fsf/scenes
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "name": "custom-scene",
  "description": "自定义场景",
  "handler": "customHandler",
  "cacheTtl": 300,
  "status": 1
}
```

#### 更新场景
```bash
PUT /api/fsf/scenes/:id
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "description": "更新描述",
  "cacheTtl": 600
}
```

#### 删除场景
```bash
DELETE /api/fsf/scenes/:id
Authorization: Bearer ADMIN_TOKEN
```

### 订阅管理

#### 获取订阅列表
```bash
GET /api/fsf/subscriptions?sceneName=weibo
Authorization: Bearer ADMIN_TOKEN
```

#### 创建订阅 - 飞书定时推送
```bash
POST /api/fsf/subscriptions
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "sceneName": "weibo",
  "name": "飞书微博推送",
  "targetType": "feishu",
  "targetUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN",
  "triggerType": "cron",
  "triggerConfig": {
    "cron": "0 9,12,18 * * *",  // 每天9点、12点、18点
    "timezone": "Asia/Shanghai"
  },
  "template": {
    "title": "微博热搜",
    "content": "{{content}}"
  },
  "status": 1,
  "retryCount": 3,
  "timeout": 10000
}
```

#### 创建订阅 - 钉钉手动触发
```bash
POST /api/fsf/subscriptions
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "sceneName": "news",
  "name": "钉钉新闻推送",
  "targetType": "dingtalk",
  "targetUrl": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
  "triggerType": "manual",
  "template": {
    "title": "新闻头条",
    "content": "{{content}}"
  },
  "status": 1,
  "retryCount": 3,
  "timeout": 10000
}
```

#### 创建订阅 - HTTP Webhook
```bash
POST /api/fsf/subscriptions
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "sceneName": "weibo",
  "name": "第三方系统推送",
  "targetType": "http",
  "targetUrl": "https://your-api.com/webhook",
  "targetAuth": {
    "type": "bearer",
    "token": "YOUR_API_TOKEN"
  },
  "triggerType": "manual",
  "status": 1,
  "retryCount": 3,
  "timeout": 15000
}
```

#### 更新订阅
```bash
PUT /api/fsf/subscriptions/:id
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "status": 0  // 禁用订阅
}
```

#### 删除订阅
```bash
DELETE /api/fsf/subscriptions/:id
Authorization: Bearer ADMIN_TOKEN
```

#### 手动触发订阅
```bash
POST /api/fsf/subscriptions/:id/trigger
Authorization: Bearer ADMIN_TOKEN
```

### 被动拉取数据

```bash
GET /api/fsf/msg/weibo
Authorization: Bearer YOUR_TOKEN

# 响应示例
{
  "success": true,
  "message": "获取成功",
  "data": {
    "scene": "weibo",
    "timestamp": "2024-01-13T09:30:00.000Z",
    "content": {
      "items": [...]
    }
  }
}
```

## 数据源开发

在 `src/services/notification/sources/` 目录下创建数据源：

```typescript
// src/services/notification/sources/custom.ts
export async function fetchCustomData() {
  // 从外部 API 获取数据
  const response = await fetch('https://api.example.com/data')
  const data = await response.json()
  
  // 转换为标准格式
  return {
    items: data.map(item => ({
      title: item.title,
      url: item.link,
      timestamp: item.createdAt
    }))
  }
}
```

在 `src/services/notification/dataSources.ts` 中注册：

```typescript
export async function initDataSources() {
  // ...现有代码
  
  const { fetchCustomData } = await import('./sources/custom')
  registerDataSource('custom', fetchCustomData)
}
```

创建对应场景：

```bash
POST /api/fsf/scenes
{
  "name": "custom-data",
  "description": "自定义数据源",
  "handler": "custom",
  "cacheTtl": 300,
  "status": 1
}
```

## 推送目标类型

### 1. 飞书 (feishu)
```json
{
  "targetType": "feishu",
  "targetUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN",
  "template": {
    "title": "标题",
    "content": "{{content}}"  // 支持模板变量
  }
}
```

### 2. 钉钉 (dingtalk)
```json
{
  "targetType": "dingtalk",
  "targetUrl": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
  "template": {
    "title": "标题",
    "content": "{{content}}"
  }
}
```

### 3. 企业微信 (wechatwork)
```json
{
  "targetType": "wechatwork",
  "targetUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY",
  "template": {
    "content": "{{content}}"
  }
}
```

### 4. HTTP Webhook (http)
```json
{
  "targetType": "http",
  "targetUrl": "https://your-api.com/webhook",
  "targetAuth": {
    "type": "bearer",  // 或 "basic"
    "token": "YOUR_TOKEN"
    // 如果是 basic: {"username": "xxx", "password": "xxx"}
  }
}
```

## 模板系统

在 `template` 字段中使用 `{{变量名}}` 引用数据源返回的字段：

```json
{
  "template": {
    "title": "微博热搜 TOP 10",
    "content": "{{content}}"
  }
}
```

对于 HTTP 类型，`template` 为 `null` 时直接发送原始数据。

## Cron 表达式示例

```
*/30 * * * *    # 每30分钟
0 * * * *       # 每小时整点
0 9,12,18 * * * # 每天9点、12点、18点
0 9 * * 1-5     # 周一到周五的9点
0 0 * * 0       # 每周日0点
```

## 初始化

运行初始化脚本创建示例场景和订阅：

```bash
bun run src/scripts/init-fsf.ts
```

这将创建：
- 场景: `weibo`, `news`
- 示例订阅（默认禁用，需配置 webhook URL 后启用）

## 日志

FSF 系统日志输出到：
- 控制台: 结构化 JSON 格式
- 文件: `logs/app.log` (自动按日期滚动)

## 注意事项

1. **权限要求**: 所有管理接口需要管理员权限
2. **Webhook 安全**: 妥善保管 webhook URL 和认证信息
3. **缓存策略**: 合理设置 `cacheTtl` 避免频繁请求外部 API
4. **重试机制**: `retryCount` 建议设置为 3，避免无限重试
5. **超时设置**: `timeout` 建议 10-15 秒，避免长时间阻塞
6. **定时任务**: 启用 cron 订阅会立即注册定时任务
7. **被动拉取**: 第三方系统需携带有效 JWT Token

## 故障排查

### 订阅未触发
1. 检查订阅 `status` 是否为 1
2. 检查场景 `status` 是否为 1
3. 检查 cron 表达式是否正确
4. 查看日志输出

### 推送失败
1. 检查 webhook URL 是否正确
2. 检查网络连接
3. 检查认证信息
4. 查看重试日志

### 数据获取失败
1. 检查数据源处理函数是否正常
2. 检查外部 API 是否可用
3. 检查缓存是否过期
4. 查看数据源日志
