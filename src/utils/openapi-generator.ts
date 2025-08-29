/**
 * OpenAPI 规范生成器
 * 基于现有的 Zod Schema 和路由结构自动生成 OpenAPI JSON
 */

import { z } from 'zod'
import packageJson from '../../package.json'

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

// 路由信息接口
interface RouteInfo {
  method: string
  path: string
  summary?: string
  description?: string
  tags?: string[]
  requestSchema?: z.ZodSchema
  responseSchema?: any
  requiresAuth?: boolean
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
            case 'int':
              result.type = 'integer'
              break
            case 'min':
              result.minimum = check.value
              break
            case 'max':
              result.maximum = check.value
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
        
        // 检查是否必填
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

      // 如果有名称，保存到 schemas
      if (name) {
        this.schemas[name] = result
        return { $ref: `#/components/schemas/${name}` }
      }

      return result
    }

    if (schema instanceof z.ZodOptional) {
      return this.convert(schema._def.innerType)
    }

    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema._def.values
      }
    }

    // 默认返回
    return { type: 'string' }
  }

  getSchemas(): Record<string, any> {
    return this.schemas
  }
}

/**
 * OpenAPI 生成器
 */
export class OpenAPIGenerator {
  private spec: OpenAPISpec
  private converter = new ZodToOpenAPIConverter()

  constructor(
    title: string = 'API Documentation',
    version: string = '1.0.0',
    description?: string
  ) {
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
   * 添加路由信息
   */
  addRoute(routeInfo: RouteInfo) {
    const { method, path, summary, description, tags, requestSchema, responseSchema, requiresAuth } = routeInfo

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
        // Query parameters
        const schema = this.converter.convert(requestSchema)
        if (schema.properties) {
          operation.parameters = Object.entries(schema.properties).map(([name, prop]: any) => ({
            name,
            in: 'query',
            required: schema.required?.includes(name) || false,
            schema: prop
          }))
        }
      } else {
        // Request body
        const schemaName = `${method}${path.replace(/[\/\{\}:]/g, '')}Request`
        const schema = this.converter.convert(requestSchema, schemaName)
        
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema
            }
          }
        }
      }
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
                data: responseSchema ? this.converter.convert(responseSchema) : { type: 'object' },
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

    this.spec.paths[path][method.toLowerCase()] = operation
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
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      },
      required: ['id', 'email', 'name', 'status', 'createdAt', 'updatedAt']
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
 * 创建默认的 OpenAPI 生成器实例
 */
export function createOpenAPIGenerator() {
  return new OpenAPIGenerator(
    'Bun Hono Server API',
    packageJson.version,
    '基于 Bun 和 Hono 构建的轻量级服务端 API'
  )
}