import { Context, Next } from 'hono'
import { ApiResponse, ErrorCodes, ResponseMessages } from '../types/api'

// 响应工具函数
export class ResponseHelper {
  static success<T = any>(data: T, message: string = ResponseMessages.SUCCESS): ApiResponse<T> {
    return {
      code: ErrorCodes.SUCCESS,
      message,
      data,
      timestamp: Date.now()
    }
  }

  static error(code: number, message: string, data: any = null): ApiResponse {
    return {
      code,
      message,
      data,
      timestamp: Date.now()
    }
  }
}

// 响应中间件 - 添加响应工具到上下文
export const responseMiddleware = async (c: Context, next: Next) => {
  // 添加响应工具方法到上下文
  c.set('success', <T = any>(data: T, message?: string) => {
    return c.json(ResponseHelper.success(data, message))
  })

  c.set('error', (code: number, message: string, data?: any) => {
    return c.json(ResponseHelper.error(code, message, data))
  })

  await next()
}

// 扩展 Context 类型
declare module 'hono' {
  interface ContextVariableMap {
    success: <T = any>(data: T, message?: string) => Response
    error: (code: number, message: string, data?: any) => Response
    user?: {
      id: number
      email: string
      name: string
    }
    jwtPayload?: {
      userId: number
      email: string
    }
  }
}