# FSF 系统 API 接口文档

## 1. 基础信息
- **Base URL**: `http://localhost:4778/api`
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`
- **分页说明**: 所有列表接口均支持分页，默认 `page=1`, `limit=20`。

## 2. 认证模块 (Auth)

### 2.1 登录
**POST** `/auth/login`

**请求体**:
```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "uuid...",
    "expiresIn": 900
  }
}
```

### 2.2 刷新 Token (Token Rotation)
**POST** `/auth/refresh`

**说明**: 采用 **Token 轮换机制**。旧的 Refresh Token 使用一次后即失效，接口会返回全新的一对 Token。前端需同时更新本地保存的 Access Token 和 Refresh Token。

**请求体**:
```json
{
  "refreshToken": "old-refresh-token"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "令牌刷新成功",
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 900
  }
}
```

## 3. 场景管理 (Scene) - Admin Only

### 3.1 获取场景列表
**GET** `/fsf/scenes`

**Query 参数**:
- `page`: 页码 (默认 1)
- `limit`: 每页数量 (默认 20)

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "weibo",
        "description": "微博热搜",
        "handler": "weibo",
        "cacheTtl": 300,
        "status": 1,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20,
    "registeredHandlers": ["weibo", "news"]
  }
}
```

### 3.2 创建场景
**POST** `/fsf/scenes`

**请求体**:
```json
{
  "name": "custom-scene",
  "description": "描述",
  "handler": "weibo", // 必须在 registeredHandlers 中存在
  "cacheTtl": 300,
  "status": 1
}
```

### 3.3 更新场景
**PUT** `/fsf/scenes/:id`

**请求体**: (字段可选)
```json
{
  "description": "新描述",
  "cacheTtl": 600
}
```

### 3.4 删除场景
**DELETE** `/fsf/scenes/:id`

## 4. 订阅管理 (Subscription) - Admin Only

### 4.1 获取订阅列表
**GET** `/fsf/subscriptions`

**Query 参数**:
- `page`: 页码 (默认 1)
- `limit`: 每页数量 (默认 20)
- `sceneName`: (可选) 按场景名称过滤

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 1,
        "sceneName": "weibo",
        "name": "飞书推送",
        "targetType": "feishu",
        "targetUrl": "https://open.feishu.cn/...",
        "triggerType": "cron",
        "triggerConfig": "{\"cron\":\"0 9 * * *\"}",
        "status": 1,
        ...
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

### 4.2 创建订阅
**POST** `/fsf/subscriptions`

**安全限制**: `targetUrl` 禁止使用内网 IP (如 127.0.0.1, 192.168.x.x)。

**请求体**:
```json
{
  "sceneName": "weibo",
  "name": "订阅名称",
  "targetType": "feishu", // http, feishu, dingtalk, wechat_work
  "targetUrl": "https://external-api.com/webhook",
  "triggerType": "cron", // cron, manual, passive
  "triggerConfig": "{\"cron\":\"0 9 * * *\"}", // cron 类型必填，且表达式必须合法
  "template": "{\"content\":\"{{content}}\"}",
  "status": 1
}
```

### 4.3 更新订阅
**PUT** `/fsf/subscriptions/:id`

**说明**: 更新 Cron 配置会自动重启定时任务。

### 4.4 删除订阅
**DELETE** `/fsf/subscriptions/:id`

### 4.5 手动触发订阅
**POST** `/fsf/subscriptions/:id/trigger`

**说明**: **异步执行**。接口立即返回成功，后台执行推送。

**响应**:
```json
{
  "code": 200,
  "message": "推送任务已下发",
  "data": null
}
```

## 5. 被动拉取 (Passive) - Authenticated User

### 5.1 获取场景数据
**GET** `/fsf/msg/:sceneName`

**说明**: 任何登录用户均可调用。优先返回 Redis 缓存数据。

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "scene": "weibo",
    "timestamp": 1763026182358,
    "content": { ... } // 数据源返回的原始数据
  }
}
```

## 6. 错误码参考

| HTTP Code | 说明 |
|-----------|------|
| 200 | 成功 |
| 400 | 参数错误 (如 Cron 表达式无效、IP 受限) |
| 401 | 未认证或 Token 失效 |
| 403 | 权限不足 (非 Admin) |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
