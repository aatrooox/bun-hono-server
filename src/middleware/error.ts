import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { ErrorCodes, ResponseMessages } from '../types/api'
import { ResponseHelper } from './response'
import { CustomLogger } from '../utils/logger'

const errorLogger = new CustomLogger('error-handler')

export const errorHandler = async (err: Error, c: Context) => {
  const requestId = c.get('requestId')
  const method = c.req.method
  const url = c.req.url
  const userAgent = c.req.header('User-Agent')
  const ip = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown'
  const user = c.get('user')
  
  // 记录详细错误信息
  const errorContext = {
    requestId,
    method,
    url,
    userAgent,
    ip,
    userId: user?.id || null,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  }

  // Hono HTTP 异常
  if (err instanceof HTTPException) {
    errorLogger.warn(errorContext, `HTTP Exception: ${err.status} - ${err.message}`)
    return c.json(
      ResponseHelper.error(err.status, err.message),
      err.status
    )
  }

  // Zod 验证错误
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    errorLogger.warn({
      ...errorContext,
      validationErrors: err.errors
    }, `Validation Error: ${messages}`)
    return c.json(
      ResponseHelper.error(ErrorCodes.VALIDATION_ERROR, messages),
      422
    )
  }

  // 处理 @hono/zod-validator 的错误响应
  if (err.name === 'ZodError' || (err as any).issues) {
    const zodError = err as any
    const messages = zodError.issues?.map((issue: any) => 
      `${issue.path?.join?.('.') || 'field'}: ${issue.message}`
    ).join(', ') || '参数验证失败'
    
    errorLogger.warn({
      ...errorContext,
      validationIssues: zodError.issues
    }, `Zod Validator Error: ${messages}`)
    
    return c.json(
      ResponseHelper.error(ErrorCodes.VALIDATION_ERROR, messages),
      422
    )
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    errorLogger.warn(errorContext, 'Invalid JWT Token')
    return c.json(
      ResponseHelper.error(ErrorCodes.UNAUTHORIZED, '无效的访问令牌'),
      401
    )
  }

  if (err.name === 'TokenExpiredError') {
    errorLogger.warn(errorContext, 'JWT Token Expired')
    return c.json(
      ResponseHelper.error(ErrorCodes.UNAUTHORIZED, '访问令牌已过期'),
      401
    )
  }

  // 数据库相关错误
  if (err.message.includes('UNIQUE constraint failed')) {
    const field = err.message.includes('email') ? '邮箱' : '数据'
    errorLogger.warn(errorContext, `Database Unique Constraint Failed: ${err.message}`)
    return c.json(
      ResponseHelper.error(ErrorCodes.VALIDATION_ERROR, `${field}已存在`),
      422
    )
  }

  // 数据库连接错误 - 使用 ERROR 级别
  if (err.message.includes('database') && (
    err.message.includes('connection') || 
    err.message.includes('timeout') ||
    err.message.includes('ECONNREFUSED')
  )) {
    errorLogger.error(errorContext, `Database Connection Error: ${err.message}`)
    return c.json(
      ResponseHelper.error(ErrorCodes.SERVICE_UNAVAILABLE, ResponseMessages.SERVICE_UNAVAILABLE),
      503
    )
  }

  // Redis 连接错误 - 使用 ERROR 级别
  if (err.message.includes('Redis') && err.message.includes('connection')) {
    errorLogger.error(errorContext, `Redis Connection Error: ${err.message}`)
    return c.json(
      ResponseHelper.error(ErrorCodes.SERVICE_UNAVAILABLE, ResponseMessages.SERVICE_UNAVAILABLE),
      503
    )
  }

  // 文件系统错误 - 使用 ERROR 级别
  if ('code' in err && (err.code === 'ENOSPC' || err.code === 'EACCES' || err.code === 'EMFILE')) {
    errorLogger.error(errorContext, `File System Error: ${err.message}`)
    return c.json(
      ResponseHelper.error(ErrorCodes.SERVICE_UNAVAILABLE, ResponseMessages.SERVICE_UNAVAILABLE),
      503
    )
  }

  // 默认服务器错误
  errorLogger.error(errorContext, `Unhandled Server Error: ${err.message}`)
  
  return c.json(
    ResponseHelper.error(ErrorCodes.INTERNAL_ERROR, ResponseMessages.INTERNAL_ERROR),
    500
  )
}

// 错误处理中间件包装器
export const errorMiddleware = async (c: Context, next: Next) => {
  try {
    await next()
  } catch (err) {
    return errorHandler(err as Error, c)
  }
}