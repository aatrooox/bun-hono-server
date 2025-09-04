# Bun Hono Server 部署环境准备清单

## 📋 新环境部署前置条件

### 1. 基础环境要求

- ✅ **Docker Engine**：版本 20.10+ 
- ✅ **Docker Compose**：支持 `docker compose` 命令（推荐 v2+）
- ✅ **操作系统**：Linux（推荐 Ubuntu/Debian/CentOS）
- ✅ **网络**：服务器可访问 Docker Hub

### 2. Redis 服务部署

#### 2.1 启动 Redis 容器
```bash
# 启动 Redis 服务（容器名必须是 zzclub_redis_server）
docker run -d \
  --name zzclub_redis_server \
  --restart always \
  -p 6379:6379 \
  redis:7.0

# 验证 Redis 运行状态
docker exec zzclub_redis_server redis-cli ping
# 应该返回：PONG
```

#### 2.2 创建外部网络
```bash
# 创建专用网络（用于容器间通信）
docker network create zzclub_common_internal --driver bridge

# 将 Redis 容器连接到网络
docker network connect zzclub_common_internal zzclub_redis_server
```

### 3. 目录结构准备

#### 3.1 创建必要目录
```bash
# 创建应用相关目录
sudo mkdir -p /root/server/hono-base
sudo mkdir -p /root/envs/hono
sudo mkdir -p /root/logs/hono
sudo mkdir -p /root/assets/hono
sudo mkdir -p /root/databases/hono

# 设置目录权限（容器内用户 UID 1001）
sudo chown -R 1001:1001 /root/logs/hono /root/assets/hono /root/databases/hono
sudo chmod -R 755 /root/logs/hono /root/assets/hono /root/databases/hono
```

#### 3.2 创建环境配置文件
```bash
# 创建生产环境配置
sudo tee /root/envs/hono/.env << 'EOF'
# 数据库配置
DATABASE_URL=/data/database.sqlite

# JWT 配置
JWT_SECRET=your-jwt-secret-key-here

# 管理员账户配置（初始化时创建）
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_NAME=系统管理员

# 服务器配置
PORT=4778
NODE_ENV=production

# Redis 配置
REDIS_HOST=zzclub_redis_server
REDIS_PORT=6379
REDIS_DB=3
REDIS_KEY_PREFIX=bun-hono:

# 文件上传配置
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760

# 日志配置
LOG_LEVEL=info
EOF

# 设置配置文件权限
sudo chmod 644 /root/envs/hono/.env
```

### 4. GitHub Actions Secrets 配置

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `SSH_HOST` | 服务器 IP 或域名 | `192.168.1.100` |
| `SSH_USER` | SSH 登录用户名 | `root` |
| `SSH_KEY` | SSH 私钥内容 | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |

### 5. 可选服务（MySQL）

如果需要 MySQL 服务：

```bash
# 启动 MySQL 容器
docker run -d \
  --name zzclub_mysql_server \
  --restart always \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=your-mysql-password \
  -e MYSQL_DATABASE=your-database-name \
  mysql:8.0

# 连接到网络
docker network connect zzclub_common_internal zzclub_mysql_server
```

### 6. 防火墙配置

```bash
# 开放应用端口（如果需要外部访问）
sudo ufw allow 4778/tcp

# 可选：开放 Redis/MySQL 端口（仅在需要外部访问时）
# sudo ufw allow 6379/tcp  # Redis
# sudo ufw allow 3306/tcp  # MySQL
```

## 🚀 部署流程

### 自动部署
1. 推送代码到 `main` 分支
2. GitHub Actions 自动触发部署
3. 等待健康检查通过

### 手动部署
```bash
# 1. 进入应用目录
cd /root/server/hono-base

# 2. 拉取最新镜像
docker compose -f docker-compose.prod.yml pull

# 3. 启动服务
docker compose -f docker-compose.prod.yml up -d

# 4. 检查状态
docker compose -f docker-compose.prod.yml ps
docker logs bun-hono-server-prod
```

## 🔍 故障排查

### 检查服务状态
```bash
# 查看所有相关容器
docker ps | grep -E "(redis|mysql|bun-hono)"

# 检查网络连接
docker network inspect zzclub_common_internal

# 查看应用日志
docker logs bun-hono-server-prod --tail 50

# 测试 Redis 连接
docker exec bun-hono-server-prod bun -e "
const net = require('net');
const socket = new net.Socket();
socket.connect(6379, 'zzclub_redis_server', () => {
  console.log('Redis connected');
  socket.destroy();
});
"
```

### 常见问题解决
- **端口占用**：`sudo lsof -i :4778` 检查端口使用
- **权限问题**：重新设置目录权限（UID 1001）
- **网络问题**：重新连接容器到网络
- **配置错误**：检查 `/root/envs/hono/.env` 文件

## ✅ 部署成功验证

```bash
# 1. 检查容器健康状态
docker inspect bun-hono-server-prod --format '{{.State.Health.Status}}'
# 应该返回：healthy

# 2. 测试 API 端点
curl -I http://localhost:4778/api/health

# 3. 检查日志无错误
docker logs bun-hono-server-prod --tail 20 | grep -i error
```

## 📦 Docker 镜像管理

### 构建和推送镜像
```bash
# 构建多平台镜像并推送到 Docker Hub
docker buildx build --platform linux/amd64,linux/arm64 -t gnakdogg/bun-hono-server:latest --push .

# 仅构建 AMD64（用于 x86 服务器）
docker buildx build --platform linux/amd64 -t gnakdogg/bun-hono-server:latest --push .
```

### 镜像版本管理
```bash
# 构建带版本标签的镜像
docker buildx build --platform linux/amd64,linux/arm64 \
  -t gnakdogg/bun-hono-server:latest \
  -t gnakdogg/bun-hono-server:v1.0.1 \
  --push .
```

## 🔧 配置文件说明

### docker-compose.prod.yml 关键配置
- **镜像**: `gnakdogg/bun-hono-server`
- **平台**: `linux/amd64`
- **端口映射**: `4778:3000`
- **挂载目录**:
  - `/root/logs/hono:/app/logs` - 日志目录
  - `/root/assets/hono:/app/uploads` - 文件上传目录  
  - `/root/databases/hono:/data` - SQLite 数据库目录
- **环境文件**: `/root/envs/hono/.env`
- **网络**: `zzclub_common_internal`

### 环境变量说明
| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `PORT` | 应用内部端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |
| `DATABASE_URL` | SQLite 数据库路径 | `/data/database.sqlite` |
| `REDIS_HOST` | Redis 主机名 | `zzclub_redis_server` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_DB` | Redis 数据库编号 | `3` |
| `JWT_SECRET` | JWT 密钥 | **必须设置** |
| `ADMIN_EMAIL` | 管理员邮箱 | **必须设置** |
| `ADMIN_PASSWORD` | 管理员密码 | **必须设置** |
| `ADMIN_NAME` | 管理员名称 | `系统管理员` |

---

> **注意**：以上配置基于当前的 docker-compose.prod.yml 和部署脚本。确保所有容器名称、网络名称和路径与实际配置保持一致。
