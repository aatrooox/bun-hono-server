# FSF 系统 API 接口文档

## 基础信息

- **Base URL**: `http://localhost:4778/api`
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`

## 认证接口

### 登录获取 Token

**POST** `/auth/login`

**请求体**:
```json
{
  "email": "admin@example.com",
  "password": "admin123456"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 5,
      "email": "admin@example.com",
      "name": "系统管理员",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "8f6daa0e-3aef-4be8-8d35-6539cdac1ca...",
    "expiresIn": 900
  },
  "timestamp": 1763025778250
}
```

## FSF 场景管理接口

> 所有场景管理接口需要**管理员权限**

### 1. 获取场景列表

**GET** `/fsf/scenes`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "scenes": [
      {
        "id": 1,
        "name": "weibo",
        "description": "微博热搜榜单",
        "handler": "weibo",
        "cacheTtl": 300,
        "status": 1,
        "createdAt": "2025-11-13 09:16:31",
        "updatedAt": "2025-11-13 09:16:31"
      }
    ],
    "registeredHandlers": ["weibo", "news"]
  }
}
```

**字段说明**:
- `name`: 场景名称（唯一标识）
- `description`: 场景描述
- `handler`: 数据源处理器名称
- `cacheTtl`: 缓存时间（秒）
- `status`: 状态 (0-禁用, 1-启用)
- `registeredHandlers`: 已注册的数据源处理器列表

### 2. 获取场景详情

**GET** `/fsf/scenes/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 1,
    "name": "weibo",
    "description": "微博热搜榜单",
    "handler": "weibo",
    "cacheTtl": 300,
    "status": 1,
    "createdAt": "2025-11-13 09:16:31",
    "updatedAt": "2025-11-13 09:16:31"
  }
}
```

### 3. 创建场景

**POST** `/fsf/scenes`

**请求头**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "custom-scene",
  "description": "自定义场景",
  "handler": "customHandler",
  "cacheTtl": 300,
  "status": 1
}
```

**字段验证**:
- `name`: 必填，字符串，3-50字符，仅支持字母、数字、下划线、中划线
- `description`: 必填，字符串，最多200字符
- `handler`: 必填，字符串，必须是已注册的处理器名称
- `cacheTtl`: 可选，整数，0-3600秒，默认300
- `status`: 可选，整数，0或1，默认1

**响应**:
```json
{
  "code": 200,
  "message": "场景创建成功",
  "data": {
    "id": 3,
    "name": "custom-scene",
    "description": "自定义场景",
    "handler": "customHandler",
    "cacheTtl": 300,
    "status": 1,
    "createdAt": "2025-11-13 10:00:00",
    "updatedAt": "2025-11-13 10:00:00"
  }
}
```

**错误响应**:
```json
{
  "code": 400,
  "message": "场景名称 \"custom-scene\" 已存在",
  "data": null
}
```

### 4. 更新场景

**PUT** `/fsf/scenes/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**请求体** (所有字段可选):
```json
{
  "description": "更新后的描述",
  "cacheTtl": 600,
  "status": 0
}
```

**响应**:
```json
{
  "code": 200,
  "message": "场景更新成功",
  "data": {
    "id": 1,
    "name": "weibo",
    "description": "更新后的描述",
    "handler": "weibo",
    "cacheTtl": 600,
    "status": 0,
    "createdAt": "2025-11-13 09:16:31",
    "updatedAt": "2025-11-13 10:05:00"
  }
}
```

### 5. 删除场景

**DELETE** `/fsf/scenes/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "message": "场景删除成功",
  "data": null
}
```

## FSF 订阅管理接口

> 所有订阅管理接口需要**管理员权限**

### 1. 获取订阅列表

**GET** `/fsf/subscriptions`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `sceneName` (可选): 按场景名称过滤

