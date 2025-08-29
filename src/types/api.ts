// API 响应相关类型定义

export const ErrorCodes = {
  SUCCESS: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: PaginationMeta
}

// 常用的响应消息
export const ResponseMessages = {
  SUCCESS: '操作成功',
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '权限不足',
  NOT_FOUND: '资源不存在',
  VALIDATION_ERROR: '参数验证失败',
  INTERNAL_ERROR: '服务器内部错误',
  SERVICE_UNAVAILABLE: '服务暂时不可用'
} as const