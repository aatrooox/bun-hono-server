import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { rateLimiter } from 'hono-rate-limiter'
import { CustomLogger } from '../utils/logger'
import { rateLimitConfig, getRateLimitConfig, type RateLimitConfig } from '../config/rate-limit'

const logger = new CustomLogger('rate-limiter')
const config = getRateLimitConfig()

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
function createRateLimiter(rateLimitConfig: RateLimitConfig) {
  return rateLimiter({
    windowMs: rateLimitConfig.windowMs,
    limit: rateLimitConfig.maxRequests,
    standardHeaders: true, // 返回限流信息在响应头中
    
    // 自定义键生成函数
    keyGenerator: (c: Context) => {
      return getClientId(c)
    },
    
    // 限流触发时的处理
    handler: (c: Context) => {
      const clientId = getClientId(c)
      const requestId = c.get('requestId')
      
      logger.warn({
        requestId,
        clientId,
        method: c.req.method,
        url: c.req.url,
        windowMs: rateLimitConfig.windowMs,
        maxRequests: rateLimitConfig.maxRequests
      }, 'Rate limit exceeded')
      
      throw new HTTPException(429, { 
        message: rateLimitConfig.message || `请求过于频繁，请稍后再试` 
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
 * 全局限流 - 每个IP每分钟的请求限制
 */
export const globalRateLimit = createRateLimiter(config.global)

/**
 * 认证API限流 - 登录/注册等敏感操作的限制
 */
export const authRateLimit = createRateLimiter(config.auth)

/**
 * 用户API限流 - 已认证用户的常规操作限制
 */
export const userRateLimit = createRateLimiter(config.user)

/**
 * 严格限流 - 用于敏感操作（如修改密码、删除账户等）
 */
export const strictRateLimit = createRateLimiter(config.strict)

/**
 * 文件上传限流
 */
export const uploadRateLimit = createRateLimiter(config.upload)

/**
 * 自定义限流中间件工厂
 */
export function createCustomRateLimit(rateLimitConfig: RateLimitConfig) {
  return createRateLimiter(rateLimitConfig)
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
    logger.debug({
      requestId: c.get('requestId'),
      clientId: getClientId(c),
      remaining: parseInt(remaining),
      reset: new Date(parseInt(reset) * 1000).toISOString(),
      duration: `${Date.now() - start}ms`
    }, 'Rate limit status')
  }
}

// 导出配置常量和类型
export { rateLimitConfig, getRateLimitConfig, type RateLimitConfig } from '../config/rate-limit'