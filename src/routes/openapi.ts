/**
 * OpenAPI 规范路由
 * 提供 OpenAPI JSON 规范的访问端点
 */

import { Hono } from 'hono'
import { createOpenAPIGenerator } from '../utils/openapi-generator'
import { allRoutes } from '../config/openapi-routes'
import type { AppContext } from '../types'

const openapi = new Hono<AppContext>()

/**
 * 获取 OpenAPI JSON 规范
 */
openapi.get('/openapi.json', (c) => {
  try {
    const generator = createOpenAPIGenerator()
    
    // 添加所有路由
    allRoutes.forEach(route => {
      generator.addRoute(route)
    })
    
    // 生成 OpenAPI 规范
    const spec = generator.generate()
    
    return c.json(spec)
  } catch (error: any) {
    return c.get('error')(500, `生成 OpenAPI 规范失败: ${error.message}`)
  }
})

/**
 * 获取 OpenAPI 配置信息
 */
openapi.get('/info', (c) => {
  const info = {
    title: 'Bun Hono Server API',
    version: '1.0.0',
    description: '基于 Bun 和 Hono 构建的轻量级服务端 API',
    endpoints: {
      openapi: '/api/openapi/openapi.json',
      routes: allRoutes.length
    },
    tags: [...new Set(allRoutes.flatMap(route => route.tags || []))],
    authRequired: allRoutes.filter(route => route.requiresAuth).length,
    rateLimit: {
      auth: allRoutes.filter(route => route.rateLimit === 'auth').length,
      user: allRoutes.filter(route => route.rateLimit === 'user').length,
      upload: allRoutes.filter(route => route.rateLimit === 'upload').length,
      strict: allRoutes.filter(route => route.rateLimit === 'strict').length
    }
  }
  
  return c.get('success')(info, '获取 OpenAPI 配置信息成功')
})

/**
 * 生成并下载 OpenAPI JSON 文件
 */
openapi.get('/download', (c) => {
  try {
    const generator = createOpenAPIGenerator()
    
    // 添加所有路由
    allRoutes.forEach(route => {
      generator.addRoute(route)
    })
    
    // 生成格式化的 JSON
    const jsonContent = generator.generateJSON(true)
    
    // 设置下载响应头
    c.header('Content-Type', 'application/json')
    c.header('Content-Disposition', 'attachment; filename="openapi.json"')
    
    return c.text(jsonContent)
  } catch (error: any) {
    return c.get('error')(500, `生成 OpenAPI 文件失败: ${error.message}`)
  }
})

/**
 * 验证 OpenAPI 规范
 */
openapi.get('/validate', (c) => {
  try {
    const generator = createOpenAPIGenerator()
    
    // 添加所有路由
    allRoutes.forEach(route => {
      generator.addRoute(route)
    })
    
    const spec = generator.generate()
    
    // 基本验证
    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      stats: {
        paths: Object.keys(spec.paths).length,
        operations: Object.values(spec.paths).reduce((count, path: any) => {
          return count + Object.keys(path).length
        }, 0),
        schemas: Object.keys(spec.components.schemas).length,
        tags: [...new Set(allRoutes.flatMap(route => route.tags || []))].length
      }
    }
    
    // 检查必需字段
    if (!spec.info.title) {
      validation.errors.push('Missing required field: info.title')
      validation.valid = false
    }
    
    if (!spec.info.version) {
      validation.errors.push('Missing required field: info.version')
      validation.valid = false
    }
    
    if (Object.keys(spec.paths).length === 0) {
      validation.warnings.push('No paths defined')
    }
    
    return c.get('success')(validation, '规范验证完成')
  } catch (error: any) {
    return c.get('error')(500, `验证 OpenAPI 规范失败: ${error.message}`)
  }
})

export default openapi