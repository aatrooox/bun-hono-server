/**
 * OpenAPI 规范生成器
 * 基于自动路由发现生成 OpenAPI JSON
 */

import { z } from 'zod'
import packageJson from '../../package.json'
import { createRouteDiscovery } from './route-discovery'

// OpenAPI 基础结构
interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  servers: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, any>
  components: {
    schemas: Record<string, any>
    securitySchemes?: Record<string, any>
  }
  security?: Array<Record<string, string[]>>
}

// 路由元数据接口
export interface RouteMetadata {
  method: string
  path: string
  summary?: string
  description?: string
  tags?: string[]
  requestSchema?: any
  responseSchema?: any
  requiresAuth?: boolean
  adminOnly?: boolean
  rateLimit?: string
}

/**
 * Zod Schema 转 OpenAPI Schema
 */
class ZodToOpenAPIConverter {
  private schemas: Record<string, any> = {}

  convert(schema: z.ZodSchema, name?: string): any {
    if (schema instanceof z.ZodString) {
      const result: any = { type: 'string' }
      
      // 处理字符串验证规则
      if (schema._def.checks) {
        for (const check of schema._def.checks) {
          switch (check.kind) {
            case 'email':
              result.format = 'email'
              break
            case 'min':
              result.minLength = check.value
              break
            case 'max':
              result.maxLength = check.value
              break
            case 'regex':
              result.pattern = check.regex.source
              break
          }
        }
      }
      
      return result
    }

    if (schema instanceof z.ZodNumber) {
      const result: any = { type: 'number' }
      
      if (schema._def.checks) {
        for (const check of schema._def.checks) {
          switch (check.kind) {
            case 'min':
              result.minimum = check.value
              break
            case 'max':
              result.maximum = check.value
              break
            case 'int':
              result.type = 'integer'
              break
          }
        }
      }
      
      return result
    }

    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' }
    }

    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.convert(schema._def.type)
      }
    }

    if (schema instanceof z.ZodObject) {
      const properties: Record<string, any> = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(schema.shape)) {
        properties[key] = this.convert(value as z.ZodSchema)
        
        // 检查是否为必需字段
        if (!(value as any).isOptional()) {
          required.push(key)
        }
      }

      const result: any = {
        type: 'object',
        properties
      }

      if (required.length > 0) {
        result.required = required
      }

      // 如果提供了名称，存储 schema
      if (name) {
        this.schemas[name] = result
        return { $ref: `#/components/schemas/${name}` }
      }

      return result
    }

    if (schema instanceof z.ZodOptional) {
      return this.convert(schema._def.innerType)
    }

    if (schema instanceof z.ZodNullable) {
      const innerSchema = this.convert(schema._def.innerType)
      return {
        ...innerSchema,
        nullable: true
      }
    }

    // 默认返回通用对象
    return { type: 'object' }
  }

  getSchemas(): Record<string, any> {
    return this.schemas
  }
}

/**
 * OpenAPI 生成器
 * 仅支持自动路由发现模式
 */
export class OpenAPIGenerator {
  private spec: OpenAPISpec
  private converter = new ZodToOpenAPIConverter()
  private projectRoot: string

