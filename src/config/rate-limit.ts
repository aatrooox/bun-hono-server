/**
 * 速率限制配置
 */

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
}

interface RateLimitConfigs {
  global: RateLimitConfig
  auth: RateLimitConfig
  user: RateLimitConfig
  strict: RateLimitConfig
  upload: RateLimitConfig
}

/**
 * 获取环境变量数值，提供默认值
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  return value ? parseInt(value, 10) : defaultValue
}

/**
 * 速率限制配置
 * 优先使用环境变量，如果不存在则使用默认值
 */
export const rateLimitConfig: RateLimitConfigs = {
  // 全局限流 - 每个IP每分钟的请求数
  global: {
    windowMs: getEnvNumber('RATE_LIMIT_GLOBAL_WINDOW_MS', 60 * 1000), // 1分钟
    maxRequests: getEnvNumber('RATE_LIMIT_GLOBAL_MAX', 100),
    message: '请求过于频繁，请1分钟后再试'
  },

  // 认证API限流 - 登录/注册等敏感操作
  auth: {
    windowMs: getEnvNumber('RATE_LIMIT_AUTH_WINDOW_MS', 5 * 60 * 1000), // 5分钟
    maxRequests: getEnvNumber('RATE_LIMIT_AUTH_MAX', 5),
    message: '登录尝试过于频繁，请5分钟后再试'
  },

  // 用户API限流 - 已认证用户的常规操作
  user: {
    windowMs: getEnvNumber('RATE_LIMIT_USER_WINDOW_MS', 60 * 1000), // 1分钟
    maxRequests: getEnvNumber('RATE_LIMIT_USER_MAX', 30),
    message: '操作过于频繁，请稍后再试'
  },

  // 严格限流 - 敏感操作（如修改密码、删除账户等）
  strict: {
    windowMs: getEnvNumber('RATE_LIMIT_STRICT_WINDOW_MS', 60 * 60 * 1000), // 1小时
    maxRequests: getEnvNumber('RATE_LIMIT_STRICT_MAX', 5),
    message: '此操作限制频率，请1小时后再试'
  },

  // 文件上传限流
  upload: {
    windowMs: getEnvNumber('RATE_LIMIT_UPLOAD_WINDOW_MS', 60 * 1000), // 1分钟
    maxRequests: getEnvNumber('RATE_LIMIT_UPLOAD_MAX', 10),
    message: '文件上传过于频繁，请稍后再试'
  }
}

/**
 * 获取基于环境的动态配置
 */
export function getRateLimitConfig(environment: string = process.env.NODE_ENV || 'development'): RateLimitConfigs {
  // 生产环境更严格的限制
  if (environment === 'production') {
    return {
      ...rateLimitConfig,
      global: {
        ...rateLimitConfig.global,
        maxRequests: Math.min(rateLimitConfig.global.maxRequests, 200) // 生产环境最多200次/分钟
      },
      auth: {
        ...rateLimitConfig.auth,
        maxRequests: Math.min(rateLimitConfig.auth.maxRequests, 3) // 生产环境更严格的认证限制
      }
    }
  }

  // 开发环境更宽松的限制
  if (environment === 'development') {
    return {
      ...rateLimitConfig,
      global: {
        ...rateLimitConfig.global,
        maxRequests: rateLimitConfig.global.maxRequests * 2 // 开发环境放宽限制
      },
      auth: {
        ...rateLimitConfig.auth,
        maxRequests: rateLimitConfig.auth.maxRequests * 2
      }
    }
  }

  // 测试环境的配置
  if (environment === 'test') {
    return {
      global: { windowMs: 1000, maxRequests: 1000, message: 'Test rate limit' },
      auth: { windowMs: 1000, maxRequests: 100, message: 'Test auth rate limit' },
      user: { windowMs: 1000, maxRequests: 500, message: 'Test user rate limit' },
      strict: { windowMs: 1000, maxRequests: 50, message: 'Test strict rate limit' },
      upload: { windowMs: 1000, maxRequests: 100, message: 'Test upload rate limit' }
    }
  }

  return rateLimitConfig
}

/**
 * 请求体大小限制配置
 */
export const requestSizeConfig = {
  // 最大请求体大小（字节）
  maxSize: getEnvNumber('MAX_REQUEST_SIZE', 10 * 1024 * 1024), // 默认10MB
  
  // 不同类型请求的大小限制
  limits: {
    json: getEnvNumber('MAX_JSON_SIZE', 1 * 1024 * 1024), // 1MB
    upload: getEnvNumber('MAX_UPLOAD_SIZE', 50 * 1024 * 1024), // 50MB
    text: getEnvNumber('MAX_TEXT_SIZE', 100 * 1024), // 100KB
  }
}

/**
 * 导出类型定义
 */
export type { RateLimitConfig, RateLimitConfigs }