**示例**: `/fsf/subscriptions?sceneName=weibo`

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "sceneName": "weibo",
      "name": "feishu-weibo-cron",
      "targetType": "feishu",
      "targetUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN",
      "targetAuth": null,
      "triggerType": "cron",
      "triggerConfig": "{\"cron\":\"*/30 * * * *\",\"timezone\":\"Asia/Shanghai\"}",
      "template": "{\"title\":\"微博热搜\",\"content\":\"{{content}}\"}",
      "status": 0,
      "retryCount": 3,
      "timeout": 10000,
      "createdBy": 5,
      "lastTriggeredAt": null,
      "nextTriggerAt": null,
      "createdAt": "2025-11-13 09:16:31",
      "updatedAt": "2025-11-13 09:16:31"
    }
  ]
}
```

**字段说明**:
- `targetType`: 推送目标类型 (http/feishu/dingtalk/wechatwork)
- `targetUrl`: 目标 Webhook URL
- `targetAuth`: 认证信息 (JSON字符串)
- `triggerType`: 触发类型 (cron/manual/passive)
- `triggerConfig`: 触发配置 (JSON字符串)
- `template`: 消息模板 (JSON字符串)
- `timeout`: 超时时间（秒，最大300）
- `lastTriggeredAt`: 最后触发时间
- `nextTriggerAt`: 下次触发时间（仅cron类型）

### 2. 获取订阅详情

**GET** `/fsf/subscriptions/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**: 同获取订阅列表中的单个订阅对象

### 3. 创建订阅

**POST** `/fsf/subscriptions`

**请求头**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**请求体示例 - 飞书定时推送**:
```json
{
  "sceneName": "weibo",
  "name": "飞书微博推送",
  "targetType": "feishu",
  "targetUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN",
  "triggerType": "cron",
  "triggerConfig": "{\"cron\":\"0 9,12,18 * * *\",\"timezone\":\"Asia/Shanghai\"}",
  "template": "{\"title\":\"微博热搜\",\"content\":\"{{content}}\"}",
  "status": 1,
  "retryCount": 3,
  "timeout": 30
}
```

**请求体示例 - 钉钉手动触发**:
```json
{
  "sceneName": "news",
  "name": "钉钉新闻推送",
  "targetType": "dingtalk",
  "targetUrl": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
  "triggerType": "manual",
  "template": "{\"title\":\"新闻头条\",\"content\":\"{{content}}\"}",
  "status": 1,
  "retryCount": 3,
  "timeout": 30
}
```

**请求体示例 - HTTP Webhook**:
```json
{
  "sceneName": "weibo",
  "name": "第三方系统推送",
  "targetType": "http",
  "targetUrl": "https://your-api.com/webhook",
  "targetAuth": "{\"type\":\"bearer\",\"token\":\"YOUR_API_TOKEN\"}",
  "triggerType": "manual",
  "status": 1,
  "retryCount": 3,
  "timeout": 60
}
```

**请求体示例 - 被动拉取**:
```json
{
  "sceneName": "news",
  "name": "被动拉取订阅",
  "targetType": "http",
  "targetUrl": "https://external-system.com/api",
  "triggerType": "passive",
  "status": 1,
  "retryCount": 0,
  "timeout": 10
}
```

**字段验证**:
- `sceneName`: 必填，字符串，必须是已存在的场景名称
- `name`: 必填，字符串，3-100字符
- `targetType`: 必填，枚举 (http/feishu/dingtalk/wechatwork)
- `targetUrl`: 必填，字符串，有效URL
- `targetAuth`: 可选，JSON字符串
  - Bearer: `{"type":"bearer","token":"YOUR_TOKEN"}`
  - Basic: `{"type":"basic","username":"user","password":"pass"}`
- `triggerType`: 必填，枚举 (cron/manual/passive)
- `triggerConfig`: cron类型必填，JSON字符串
  - 格式: `{"cron":"*/30 * * * *","timezone":"Asia/Shanghai"}`
  - cron表达式必须有效
