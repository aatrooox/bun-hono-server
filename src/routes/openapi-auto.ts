/**
 * 自动 OpenAPI 规范路由
 * 提供基于自动发现的 OpenAPI JSON 规范访问端点
 */

import { Hono } from 'hono'
import { createAutoDiscoveryOpenAPIGenerator } from '../utils/openapi-generator'
import type { AppContext } from '../types'

const openapi = new Hono<AppContext>()

/**
 * 获取自动生成的 OpenAPI JSON 规范
 * 仅在开发环境可用，生产环境不支持
 */
openapi.get('/auto/openapi.json', async (c) => {
  // 检查环境变量，仅在开发环境启用
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined
  
  if (!isDevelopment) {
    return c.get('error')(403, '自动 OpenAPI 生成功能仅在开发环境可用')
  }
  
  try {
    const projectRoot = process.cwd()
    const generator = createAutoDiscoveryOpenAPIGenerator(projectRoot)
    
    // 执行自动发现
    await generator.autoDiscoverRoutes()
    
    // 生成 OpenAPI 规范
    const spec = generator.generate()
    
    c.header('Cache-Control', 'public, max-age=300') // 缓存5分钟
    return c.json(spec)
  } catch (error: any) {
    return c.get('error')(500, `自动生成 OpenAPI 规范失败: ${error.message}`)
  }
})

export default openapi