# Bun Hono Server 🚀

一个基于 Bun 和 Hono 构建的现代化、高性能的 Web 服务器模板，具备完整的用户认证、数据库集成和 API 开发功能。

## ✨ 特性

- 🔥 **极致性能**: 基于 Bun 运行时，启动速度和执行效率领先
- 🛡️ **类型安全**: 全栈 TypeScript，编译时错误检查
- 🔐 **用户认证**: JWT 认证，密码加密，会话管理
- 🗄️ **数据库集成**: SQLite + Drizzle ORM，类型安全的数据库操作
- ⚡ **Redis 缓存**: 完整的 Redis 缓存解决方案，支持会话存储和 API 缓存
- 📁 **文件上传**: 功能完整的文件上传系统，支持本地存储和对象存储
- 🖼️ **图片处理**: 自动压缩、格式转换、尺寸调整、缩略图生成
- 📝 **输入验证**: Zod schema 验证，统一错误处理
- 🌐 **统一响应**: 标准化 API 响应格式和错误码
- 🔧 **开发友好**: 热重载，完整的开发工具链

## 🛠️ 技术栈

- **运行时**: [Bun](https://bun.sh/) - 极快的 JavaScript 运行时
- **框架**: [Hono](https://hono.dev/) - 轻量级 Web 框架
- **数据库**: SQLite + [Drizzle ORM](https://orm.drizzle.team/)
- **缓存**: [Redis](https://redis.io/) + ioredis 客户端
- **验证**: [Zod](https://zod.dev/) - TypeScript 优先的 schema 验证
- **认证**: JWT + bcryptjs 密码哈希
- **语言**: TypeScript

## 📦 快速开始

### 1. 安装 Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. 克隆并安装依赖

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
```

### 3. 初始化数据库

```bash
# 生成数据库迁移文件
bun run db:generate

# 执行数据库迁移
bun run db:migrate
```

### 4. 启动开发服务器

```bash
bun run dev
```

服务器将在 http://localhost:3000 启动

## ⚡ Redis 缓存功能

项目集成了完整的 Redis 缓存解决方案，提供多种缓存模式：

### 📊 缓存类型

- **API 自动缓存**: 使用中间件自动缓存 GET 请求的响应
- **手动缓存**: 灵活的缓存管理，支持自定义缓存策略
- **会话管理**: JWT 会话存储和黑名单管理
- **计数器**: 原子的递增操作
- **队列操作**: 支持消息队列和任务调度
- **哈希表**: 结构化数据存储

### 🔍 对外接口策略

出于安全与职责划分考虑，项目不再对外暴露任何“写缓存/清缓存/队列”等维护类接口；缓存能力仅作为内部中间件与工具使用（见 `src/cache/*`）。

示例：为 GET 接口开启自动缓存（仅通过中间件生效，不单独提供缓存 API）。

```ts
import { Hono } from 'hono'
import { cache } from './src/cache/middleware'

const api = new Hono()

// 获取商品详情（自动缓存 5 分钟）
api.get('/products/:id',
  cache({ ttl: 300, keyPrefix: 'product:' }),
  async (c) => {
    const id = c.req.param('id')
    // ... 查询数据库
    return c.get('success')({ id, name: 'Demo' })
  }
)
```

### ⚙️ 缓存配置

在 `.env` 文件中配置 Redis 连接：

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # 可选
REDIS_DB=0
REDIS_KEY_PREFIX=bun-hono:
```

## 📡 API 接口示例

### 认证相关

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "张三"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 获取当前用户
```http
GET /api/auth/me
Authorization: Bearer <your-jwt-token>
```

### 用户管理

#### 更新用户信息
```http
PATCH /api/users/me
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "新名字",
  "email": "new@example.com"
}
```

#### 修改密码
```http
PATCH /api/users/me/password
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "oldPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

### 文件上传

#### 单文件上传
```http
POST /api/upload/single
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data

# 基础上传
file: <文件>

# 图片处理参数
quality: 80
format: webp
resize_width: 800
resize_height: 600
```

#### 多文件上传
```http
POST /api/upload/multiple
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data

file: <文件1>
file: <文件2>
quality: 75
```

#### 文件管理
```http
# 获取文件信息
GET /api/upload/info/:path

# 检查文件是否存在
GET /api/upload/exists/:path

# 删除文件
DELETE /api/upload/:path
```

📚 **详细文档**: 查看 [UPLOAD_API.md](UPLOAD_API.md) 获取完整的文件上传API文档



## 📘 OpenAPI 文档生成（本地静态）

项目内置一个静态分析脚本，扫描 `src/routes` 中实际挂载的路由，生成 OpenAPI 3.0 文档到 `docs/openapi.json`，便于前端/测试同学使用任意 OpenAPI 工具导入查看。

### 能力概览
- 本地静态生成（不侵入业务、无需运行服务）。
- 仅收集在 `src/routes/index.ts` 通过 `api.route('/xxx', module)` 挂载的路由。
- 识别 Hono 风格路径与参数，将 `:id`、`:path{.+}` 转为 `{id}`、`{path}`。
- 从“紧邻路由调用上方的单行注释”提取接口名称，映射为 OpenAPI `summary`。
- 识别 `@hono/zod-validator` 的 `zValidator('json'|'query'|'param'|'form', SchemaName)` 并生成请求体/参数。
- 若中间件参数包含 `authMiddleware`，自动为该接口添加 `Bearer JWT` 安全要求。
- 响应统一使用项目标准 `ApiResponse` 包裹，`data` 默认为通用对象。

生成产物：`docs/openapi.json`

### 使用方式

```bash
bun run docs:generate   # 生成一次
bun run docs:watch      # 监听 routes/types 变化自动生成
```

可用 Swagger UI、Redoc、Insomnia 或 VS Code 的 OpenAPI 预览扩展打开 `docs/openapi.json`。

### 编写规范（让生成器正确识别）
1) 路由定义与挂载
- 在路由文件中以 `const router = new Hono()` 实例化，并使用 `router.get/post/...('/path', ...)` 定义接口。
- 将该路由模块以默认导出，并在 `src/routes/index.ts` 中通过 `api.route('/prefix', yourRouter)` 挂载。未挂载的路由不会出现在文档中。

2) 单行注释即接口名称
- 在每个路由调用的正上方使用单行注释作为接口名，生成到 `summary`。

```ts
// 获取当前用户信息
auth.get('/me', authMiddleware, async (c) => { /* ... */ })
```

3) 参数与校验（Zod + zValidator）
- 仅识别“命名导出”的 Zod Schema，且需放在 `src/types/*.ts` 中。
- 在路由里引用该 Schema 时请“不要重命名导入”，否则生成器无法按名称匹配。

```ts
// src/types/auth.ts
import { z } from 'zod'
export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

// src/routes/auth.ts
import { zValidator } from '@hono/zod-validator'
import { LoginInput } from '../types/auth' // ✅ 不要重命名为其它别名

// 用户登录
auth.post('/login', zValidator('json', LoginInput), async (c) => { /* ... */ })
```

`zValidator` 映射关系：
- `'json'` -> requestBody.application/json
- `'query'` -> query parameters
- `'param'` -> path parameters（会自动设为 required）
- `'form'` -> x-www-form-urlencoded 与 multipart/form-data

4) 鉴权标识
- 需要 JWT 的接口在参数中包含 `authMiddleware`，文档会自动添加 `bearerAuth` 安全要求。

```ts
// 获取个人资料（需登录）
users.get('/me', authMiddleware, async (c) => { /* ... */ })
```

5) 路径参数
- Hono 的 `:id`、`:slug{[a-z-]+}` 会被转换为 OpenAPI 的 `{id}`、`{slug}`。

### 当前限制
- 仅解析“单行注释”为接口 `summary`；暂不支持多行注释生成 description/tags。
- 仅支持 `@hono/zod-validator` 的命名 Schema；内联 `z.object({...})` 暂不提取。
- 响应 `data` 的精确 Schema 暂未从代码中推导，默认使用通用对象包裹。
- 运行时条件/动态路由不会被静态分析捕获。

如需扩展（例如 `// @tag`、`// @desc` 注释约定或响应 Schema 推导），可以后续按需添加。


## 🏗️ 项目结构

```
src/
├── middleware/          # 中间件
│   ├── auth.ts         # JWT 认证中间件
│   ├── cors.ts         # CORS 配置
│   ├── error.ts        # 错误处理
│   ├── logger.ts       # 日志中间件
│   └── response.ts     # 统一响应格式
├── routes/             # 路由模块
│   ├── auth.ts         # 认证路由
│   ├── users.ts        # 用户管理
│   └── index.ts        # 路由入口
├── db/                 # 数据库相关
│   ├── schema.ts       # 数据库表结构
│   ├── migrations/     # 迁移文件
│   ├── migrate.ts      # 迁移工具
│   └── index.ts        # 数据库连接
├── types/              # 类型定义
│   ├── api.ts          # API 类型
│   ├── auth.ts         # 认证类型
│   ├── env.ts          # 环境变量类型
│   └── index.ts        # 类型入口
├── utils/              # 工具函数
│   ├── hash.ts         # 密码哈希
│   ├── jwt.ts          # JWT 工具
│   └── index.ts        # 工具入口
└── index.ts            # 应用入口
```

## 🔧 可用脚本

```bash
# 开发模式（热重载）
bun run dev

# 构建生产版本
bun run build

# 启动生产服务器
bun run start

# 数据库操作
bun run db:generate     # 生成迁移文件
bun run db:migrate      # 执行迁移
bun run db:studio       # 打开数据库管理界面
```

## 🌍 环境变量

创建 `.env` 文件并配置以下变量：

```bash
# 数据库配置
DATABASE_URL=./database.sqlite

# JWT 配置（生产环境请使用强密钥）
JWT_SECRET=your-super-secret-jwt-key-please-change-this-in-production

# 服务器配置
PORT=3000
NODE_ENV=development

# 日志配置
LOG_LEVEL=debug           # 日志级别: trace, debug, info, warn, error
```

## 📊 日志系统

### 日志级别
- `trace` - 最详细的调试信息
- `debug` - 调试信息（开发环境默认）
- `info` - 一般信息（生产环境默认）
- `warn` - 警告信息
- `error` - 错误信息

### 日志存储位置

**本地开发环境：**
- 控制台输出：彩色格式化的日志，便于开发调试
- 日志目录：`./logs/` （自动创建，目前仅预留）

**生产环境：**
- 控制台输出：JSON 格式的结构化日志
- 建议配置：通过 Docker 或进程管理器收集日志到外部系统

### 日志配置

#### 基础配置
```bash
# 设置日志级别
export LOG_LEVEL=info

# 生产环境
export NODE_ENV=production
```

#### 高级配置示例

**1. 输出到文件（需要修改配置）：**
```typescript
// src/utils/logger.ts 中可以添加文件输出
export const logger = pino({
  level: logLevel,
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: './logs/app.log' }
      },
      {
        target: 'pino-pretty',
        options: { destination: 1 } // stdout
      }
    ]
  }
})
```

**2. 日志轮转（推荐生产环境）：**
```bash
# 使用 pm2 管理日志
npm install -g pm2
pm2 start ecosystem.config.js

# 或使用 Docker 收集日志
docker run -d --log-driver=json-file --log-opt max-size=100m --log-opt max-file=3
```

### 日志功能特性

- ✅ **链路追踪**：每个请求有唯一 `requestId`
- ✅ **结构化日志**：JSON 格式，便于分析和检索
- ✅ **请求日志**：自动记录 HTTP 请求/响应信息
- ✅ **错误追踪**：详细的错误堆栈和上下文
- ✅ **性能监控**：请求响应时间统计
- ✅ **模块日志**：支持按模块创建子日志器

### 使用示例

```typescript
import { logger, Logger } from './utils/logger'

// 基础使用
logger.info('Server starting')
logger.error({ error: err }, 'Database connection failed')

// 模块日志
const userLogger = new Logger('user')
userLogger.info('User registered', { userId: 123 })

// 业务日志
userLogger.business('user_login', 123, { ip: '192.168.1.1' })

// 数据库日志
userLogger.dbQuery('SELECT * FROM users WHERE id = ?', [123], 45)
```

### 生产环境最佳实践

1. **日志级别**：设置为 `info` 或 `warn`
2. **日志收集**：使用 ELK Stack、Fluentd 或云服务
3. **日志轮转**：防止日志文件过大
4. **敏感信息**：避免记录密码、token 等敏感数据
5. **监控告警**：对 ERROR 级别日志设置告警

## 📖 API 响应格式

### 成功响应
``json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "timestamp": 1703123456789
}
```

### 错误响应
``json
{
  "code": 400,
  "message": "错误描述",
  "data": null,
  "timestamp": 1703123456789
}
```

