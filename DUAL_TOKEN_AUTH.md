# 双 Token 认证系统实现文档

## 系统概述

本项目已成功升级为双 Token 认证系统，提供更安全、更灵活的用户认证机制。

## 架构设计

### Token 类型

1. **Access Token**
   - 用途: 实际业务 API 调用
   - 有效期: 15 分钟
   - 存储: 前端内存（推荐）或 localStorage
   - 特点: 无状态 JWT，包含用户基本信息

2. **Refresh Token**
   - 用途: 刷新 Access Token
   - 有效期: 7 天  
   - 存储: 数据库 + 前端安全存储
   - 特点: 有状态，可撤销，支持设备管理

### 数据库结构变更

#### 用户表扩展 (`users`)
新增字段：
- `nickname`: 昵称
- `avatar`: 头像 URL
- `phone`: 手机号
- `gender`: 性别（0-未知，1-男，2-女）
- `birthday`: 生日
- `bio`: 个人简介
- `status`: 状态（0-禁用，1-正常）

#### 刷新令牌表 (`refresh_tokens`)
替换原 `sessions` 表：
- `id`: 主键
- `userId`: 用户 ID
- `token`: Refresh Token
- `deviceInfo`: 设备信息
- `ipAddress`: IP 地址
- `expiresAt`: 过期时间
- `isRevoked`: 是否已撤销
- `createdAt/updatedAt`: 时间戳

#### OAuth 账户表 (`oauth_accounts`)
支持第三方登录：
- `id`: 主键
- `userId`: 关联用户 ID
- `provider`: 登录提供方（wechat、qq 等）
- `providerUserId`: 第三方用户 ID
- `providerUserId2`: 第二个第三方 ID（如微信 unionid）
- `providerUserInfo`: 第三方用户信息 JSON
- `accessToken/refreshToken`: 第三方令牌
- `expiresAt`: 第三方令牌过期时间

## API 接口变更

### 认证相关接口

#### 1. 用户注册 `POST /api/auth/register`
**响应格式（新）:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "用户名",
    "nickname": null,
    "avatar": null,
    "phone": null,
    "gender": null,
    "birthday": null,
    "bio": null,
    "status": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000-...",
  "expiresIn": 900
}
```

#### 2. 用户登录 `POST /api/auth/login`
**响应格式（新）:**
同注册接口响应格式

#### 3. 刷新令牌 `POST /api/auth/refresh`
**请求体:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000-..."
}
```

**响应体:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

#### 4. 退出登录 `POST /api/auth/logout`
**请求体:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000-..."
}
```

#### 5. 退出所有设备 `POST /api/auth/logout-all`
需要 Authorization Bearer Token

### 用户管理接口

#### 更新用户信息 `PATCH /api/users/me`
**请求体示例:**
```json
{
  "nickname": "新昵称",
  "avatar": "https://example.com/avatar.jpg",
  "phone": "13800138000",
  "gender": 1,
  "birthday": "1990-01-01",
  "bio": "这是我的个人简介"
}
```

## 中间件更新

### 认证中间件 (`authMiddleware`)
- 使用 `JwtUtils.verifyAccessToken()` 验证 Access Token
- 查询用户完整信息（包含新字段）
- 检查用户状态（是否被禁用）

### 可选认证中间件 (`optionalAuthMiddleware`)
- 如果有 token 则验证，没有则跳过
- 同样检查用户状态

## JWT 工具类更新

### 新方法
- `generateAccessToken()`: 生成 15 分钟 Access Token
- `generateRefreshToken()`: 生成 UUID 格式 Refresh Token
- `generateTokenPair()`: 生成 token 对
- `verifyAccessToken()`: 验证 Access Token
- `getRefreshTokenExpiresAt()`: 获取 Refresh Token 过期时间
- `isRefreshTokenExpired()`: 检查 Refresh Token 是否过期

## 安全特性

### Token 安全
1. **Access Token 短时效**: 15 分钟有效期，降低泄露风险
2. **Refresh Token 可撤销**: 存储在数据库，支持主动撤销
3. **设备管理**: 记录设备信息和 IP，支持踢出特定设备
4. **状态检查**: 每次验证都检查用户状态

### 数据完整性
1. **唯一约束**: 邮箱、手机号、第三方 ID 等唯一性约束
2. **外键约束**: 确保数据关联完整性
3. **软删除**: Refresh Token 采用标记删除而非物理删除

## 迁移指南

### 数据库迁移
```bash
# 生成迁移文件
bun run db:generate

# 应用迁移
bun run db:migrate
```

### 前端适配建议
1. **Token 存储**: Access Token 存内存，Refresh Token 存安全存储
2. **自动刷新**: 在 API 响应拦截器中处理 401 错误自动刷新
3. **退出登录**: 调用退出接口撤销 Refresh Token

### 错误处理
- `401 + "访问令牌已过期"`: 使用 Refresh Token 刷新
- `401 + "刷新令牌已过期"`: 重新登录
- `401 + "用户账户已被禁用"`: 显示账户被禁用信息

## 使用示例

### 完整的认证流程
```typescript
// 1. 登录获取 tokens
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password' })
});

const { accessToken, refreshToken } = await loginResponse.json();

// 2. 使用 Access Token 调用 API
const apiResponse = await fetch('/api/users/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// 3. Token 过期时刷新
if (apiResponse.status === 401) {
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const { accessToken: newAccessToken } = await refreshResponse.json();
  // 重新调用原 API
}

// 4. 退出登录
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});
```

## 性能考虑

1. **Access Token 验证**: 纯 JWT 验证，无数据库查询开销
2. **Refresh Token 验证**: 需查询数据库，但频率低
3. **用户信息缓存**: 可考虑在 Redis 中缓存用户基本信息
4. **过期 Token 清理**: 建议定期清理过期的 Refresh Token

## 后续扩展

1. **多设备管理**: 前端显示登录设备列表，支持远程踢出
2. **OAuth 登录**: 基于 `oauth_accounts` 表实现第三方登录
3. **权限系统**: 在 JWT 中加入角色和权限信息
4. **审计日志**: 记录登录、退出、刷新等操作日志