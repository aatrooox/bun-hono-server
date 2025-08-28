# Bun Hono Server 🚀

一个基于 Bun 和 Hono 构建的现代化、高性能的 Web 服务器模板，具备完整的用户认证、数据库集成和 API 开发功能。

## ✨ 特性

- 🔥 **极致性能**: 基于 Bun 运行时，启动速度和执行效率领先
- 🛡️ **类型安全**: 全栈 TypeScript，编译时错误检查
- 🔐 **用户认证**: JWT 认证，密码加密，会话管理
- 🗄️ **数据库集成**: SQLite + Drizzle ORM，类型安全的数据库操作
- 📁 **文件上传**: 功能完整的文件上传系统，支持本地存储和对象存储
- 🖼️ **图片处理**: 自动压缩、格式转换、尺寸调整、缩略图生成
- 📝 **输入验证**: Zod schema 验证，统一错误处理
- 🌐 **统一响应**: 标准化 API 响应格式和错误码
- 🔧 **开发友好**: 热重载，完整的开发工具链

## 🛠️ 技术栈

- **运行时**: [Bun](https://bun.sh/) - 极快的 JavaScript 运行时
- **框架**: [Hono](https://hono.dev/) - 轻量级 Web 框架
- **数据库**: SQLite + [Drizzle ORM](https://orm.drizzle.team/)
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

## 📚 API 文档

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

# 测试
bun test
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
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "timestamp": 1703123456789
}
```

### 错误响应
```json
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
```dockerfile
FROM oven/bun:1 as base
WORKDIR /app

# 复制依赖文件
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# 复制源码
COPY . .

# 构建应用
RUN bun run build

# 启动应用
EXPOSE 3000
CMD ["bun", "run", "start"]
```

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