- `template`: 可选，JSON字符串，支持 `{{content}}` 变量
- `status`: 可选，整数 (0/1)，默认1
- `retryCount`: 可选，整数 (0-5)，默认3
- `timeout`: 可选，整数 (1-300秒)，默认30

**响应**:
```json
{
  "code": 200,
  "message": "订阅创建成功",
  "data": {
    "id": 5,
    "sceneName": "weibo",
    "name": "测试订阅",
    ...
  }
}
```

**错误响应**:
```json
{
  "code": 400,
  "message": "场景 \"invalid-scene\" 不存在",
  "data": null
}
```

### 4. 更新订阅

**PUT** `/fsf/subscriptions/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**请求体** (所有字段可选):
```json
{
  "name": "更新后的名称",
  "targetUrl": "https://new-webhook-url.com",
  "status": 0,
  "timeout": 60
}
```

**响应**:
```json
{
  "code": 200,
  "message": "订阅更新成功",
  "data": {
    "id": 1,
    ...
  }
}
```

**注意**: 
- 更新 `triggerType` 为 `cron` 或更新 `triggerConfig` 会自动重新注册定时任务
- 更新 `status` 为 0 会取消定时任务

### 5. 删除订阅

**DELETE** `/fsf/subscriptions/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "message": "订阅删除成功",
  "data": null
}
```

**注意**: 删除订阅会自动取消对应的定时任务

### 6. 手动触发订阅

**POST** `/fsf/subscriptions/:id/trigger`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "message": "推送已触发",
  "data": null
}
```

**错误响应**:
```json
{
  "code": 500,
  "message": "触发失败: 连接超时",
  "data": null
}
```

**说明**: 
- 此接口会立即触发订阅推送
- 适用于所有 `triggerType` 的订阅
- 执行过程包括：获取数据 → 推送到目标 → 更新时间戳
- 推送失败会根据 `retryCount` 自动重试

## FSF 被动拉取接口

> 需要**用户认证**（任何角色）

### 获取场景数据

**GET** `/fsf/msg/:sceneName`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**路径参数**:
- `sceneName`: 场景名称（如 weibo, news）

**示例**: `/fsf/msg/weibo`

**响应**:
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "scene": "weibo",
    "timestamp": 1763026182358,
    "content": {
      "source": "weibo",
      "updateTime": "2025-11-13T09:29:41.250Z",
      "data": [
        {
          "rank": 1,
          "title": "热搜标题1",
          "hotValue": 1234567,
          "url": "https://weibo.com/1"
        },
        {
          "rank": 2,
          "title": "热搜标题2",
          "hotValue": 987654,
          "url": "https://weibo.com/2"
        }
      ]
    }
  }
}
```

**错误响应**:
```json
{
  "code": 404,
  "message": "场景不存在或已禁用",
  "data": null
}
```

**说明**:
- 数据会根据场景的 `cacheTtl` 自动缓存
- `content` 结构取决于数据源处理器的实现
- 此接口供第三方系统主动拉取数据使用

## 数据结构说明

### TriggerConfig (触发配置)

**Cron 类型**:
```json
{
  "cron": "*/30 * * * *",
  "timezone": "Asia/Shanghai"
}
```

**字段说明**:
- `cron`: Cron 表达式（5段式）
- `timezone`: 时区，默认 Asia/Shanghai

**Cron 表达式示例**:
```
*/30 * * * *     # 每30分钟
0 * * * *        # 每小时整点
0 9,12,18 * * *  # 每天9点、12点、18点
0 9 * * 1-5      # 周一到周五的9点
0 0 * * 0        # 每周日0点
```

### TargetAuth (认证配置)

**Bearer Token**:
```json
{
  "type": "bearer",
  "token": "your-api-token"
}
```

**Basic Auth**:
```json
{
  "type": "basic",
  "username": "admin",
  "password": "secret"
}
```

### Template (消息模板)

**飞书/钉钉/企业微信**:
```json
{
  "title": "标题",
  "content": "{{content}}"
}
```

**变量说明**:
- `{{content}}`: 会被替换为数据源返回的 JSON 字符串

**HTTP Webhook**:
- `template` 为 `null` 时，直接发送原始数据
- `template` 有值时，应用模板后发送

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 前端集成示例

### 1. 登录获取 Token

```javascript
async function login(email, password) {
  const response = await fetch('http://localhost:4778/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (data.code === 200) {
    localStorage.setItem('accessToken', data.data.accessToken);
    return data.data;
  }
  throw new Error(data.message);
}
```

### 2. 获取场景列表

```javascript
async function getScenes() {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('http://localhost:4778/api/fsf/scenes', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.data.scenes;
}
```

### 3. 创建订阅

```javascript
async function createSubscription(subscription) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch('http://localhost:4778/api/fsf/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription)
  });
  return await response.json();
}

