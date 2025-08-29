import { Context, Next } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { HTTPException } from 'hono/http-exception'
import { CustomLogger } from '../utils/logger'
import { requestSizeConfig } from '../config/rate-limit'

const logger = new CustomLogger('security')

/**
 * 安全头部配置
 * 使用Hono官方的secure-headers中间件
 */
export const securityHeaders = secureHeaders({
  // 内容安全策略 - 放宽策略以避免干扰API认证
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https:"], // 允许HTTPS连接
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
    // 移除 upgradeInsecureRequests 以避免干扰开发环境
  },
  
  // XSS防护
  xXssProtection: '1; mode=block',
  
  // 内容类型嗅探防护
  xContentTypeOptions: 'nosniff',
  
  // 点击劫持防护
  xFrameOptions: 'DENY',
  
  // HSTS - 仅在生产环境启用
  strictTransportSecurity: process.env.NODE_ENV === 'production' 
    ? 'max-age=31536000; includeSubDomains' 
    : false,
  
  // 跨域策略 - 放宽以支持API访问
  crossOriginEmbedderPolicy: false, // 关闭以避免干扰API
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: false, // 关闭以支持API访问
  
  // 引荐来源策略
  referrerPolicy: 'strict-origin-when-cross-origin',
  
  // 权限策略
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    fullscreen: ["'self'"]
  }
})

/**
 * 输入验证和XSS防护中间件
 */
export const xssProtection = async (c: Context, next: Next) => {
  const requestId = c.get('requestId')
  
  // 检查请求体中的潜在XSS攻击
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
    try {
      const contentType = c.req.header('Content-Type')
      
      if (contentType?.includes('application/json')) {
        const body = await c.req.text()
        
        // 检测常见的XSS攻击模式
        const xssPatterns = [
          /<script[^>]*>.*?<\/script>/gi,
          /<iframe[^>]*>.*?<\/iframe>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<img[^>]*onerror[^>]*>/gi,
          /<svg[^>]*onload[^>]*>/gi,
          /eval\s*\(/gi,
          /expression\s*\(/gi
        ]
        
        for (const pattern of xssPatterns) {
          if (pattern.test(body)) {
            logger.warn({
              requestId,
              method: c.req.method,
              url: c.req.url,
              userAgent: c.req.header('User-Agent'),
              ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
              pattern: pattern.source
            }, 'Potential XSS attack detected')
            
            throw new HTTPException(400, { 
              message: '请求包含不安全的内容' 
            })
          }
        }
        
        // 重新设置请求体，因为我们已经读取了它
        // 注意：在Hono中，请求对象是只读的，这里仅作为示例
        // 实际中可能需要使用其他方式来处理请求体
        // c.req = new Request(c.req.url, {
        //   method: c.req.method,
        //   headers: c.req.raw.headers,
        //   body: body
        // })
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      // 如果解析失败，继续处理（可能不是JSON请求）
    }
  }
  
  await next()
}

/**
 * SQL注入防护中间件
 */
export const sqlInjectionProtection = async (c: Context, next: Next) => {
  const requestId = c.get('requestId')
  const url = c.req.url
  const query = new URL(url).searchParams
  
  // 检查URL参数中的SQL注入模式
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\'|\"|\`|\;|\-\-|\/\*|\*\/)/gi,
    /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/gi
  ]
  
  // 检查所有查询参数
  for (const [key, value] of query.entries()) {
    for (const pattern of sqlPatterns) {
      if (pattern.test(value)) {
        logger.warn({
          requestId,
          method: c.req.method,
          url: c.req.url,
          parameter: key,
          value: value,
          userAgent: c.req.header('User-Agent'),
          ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
          pattern: pattern.source
        }, 'Potential SQL injection detected')
        
        throw new HTTPException(400, { 
          message: '请求参数包含不安全的内容' 
        })
      }
    }
  }
  
  await next()
}

/**
 * 请求大小限制中间件
 */
export const requestSizeLimit = (maxSize?: number) => { // 使用可选参数
  const limitSize = maxSize || requestSizeConfig.maxSize // 优先使用传入参数，否则使用配置
  
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('Content-Length')
    
    if (contentLength && parseInt(contentLength) > limitSize) {
      const requestId = c.get('requestId')
      
      logger.warn({
        requestId,
        contentLength: parseInt(contentLength),
        maxSize: limitSize,
        url: c.req.url,
        method: c.req.method,
        ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
      }, 'Request size limit exceeded')
      
      throw new HTTPException(413, { 
        message: '请求内容过大' 
      })
    }
    
    await next()
  }
}

/**
 * 文件类型验证中间件
 */
export const fileTypeValidation = (allowedTypes: string[] = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'application/json'
]) => {
  return async (c: Context, next: Next) => {
    const contentType = c.req.header('Content-Type')
    
    if (contentType && contentType.includes('multipart/form-data')) {
      // 这里可以添加更详细的文件类型检查
      // 当前只是示例，实际使用时需要解析multipart数据
    }
    
    await next()
  }
}

/**
 * User-Agent验证中间件
 */
export const userAgentValidation = async (c: Context, next: Next) => {
  const userAgent = c.req.header('User-Agent')
  const requestId = c.get('requestId')
  
  // 检查是否存在User-Agent
  if (!userAgent) {
    logger.warn({
      requestId,
      url: c.req.url,
      method: c.req.method,
      ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
    }, 'Missing User-Agent header')
  }
  
  // 检查可疑的User-Agent模式
  const suspiciousPatterns = [
    /sqlmap/gi,
    /nikto/gi,
    /nmap/gi,
    /scanner/gi,
    /bot/gi // 可以根据需要调整
  ]
  
  if (userAgent) {
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        logger.warn({
          requestId,
          userAgent,
          url: c.req.url,
          method: c.req.method,
          ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
          pattern: pattern.source
        }, 'Suspicious User-Agent detected')
        
        // 可以选择阻止请求或仅记录
        // throw new HTTPException(403, { message: '访问被拒绝' })
        break
      }
    }
  }
  
  await next()
}

/**
 * 组合安全中间件
 */
export const combinedSecurity = async (c: Context, next: Next) => {
  // 应用安全头部
  await securityHeaders(c, async () => {
    // 应用XSS防护
    await xssProtection(c, async () => {
      // 应用SQL注入防护
      await sqlInjectionProtection(c, async () => {
        // 应用User-Agent验证
        await userAgentValidation(c, next)
      })
    })
  })
}

// 导出安全配置常量和请求大小配置
export { requestSizeConfig } from '../config/rate-limit'

export const SECURITY_CONFIG = {
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/json'
  ],
  CSP_DIRECTIVES: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"]
  }
} as const