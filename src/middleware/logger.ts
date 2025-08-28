import { Context, Next } from 'hono'
import { Logger } from '../utils/logger'
import { randomUUID } from 'crypto'

// 创建日志实例
const appLogger = new Logger('app')

/**
 * 增强的日志中间件
 * - 为每个请求生成唯一ID
 * - 记录请求响应时间
 * - 结构化日志输出
 * - 支持链路追踪
 */
export const loggerConfig = async (c: Context, next: Next) => {
  const start = Date.now()
  const requestId = randomUUID()
  
  // 将requestId添加到上下文，用于链路追踪
  c.set('requestId', requestId)
  
  // 获取请求信息
  const req = {
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers),
    ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown'
  }
  
  // 记录请求开始
  appLogger.info(`Request started`, {
    requestId,
    req: {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      ip: req.ip
    }
  })
  
  try {
    await next()
  } catch (error) {
    // 记录请求错误
    const duration = Date.now() - start
    appLogger.error(`Request failed`, {
      requestId,
      error: {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      duration: `${duration}ms`
    })
    throw error
  }
  
  // 计算响应时间
  const duration = Date.now() - start
  
  // 获取响应信息
  const res = {
    status: c.res.status,
    headers: Object.fromEntries(c.res.headers)
  }
  
  // 记录请求完成
  const level = res.status >= 400 ? 'warn' : 'info'
  appLogger[level](`Request completed`, {
    requestId,
    req: {
      method: req.method,
      url: req.url,
      ip: req.ip
    },
    res: {
      status: res.status,
      contentType: res.headers['content-type']
    },
    duration: `${duration}ms`
  })
  
  // 添加响应头包含请求ID（便于调试）
  c.res.headers.set('X-Request-ID', requestId)
}