// 使用示例
const newSubscription = {
  sceneName: "weibo",
  name: "飞书推送",
  targetType: "feishu",
  targetUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
  triggerType: "cron",
  triggerConfig: JSON.stringify({
    cron: "0 9 * * *",
    timezone: "Asia/Shanghai"
  }),
  template: JSON.stringify({
    title: "微博热搜",
    content: "{{content}}"
  }),
  status: 1,
  retryCount: 3,
  timeout: 30
};
await createSubscription(newSubscription);
```

### 4. 手动触发订阅

```javascript
async function triggerSubscription(id) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(
    `http://localhost:4778/api/fsf/subscriptions/${id}/trigger`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return await response.json();
}
```

### 5. 拉取场景数据

```javascript
async function fetchSceneData(sceneName) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(
    `http://localhost:4778/api/fsf/msg/${sceneName}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  return data.data;
}

// 使用示例
const weiboData = await fetchSceneData('weibo');
console.log(weiboData.content.data); // 热搜列表
```

## TypeScript 类型定义

```typescript
// 场景
interface Scene {
  id: number;
  name: string;
  description: string;
  handler: string;
  cacheTtl: number;
  status: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

// 订阅
interface Subscription {
  id: number;
  sceneName: string;
  name: string;
  targetType: 'http' | 'feishu' | 'dingtalk' | 'wechatwork';
  targetUrl: string;
  targetAuth: string | null;
  triggerType: 'cron' | 'manual' | 'passive';
  triggerConfig: string | null;
  template: string | null;
  status: 0 | 1;
  retryCount: number;
  timeout: number;
  createdBy: number;
  lastTriggeredAt: string | null;
  nextTriggerAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 触发配置
interface TriggerConfig {
  cron: string;
  timezone: string;
}

// 认证配置
interface BearerAuth {
  type: 'bearer';
  token: string;
}

interface BasicAuth {
  type: 'basic';
  username: string;
  password: string;
}

type TargetAuth = BearerAuth | BasicAuth;

// 消息模板
interface MessageTemplate {
  title?: string;
  content: string;
}

// API 响应
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T | null;
  timestamp?: number;
}
```

## 注意事项

1. **Token 管理**:
   - Access Token 有效期 15 分钟
   - Token 过期后需重新登录
   - 生产环境建议实现 Refresh Token 机制

2. **权限控制**:
   - 场景和订阅管理需要管理员角色
   - 被动拉取接口只需登录即可

3. **Cron 订阅**:
   - 创建或更新为启用状态会自动注册定时任务
   - 禁用或删除会自动取消定时任务
   - 服务器重启后会自动加载启用的定时任务

4. **推送超时**:
   - `timeout` 字段最大值 300 秒
   - 建议设置 10-60 秒
   - 超时会触发重试机制

5. **缓存策略**:
   - 数据源缓存使用 Redis
   - `cacheTtl` 建议 300-3600 秒
   - 缓存键格式: `bun-hono:fsf:scene:{sceneName}`

6. **日志查看**:
   - 所有推送操作会记录到 `logs/app.log`
   - 包含详细的状态码、耗时、错误信息
   - 使用结构化 JSON 格式便于解析
