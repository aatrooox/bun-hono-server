/**
 * 自动路由发现系统
 * 基于文件扫描和AST解析自动生成OpenAPI文档
 */

import { readdir, readFile, stat } from 'fs/promises'
import { join, extname, relative } from 'path'
import { z } from 'zod'
import type { RouteMetadata } from './openapi-generator'

interface ParsedRoute {
  method: string
  path: string
  middlewares: string[]
  validatorSchema?: string
  summary?: string
  description?: string
  tags?: string[]
}

interface FileAnalysis {
  filePath: string
  routes: ParsedRoute[]
  schemas: Record<string, string>
  exports: string[]
}

/**
 * 路由发现器 - 通过静态分析自动发现路由
 */
export class RouteDiscovery {
  private projectRoot: string
  private routesDir: string
  private schemasCache: Map<string, any> = new Map()

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
    this.routesDir = join(projectRoot, 'src/routes')
  }

  /**
   * 扫描所有路由文件并生成路由元数据
   */
  async discoverRoutes(): Promise<RouteMetadata[]> {
    const routeFiles = await this.findRouteFiles()
    const allRoutes: RouteMetadata[] = []

    for (const filePath of routeFiles) {
      try {
        const analysis = await this.analyzeRouteFile(filePath)
        const routes = await this.parseRoutesFromAnalysis(analysis)
        allRoutes.push(...routes)
      } catch (error) {
        console.warn(`跳过文件 ${filePath}: ${error}`)
      }
    }

    return allRoutes
  }

  /**
   * 查找所有路由文件
   */
  private async findRouteFiles(): Promise<string[]> {
    const files: string[] = []
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir)
        
        for (const entry of entries) {
          const fullPath = join(dir, entry)
          const stats = await stat(fullPath)
          
          if (stats.isDirectory()) {
            await scanDirectory(fullPath)
          } else if (stats.isFile() && this.isRouteFile(fullPath)) {
            files.push(fullPath)
          }
        }
      } catch (error) {
        // 目录不存在或无法访问，跳过
      }
    }

    await scanDirectory(this.routesDir)
    return files
  }

  /**
   * 判断是否是路由文件
   */
  private isRouteFile(filePath: string): boolean {
    const ext = extname(filePath)
    const basename = filePath.split('/').pop() || ''
    
    return (ext === '.ts' || ext === '.js') && 
           !basename.includes('.test.') && 
           !basename.includes('.spec.') &&
           basename !== 'index.ts' &&
           basename !== 'index.js'
  }

  /**
   * 分析单个路由文件
   */
  private async analyzeRouteFile(filePath: string): Promise<FileAnalysis> {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = relative(this.projectRoot, filePath)
    
    return {
      filePath: relativePath,
      routes: this.extractRoutesFromContent(content),
      schemas: this.extractSchemasFromContent(content),
      exports: this.extractExportsFromContent(content)
    }
  }

  /**
   * 从文件内容中提取路由信息
   */
  private extractRoutesFromContent(content: string): ParsedRoute[] {
    const routes: ParsedRoute[] = []
    
    // 匹配路由定义的正则表达式
    const routePatterns = [
      // app.get('/path', handler)
      /(\w+)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*([^)]*)\s*,\s*([^)]+)\)/g,
      // app.get('/path', middleware, handler)
      /(\w+)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,]+)\s*,\s*([^)]+)\)/g
    ]

    for (const pattern of routePatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const [, appVar, method, path, ...middlewareAndHandler] = match
        
        const route: ParsedRoute = {
          method: method.toLowerCase(),
          path: this.normalizePath(path),
          middlewares: this.extractMiddlewaresFromMatch(middlewareAndHandler),
          ...this.extractRouteMetadataFromComments(content, match.index)
        }

        routes.push(route)
      }
    }

    return routes
  }

  /**
   * 从匹配结果中提取中间件
   */
  private extractMiddlewaresFromMatch(middlewareAndHandler: string[]): string[] {
    const middlewares: string[] = []
    
    // 简单的中间件提取逻辑
    const middlewareText = middlewareAndHandler.join(',')
    
    // 常见中间件模式
    const middlewarePatterns = [
      'authMiddleware',
      'adminMiddleware', 
      'authRateLimit',
      'userRateLimit',
      'strictRateLimit',
      'uploadRateLimit',
      'zValidator'
    ]

    for (const pattern of middlewarePatterns) {
      if (middlewareText.includes(pattern)) {
        middlewares.push(pattern)
      }
    }

    return middlewares
  }

  /**
   * 从注释中提取路由元数据
   */
  private extractRouteMetadataFromComments(content: string, routeIndex: number): Partial<ParsedRoute> {
    // 查找路由定义前的注释
    const beforeRoute = content.substring(0, routeIndex)
    const lines = beforeRoute.split('\n')
    
    let summary: string | undefined
    let description: string | undefined
    let tags: string[] | undefined

    // 从最后几行注释中提取信息
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const line = lines[i].trim()
      
      if (line.startsWith('/**') || line.startsWith('/*')) {
        break
      }
      
      if (line.startsWith('*') || line.startsWith('//')) {
        const comment = line.replace(/^[\*\/\s]+/, '').trim()
        
        if (comment && !summary) {
          summary = comment
        } else if (comment && !description) {
          description = comment
        }
      }
    }

    return { summary, description, tags }
  }

  /**
   * 从文件内容中提取Schema定义
   */
  private extractSchemasFromContent(content: string): Record<string, string> {
    const schemas: Record<string, string> = {}
    
    // 匹配 Zod schema 定义
    const schemaPattern = /export\s+const\s+(\w+Schema)\s*=\s*z\.([\s\S]*?)(?=\n\s*(?:export|const|function|class|$))/g
    
    let match
    while ((match = schemaPattern.exec(content)) !== null) {
      const [, schemaName, schemaDefinition] = match
      schemas[schemaName] = `z.${schemaDefinition.trim()}`
    }

    return schemas
  }

  /**
   * 从文件内容中提取导出信息
   */
  private extractExportsFromContent(content: string): string[] {
    const exports: string[] = []
    
    // 匹配导出语句
    const exportPatterns = [
      /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
      /export\s*{\s*([^}]+)\s*}/g,
      /export\s+default\s+(\w+)/g
    ]

    for (const pattern of exportPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const exported = match[1]
        if (exported.includes(',')) {
          // 处理 export { a, b, c } 的情况
          const items = exported.split(',').map(item => item.trim())
          exports.push(...items)
        } else {
          exports.push(exported)
        }
      }
    }

    return exports
  }

  /**
   * 从分析结果生成路由元数据
   */
  private async parseRoutesFromAnalysis(analysis: FileAnalysis): Promise<RouteMetadata[]> {
    const basePathFromFile = this.extractBasePathFromFile(analysis.filePath)
    const moduleTag = this.extractModuleTagFromFile(analysis.filePath)
    
    return analysis.routes.map(route => {
      const fullPath = this.combineApiPath(basePathFromFile, route.path)
      
      return {
        method: route.method,
        path: fullPath,
        summary: route.summary || this.generateDefaultSummary(route.method, fullPath),
        description: route.description || this.generateDefaultDescription(route.method, fullPath),
        tags: route.tags || [moduleTag],
        requestSchema: this.resolveRequestSchema(route, analysis),
        responseSchema: this.generateDefaultResponseSchema(),
        requiresAuth: this.hasAuthMiddleware(route.middlewares),
        adminOnly: this.hasAdminMiddleware(route.middlewares),
        rateLimit: this.extractRateLimitFromMiddlewares(route.middlewares)
      }
    })
  }

  /**
   * 从文件路径提取基础路径
   */
  private extractBasePathFromFile(filePath: string): string {
    const pathSegments = filePath.split('/')
    const filename = pathSegments[pathSegments.length - 1].replace(/\.(ts|js)$/, '')
    
    // 特殊处理一些常见的文件名
    if (filename === 'auth') return 'auth'
    if (filename === 'users') return 'users'
    if (filename === 'upload') return 'upload'
    if (filename === 'cache') return 'cache'
    if (filename === 'health') return 'health'
    
    return filename
  }

  /**
   * 从文件路径提取模块标签
   */
  private extractModuleTagFromFile(filePath: string): string {
    const filename = this.extractBasePathFromFile(filePath)
    
    const tagMap: Record<string, string> = {
      'auth': '认证',
      'users': '用户管理', 
      'upload': '文件上传',
      'cache': '缓存管理',
      'health': '系统健康'
    }
    
    return tagMap[filename] || filename
  }

  /**
   * 组合完整的API路径
   */
  private combineApiPath(basePath: string, routePath: string): string {
    return `/api/${basePath}${routePath.startsWith('/') ? routePath : '/' + routePath}`
  }

  /**
   * 解析请求Schema
   */
  private resolveRequestSchema(route: ParsedRoute, analysis: FileAnalysis): any {
    // 查找zValidator中间件中的schema
    const validatorMiddleware = route.middlewares.find(m => m.includes('zValidator'))
    if (validatorMiddleware) {
      // 这里需要更复杂的解析逻辑
      // 暂时返回一个通用schema
      return { type: 'object' }
    }
    
    return undefined
  }

  /**
   * 检查是否有认证中间件
   */
  private hasAuthMiddleware(middlewares: string[]): boolean {
    return middlewares.some(m => m.includes('authMiddleware'))
  }

  /**
   * 检查是否有管理员中间件
   */
  private hasAdminMiddleware(middlewares: string[]): boolean {
    return middlewares.some(m => m.includes('adminMiddleware'))
  }

  /**
   * 从中间件中提取限流类型
   */
  private extractRateLimitFromMiddlewares(middlewares: string[]): string | undefined {
    if (middlewares.some(m => m.includes('authRateLimit'))) return 'auth'
    if (middlewares.some(m => m.includes('userRateLimit'))) return 'user'
    if (middlewares.some(m => m.includes('strictRateLimit'))) return 'strict'
    if (middlewares.some(m => m.includes('uploadRateLimit'))) return 'upload'
    return undefined
  }

  /**
   * 生成默认摘要
   */
  private generateDefaultSummary(method: string, path: string): string {
    const action = this.getActionFromMethod(method)
    const resource = this.getResourceFromPath(path)
    return `${action}${resource}`
  }

  /**
   * 生成默认描述
   */
  private generateDefaultDescription(method: string, path: string): string {
    return this.generateDefaultSummary(method, path)
  }

  /**
   * 根据HTTP方法获取操作类型
   */
  private getActionFromMethod(method: string): string {
    const actionMap: Record<string, string> = {
      'get': '获取',
      'post': '创建', 
      'put': '更新',
      'patch': '修改',
      'delete': '删除'
    }
    return actionMap[method.toLowerCase()] || '操作'
  }

  /**
   * 从路径获取资源名称
   */
  private getResourceFromPath(path: string): string {
    const segments = path.split('/').filter(Boolean)
    if (segments.length >= 2) {
      const resource = segments[segments.length - 1]
      // 处理参数路径
      if (resource.startsWith(':') || (resource.startsWith('{') && resource.endsWith('}'))) {
        return segments[segments.length - 2] || '资源'
      }
      return resource
    }
    return '资源'
  }

  /**
   * 生成默认响应Schema
   */
  private generateDefaultResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        code: { type: 'integer', example: 200 },
        message: { type: 'string', example: 'Success' },
        data: { type: 'object' },
        timestamp: { type: 'integer', example: Date.now() }
      }
    }
  }

  /**
   * 规范化路径
   */
  private normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }
}

/**
 * 创建路由发现器实例
 */
export function createRouteDiscovery(projectRoot: string): RouteDiscovery {
  return new RouteDiscovery(projectRoot)
}