### 标准错误码
- `200` - 成功
- `401` - 未授权
- `403` - 权限不足
- `404` - 资源不存在
- `422` - 参数验证失败
- `500` - 服务器内部错误

## 🚀 部署

### 本地构建
```bash
bun run build
bun run start
```

### Docker 部署

项目优化了 Docker Compose 配置，使用 `env_file` 替代冗长的 `environment` 配置，更加简洁和易维护。

#### 快速部署
```bash
# 使用交互式部署脚本
./deploy.sh

# 或者直接指定部署模式
./deploy.sh dev    # 开发环境
./deploy.sh prod   # 生产环境
./deploy.sh app    # 仅应用服务
```

#### 1. 开发环境 (包含开发用 Redis)
```bash
# 使用部署脚本
./deploy.sh dev

# 或直接使用 docker-compose
docker-compose --profile dev up -d
```

**配置文件**: 直接使用本地 `.env` 文件

#### 2. 生产环境 (连接外部 MySQL + Redis)
```bash
# 1. 复制并配置生产环境变量
cp .env.prod.example .env.prod
# 编辑 .env.prod，配置数据库和 Redis 连接信息

# 2. 启动生产环境
./deploy.sh prod

# 或直接使用 docker-compose
docker-compose -f docker-compose.prod.yml up -d --build
```