  constructor(
    title: string = 'API Documentation',
    version: string = '1.0.0',
    description?: string,
    projectRoot: string = process.cwd()
  ) {
    this.projectRoot = projectRoot
    
    this.spec = {
      openapi: '3.0.3',
      info: {
        title,
        version,
        description
      },
      servers: [
        {
          url: 'http://localhost:4778',
          description: 'Development server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: []
    }
  }

  /**
   * 自动发现并添加路由
   */
  async autoDiscoverRoutes(): Promise<void> {
    const discovery = createRouteDiscovery(this.projectRoot)
    const routes = await discovery.discoverRoutes()
    
    console.log(`🔍 自动发现到 ${routes.length} 个路由`)
    
    routes.forEach(route => {
      this.addRouteFromMetadata(route)
    })
  }

  /**
   * 从路由元数据添加路由
   */
  private addRouteFromMetadata(routeMetadata: RouteMetadata) {
    const { method, path, summary, description, tags, requestSchema, responseSchema, requiresAuth, adminOnly } = routeMetadata

    // 初始化路径
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {}
    }

    // 构建操作对象
    const operation: any = {
      summary: summary || `${method.toUpperCase()} ${path}`,
      description,
      tags: tags || ['Default']
    }

    // 处理请求参数
    if (requestSchema) {
      if (method === 'get' || method === 'delete') {
        // GET/DELETE 请求的参数通常在 URL 中
        const schema = typeof requestSchema === 'object' ? requestSchema : this.converter.convert(requestSchema)
        if (schema.properties) {
          operation.parameters = Object.entries(schema.properties).map(([name, prop]: any) => ({
            name,
            in: 'query',
            required: schema.required?.includes(name) || false,
            schema: prop
          }))
        }
      } else {
        // POST/PUT/PATCH 请求的参数通常在 body 中
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: typeof requestSchema === 'object' ? requestSchema : this.converter.convert(requestSchema)
            }
          }
        }
      }
    }

    // 处理路径参数
    const pathParams = this.extractPathParameters(path)
    if (pathParams.length > 0) {
      if (!operation.parameters) operation.parameters = []
      operation.parameters.push(...pathParams)
    }

    // 处理响应
    operation.responses = {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                code: { type: 'integer', example: 200 },
                message: { type: 'string', example: 'Success' },
                data: responseSchema ? (typeof responseSchema === 'object' ? responseSchema : this.converter.convert(responseSchema)) : { type: 'object' },
                timestamp: { type: 'integer', example: Date.now() }
              }
            }
          }
        }
      },
      '400': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      '500': {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      }
    }

    // 安全认证
    if (requiresAuth) {
      operation.security = [{ BearerAuth: [] }]
    }

    // 添加管理员标记
    if (adminOnly) {
      operation['x-admin-only'] = true
      if (!operation.description) {
        operation.description = '需要管理员权限'
      } else {
        operation.description += ' (需要管理员权限)'
      }
    }

    this.spec.paths[path][method.toLowerCase()] = operation
  }

  /**
   * 提取路径参数
   */
  private extractPathParameters(path: string): any[] {
    const params: any[] = []
    const paramMatches = path.match(/\{([^}]+)\}/g)
    
    if (paramMatches) {
      paramMatches.forEach(match => {
        const paramName = match.slice(1, -1) // 移除 { }
        params.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: `${paramName} 参数`
        })
      })
    }
    
    return params
  }

  /**
   * 添加通用 schemas
   */
  private addCommonSchemas() {
    // 错误响应
    this.spec.components.schemas.ErrorResponse = {
      type: 'object',
      properties: {
        code: { type: 'integer' },
        message: { type: 'string' },
        timestamp: { type: 'integer' }
      },
      required: ['code', 'message', 'timestamp']
    }

    // 用户信息
    this.spec.components.schemas.UserResponse = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        nickname: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        gender: { type: 'integer', nullable: true },
        birthday: { type: 'string', nullable: true },
        bio: { type: 'string', nullable: true },
        status: { type: 'integer' },
        role: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      },
      required: ['id', 'email', 'name', 'status', 'role', 'createdAt', 'updatedAt']
    }

    // 登录响应
    this.spec.components.schemas.LoginResponse = {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/UserResponse' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'integer' }
      },
      required: ['user', 'accessToken', 'refreshToken', 'expiresIn']
    }
  }

  /**
   * 生成完整的 OpenAPI 规范
   */
  generate(): OpenAPISpec {
    // 添加通用 schemas
    this.addCommonSchemas()
    
    // 合并转换器生成的 schemas
    this.spec.components.schemas = {
      ...this.spec.components.schemas,
      ...this.converter.getSchemas()
    }

    return this.spec
  }

  /**
   * 生成 JSON 字符串
   */
  generateJSON(pretty: boolean = true): string {
    const spec = this.generate()
    return pretty ? JSON.stringify(spec, null, 2) : JSON.stringify(spec)
  }
}

/**
 * 创建支持自动发现的 OpenAPI 生成器
 */
export function createAutoDiscoveryOpenAPIGenerator(projectRoot: string) {
  return new OpenAPIGenerator(
    'Bun Hono Server API',
    packageJson.version,
    '基于 Bun 和 Hono 构建的轻量级服务端 API - 自动生成',
    projectRoot
  )
}