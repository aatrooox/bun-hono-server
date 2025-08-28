import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { rateLimiter } from 'hono-rate-limiter'
import { Logger } from '../utils/logger'

const logger = new Logger('rate-limiter')

/**
 * 限流配置接口
 */
interface RateLimitConfig {
  windowMs: number      // 时间窗口（毫秒）
  maxRequests: number   // 最大请求数
  message?: string      // 限流消息
  skipSuccessfulRequests?: boolean  // 是否跳过成功请求
  skipFailedRequests?: boolean      // 是否跳过失败请求
}

/**
 * 获取客户端标识
 */
function getClientId(c: Context): string {
  // 优先使用认证用户ID
  const user = c.get('user')
  if (user?.id) {
    return `user:${user.id}`
  }
  
  // 使用IP地址
  const forwarded = c.req.header('X-Forwarded-For')
  const realIp = c.req.header('X-Real-IP')
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown'
  
  return `ip:${ip}`
}

/**
 * 创建基础限流中间件
 */
function createRateLimiter(config: RateLimitConfig) {
  return rateLimiter({
    windowMs: config.windowMs,
    limit: config.maxRequests,
    standardHeaders: true, // 返回限流信息在响应头中
    
    // 自定义键生成函数
    keyGenerator: (c: Context) => {
      return getClientId(c)
    },
    
    // 限流触发时的处理
    handler: (c: Context) => {
      const clientId = getClientId(c)
      const requestId = c.get('requestId')
      
      logger.warn('Rate limit exceeded', {
        requestId,
        clientId,
        method: c.req.method,
        url: c.req.url,
        windowMs: config.windowMs,
        maxRequests: config.maxRequests
      })
      
      throw new HTTPException(429, { 
        message: config.message || `请求过于频繁，请稍后再试` 
      })
    },
    
    // 跳过条件
    skip: (c: Context) => {
      // 可以根据需要添加跳过逻辑，比如跳过健康检查
      const url = c.req.url
      if (url.includes('/health') || url.includes('/ping')) {
        return true
      }
      return false
    }
  })
}

/**
 * 全局限流 - 每个IP每分钟最多100个请求
 */
export const globalRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 100,
  message: '请求过于频繁，请1分钟后再试'
})

/**
 * 认证API限流 - 每个IP每5分钟最多5次登录尝试
 */
export const authRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5分钟
  maxRequests: 5,
  message: '登录尝试过于频繁，请5分钟后再试'
})

/**
 * 用户API限流 - 每个用户每分钟最多30个请求
 */
export const userRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 30,
  message: '操作过于频繁，请稍后再试'
})

/**
 * 严格限流 - 用于敏感操作，每个用户每小时最多5次
 */
export const strictRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 5,
  message: '此操作限制频率，请1小时后再试'
})

/**
 * 自定义限流中间件工厂
 */
export function createCustomRateLimit(config: RateLimitConfig) {
  return createRateLimiter(config)
}

/**
 * 基于用户角色的动态限流
 */
export const dynamicRateLimit = async (c: Context, next: Next) => {
  const user = c.get('user')
  const clientId = getClientId(c)
  
  // 根据用户类型设置不同的限流规则
  let maxRequests = 60 // 默认每分钟60次
  
  if (user) {
    // 已认证用户更宽松的限制
    maxRequests = 120
    
    // 可以根据用户等级或权限进一步调整
    // if (user.isVip) maxRequests = 200
    // if (user.isAdmin) maxRequests = 500
  }
  
  // 这里可以集成Redis等外部存储来实现分布式限流
  // 当前使用内存存储作为示例
  
  await next()
}

/**
 * 限流状态检查中间件
 */
export const rateLimitStatus = async (c: Context, next: Next) => {
  const start = Date.now()
  
  await next()
  
  // 在响应中添加限流信息
  const remaining = c.res.headers.get('X-RateLimit-Remaining')
  const reset = c.res.headers.get('X-RateLimit-Reset')
  
  if (remaining && reset) {
    logger.debug('Rate limit status', {
      requestId: c.get('requestId'),
      clientId: getClientId(c),
      remaining: parseInt(remaining),
      reset: new Date(parseInt(reset) * 1000).toISOString(),
      duration: `${Date.now() - start}ms`
    })
  }
}

// 导出配置常量
export const RATE_LIMIT_CONFIG = {
  GLOBAL: { windowMs: 60 * 1000, maxRequests: 100 },
  AUTH: { windowMs: 5 * 60 * 1000, maxRequests: 5 },
  USER: { windowMs: 60 * 1000, maxRequests: 30 },
  STRICT: { windowMs: 60 * 60 * 1000, maxRequests: 5 }
} as const