**配置文件**: 
- 服务器部署: `/root/envs/hono/.env`
- 本地测试: `.env.prod`

#### 3. 仅应用服务 (连接外部服务)
```bash
# 配置 .env 文件中的外部服务连接信息
REDIS_HOST=your-redis-host
DATABASE_URL=mysql://user:pass@host:port/db

# 启动仅应用服务
./deploy.sh app
```

### 生产环境配置要点

#### 数据库连接
```bash
# MySQL 连接示例
DATABASE_URL=mysql://app_user:secure_password@10.0.0.100:3306/bun_hono_db

# Redis 连接示例
REDIS_HOST=10.0.0.101
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_KEY_PREFIX=bun-hono:prod:
```

#### 对象存储配置 (推荐)
```bash
# 腾讯云 COS
UPLOAD_STORAGE_TYPE=cos
COS_SECRET_ID=your-cos-secret-id
COS_SECRET_KEY=your-cos-secret-key
COS_BUCKET=your-bucket-name
COS_REGION=ap-beijing
```

### Caddy 反向代理配置

项目包含 Caddy 配置示例，自动处理 SSL 证书：

```bash
# 复制 Caddy 配置模板
cp Caddyfile.example /etc/caddy/sites-available/bun-hono-server

# 编辑配置文件，修改域名
sudo nano /etc/caddy/sites-available/bun-hono-server

# 启用站点
sudo ln -s /etc/caddy/sites-available/bun-hono-server /etc/caddy/sites-enabled/

# 重载 Caddy 配置
sudo systemctl reload caddy
```

