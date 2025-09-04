# 使用官方 Bun 镜像作为基础镜像
FROM oven/bun:1 AS base
WORKDIR /app

# 安装依赖阶段
FROM base AS deps
# 复制依赖配置文件（使用正确的 Bun 锁文件名）
COPY package.json bun.lock ./
# 安装所有依赖（包括 pino-pretty），因为生产环境可能需要日志美化
RUN bun install --frozen-lockfile

# 构建阶段
FROM base AS builder
# 复制依赖配置文件
COPY package.json bun.lock ./
# 安装所有依赖（包括开发依赖）
RUN bun install --frozen-lockfile

# 复制源码
COPY . .

# 构建应用
RUN bun run build

# 生产镜像
FROM base AS production
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

# 复制生产依赖
COPY --from=deps --chown=hono:nodejs /app/node_modules ./node_modules
# 复制构建产物
COPY --from=builder --chown=hono:nodejs /app/dist ./dist
# 复制必要的配置文件
COPY --from=builder --chown=hono:nodejs /app/package.json ./package.json
# 复制健康检查脚本
COPY --from=builder --chown=hono:nodejs /app/healthcheck.js ./healthcheck.js
# 复制数据库迁移文件（运行时 drizzle migrator 需要 ./src/db/migrations 路径）
COPY --from=builder --chown=hono:nodejs /app/src/db/migrations ./src/db/migrations

# 创建必要的目录并设置权限
RUN mkdir -p uploads logs data && \
  chown -R hono:nodejs uploads logs data && \
  chmod -R 755 uploads logs data

# 切换到非 root 用户
USER hono

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "/app/healthcheck.js"]

# 启动应用
CMD ["bun", "run", "start"]