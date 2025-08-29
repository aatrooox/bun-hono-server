/**
 * OpenAPI 路由配置
 * 定义所有 API 路由的 OpenAPI 规范信息
 */

import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema,
  updateUserSchema,
  changePasswordSchema
} from '../types/auth'

// 路由信息接口
interface RouteInfo {
  method: string
  path: string
  summary?: string
  description?: string
  tags?: string[]
  requestSchema?: any
  responseSchema?: any
  requiresAuth?: boolean
  rateLimit?: string
}

/**
 * 认证相关路由配置
 */
export const authRoutes: RouteInfo[] = [
  {
    method: 'post',
    path: '/api/auth/register',
    summary: '用户注册',
    description: '创建新用户账户',
    tags: ['认证'],
    requestSchema: registerSchema,
    responseSchema: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/UserResponse' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'integer' }
      }
    },
    rateLimit: 'auth'
  },
  {
    method: 'post',
    path: '/api/auth/login',
    summary: '用户登录',
    description: '用户登录获取访问令牌',
    tags: ['认证'],
    requestSchema: loginSchema,
    responseSchema: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/UserResponse' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'integer' }
      }
    },
    rateLimit: 'auth'
  },
  {
    method: 'get',
    path: '/api/auth/me',
    summary: '获取当前用户信息',
    description: '获取当前登录用户的详细信息',
    tags: ['认证'],
    responseSchema: { $ref: '#/components/schemas/UserResponse' },
    requiresAuth: true
  },
  {
    method: 'post',
    path: '/api/auth/refresh',
    summary: '刷新访问令牌',
    description: '使用刷新令牌获取新的访问令牌',
    tags: ['认证'],
    requestSchema: refreshTokenSchema,
    responseSchema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        expiresIn: { type: 'integer' }
      }
    }
  },
  {
    method: 'post',
    path: '/api/auth/logout',
    summary: '用户登出',
    description: '注销当前登录会话，撤销刷新令牌',
    tags: ['认证'],
    requestSchema: refreshTokenSchema,
    responseSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
]

/**
 * 用户管理相关路由配置
 */
export const userRoutes: RouteInfo[] = [
  {
    method: 'patch',
    path: '/api/users/me',
    summary: '更新用户信息',
    description: '更新当前登录用户的个人信息',
    tags: ['用户管理'],
    requestSchema: updateUserSchema,
    responseSchema: { $ref: '#/components/schemas/UserResponse' },
    requiresAuth: true,
    rateLimit: 'user'
  },
  {
    method: 'post',
    path: '/api/users/me/change-password',
    summary: '修改密码',
    description: '修改当前用户的登录密码',
    tags: ['用户管理'],
    requestSchema: changePasswordSchema,
    responseSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    requiresAuth: true,
    rateLimit: 'strict'
  }
]

/**
 * 文件上传相关路由配置
 */
export const uploadRoutes: RouteInfo[] = [
  {
    method: 'get',
    path: '/api/upload/config',
    summary: '获取上传配置',
    description: '获取文件上传的配置信息和限制',
    tags: ['文件上传'],
    responseSchema: {
      type: 'object',
      properties: {
        storageType: { type: 'string' },
        maxFileSize: { type: 'string' },
        allowedTypes: { type: 'array', items: { type: 'string' } },
        allowedExtensions: { type: 'array', items: { type: 'string' } },
        uploadPath: { type: 'string' }
      }
    }
  },
  {
    method: 'post',
    path: '/api/upload/single',
    summary: '单文件上传',
    description: '上传单个文件，支持图片处理选项',
    tags: ['文件上传'],
    requestSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        path: { type: 'string', description: '自定义上传路径' },
        overwrite: { type: 'boolean', description: '是否覆盖现有文件' },
        resize_width: { type: 'integer', description: '调整宽度' },
        resize_height: { type: 'integer', description: '调整高度' },
        quality: { type: 'integer', minimum: 1, maximum: 100, description: '压缩质量' },
        format: { type: 'string', enum: ['jpeg', 'png', 'webp'], description: '输出格式' }
      }
    },
    responseSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        originalName: { type: 'string' },
        filename: { type: 'string' },
        size: { type: 'integer' },
        mimeType: { type: 'string' },
        url: { type: 'string' },
        path: { type: 'string' },
        uploadedAt: { type: 'string', format: 'date-time' }
      }
    },
    requiresAuth: true,
    rateLimit: 'upload'
  },
  {
    method: 'delete',
    path: '/api/upload/{fileId}',
    summary: '删除文件',
    description: '删除指定的上传文件',
    tags: ['文件上传'],
    responseSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    requiresAuth: true
  }
]

/**
 * 缓存管理相关路由配置
 */
export const cacheRoutes: RouteInfo[] = [
  {
    method: 'get',
    path: '/api/cache/stats',
    summary: '获取缓存统计',
    description: '获取 Redis 缓存的统计信息',
    tags: ['缓存管理'],
    responseSchema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean' },
        uptime: { type: 'integer' },
        memory: { type: 'object' },
        clients: { type: 'integer' },
        keys: { type: 'integer' }
      }
    },
    requiresAuth: true
  },
  {
    method: 'post',
    path: '/api/cache/set',
    summary: '设置缓存',
    description: '设置键值对缓存数据',
    tags: ['缓存管理'],
    requestSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
        ttl: { type: 'integer', description: '过期时间（秒）' }
      },
      required: ['key', 'value']
    },
    responseSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' }
      }
    },
    requiresAuth: true
  },
  {
    method: 'get',
    path: '/api/cache/get/{key}',
    summary: '获取缓存',
    description: '根据键获取缓存值',
    tags: ['缓存管理'],
    responseSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
        ttl: { type: 'integer' }
      }
    },
    requiresAuth: true
  },
  {
    method: 'delete',
    path: '/api/cache/clear',
    summary: '清空缓存',
    description: '清空所有缓存数据',
    tags: ['缓存管理'],
    responseSchema: {
      type: 'object',
      properties: {
        cleared: { type: 'integer' }
      }
    },
    requiresAuth: true
  }
]

/**
 * 健康检查相关路由配置
 */
export const healthRoutes: RouteInfo[] = [
  {
    method: 'get',
    path: '/api/health',
    summary: '健康检查',
    description: '检查服务健康状态',
    tags: ['系统'],
    responseSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number' },
        version: { type: 'string' },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'string', enum: ['healthy', 'unhealthy'] },
            redis: { type: 'string', enum: ['healthy', 'unhealthy'] }
          }
        }
      }
    }
  },
  {
    method: 'get',
    path: '/api/ping',
    summary: 'Ping 检查',
    description: '简单的 ping 检查，返回 pong',
    tags: ['系统'],
    responseSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'pong' },
        timestamp: { type: 'integer' }
      }
    }
  }
]

/**
 * 所有路由配置
 */
export const allRoutes: RouteInfo[] = [
  ...authRoutes,
  ...userRoutes,
  ...uploadRoutes,
  ...cacheRoutes,
  ...healthRoutes
]