#### Caddy 配置特性
- 🔒 **自动 SSL**: 自动申请和续期 Let's Encrypt 证书
- 🔄 **负载均衡**: 支持多实例部署
- 📊 **健康检查**: 自动检测应用健康状态
- 🗜️ **压缩**: 自动启用 Gzip/Zstd 压缩
- 🛡️ **安全头**: 自动添加安全相关的 HTTP 头
- 📋 **访问日志**: JSON 格式的结构化日志

### 容器监控

#### 查看服务状态
```bash
docker-compose ps
docker-compose logs -f app
```

#### 健康检查
```bash
# 应用健康检查
curl http://localhost:3000/api/health

# Docker 健康状态
docker inspect --format='{{.State.Health}}' bun-hono-server-prod
```

#### 资源监控
```bash
# 查看资源使用情况
docker stats bun-hono-server-prod

# 查看日志
docker logs -f bun-hono-server-prod
```

### 生产环境优化建议

1. **资源限制**: 生产配置已设置内存和 CPU 限制
2. **只读文件系统**: 启用了 read-only 模式提高安全性
3. **健康检查**: 配置了完整的健康检查机制
4. **日志管理**: 建议配置日志轮转和外部日志收集
5. **监控告警**: 建议集成 Prometheus + Grafana 监控
6. **备份策略**: 定期备份数据库和重要配置文件

## 🤝 贡献

1. Fork 这个项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📄 许可证

这个项目使用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Bun](https://bun.sh/) - 超快的 JavaScript 运行时
- [Hono](https://hono.dev/) - 快速、轻量级的 Web 框架
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Zod](https://zod.dev/) - TypeScript 优先的验证库
