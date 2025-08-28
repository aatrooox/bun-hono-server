import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { ErrorCodes, ResponseMessages } from '../types/api'
import { ResponseHelper } from './response'

export const errorHandler = async (err: Error, c: Context) => {
  console.error('🚨 错误:', err)

  // Hono HTTP 异常
  if (err instanceof HTTPException) {
    return c.json(
      ResponseHelper.error(err.status, err.message),
      err.status
    )
  }

  // Zod 验证错误
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
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
    
    return c.json(
      ResponseHelper.error(ErrorCodes.VALIDATION_ERROR, messages),
      422
    )
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return c.json(
      ResponseHelper.error(ErrorCodes.UNAUTHORIZED, '无效的访问令牌'),
      401
    )
  }

  if (err.name === 'TokenExpiredError') {
    return c.json(
      ResponseHelper.error(ErrorCodes.UNAUTHORIZED, '访问令牌已过期'),
      401
    )
  }

  // 数据库相关错误
  if (err.message.includes('UNIQUE constraint failed')) {
    const field = err.message.includes('email') ? '邮箱' : '数据'
    return c.json(
      ResponseHelper.error(ErrorCodes.VALIDATION_ERROR, `${field}已存在`),
      422
    )
  }

  // 默认服务器错误
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