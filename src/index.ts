import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { 
  corsConfig, 
  loggerConfig, 
  responseMiddleware, 
  errorMiddleware 
} from './middleware'
import api from './routes'
import { initDatabase } from './db/migrate'
import type { AppContext } from './types'

// 创建 Hono 应用
const app = new Hono<AppContext>()

// 全局中间件（顺序很重要！）
app.use('*', corsConfig)          // CORS 必须在最前面
app.use('*', loggerConfig)        // 日志记录
app.use('*', responseMiddleware)  // 响应工具

// 设置错误处理
app.onError(async (err, c) => {
  console.error('🚨 全局错误:', err)
  
  // 处理 Zod 验证错误
  if (err.name === 'ZodError' || (err as any).issues) {
    const zodError = err as any
    const messages = zodError.issues?.map((issue: any) => 
      `${issue.path?.join?.('.') || 'field'}: ${issue.message}`
    ).join(', ') || '参数验证失败'
    
    return c.get('error')(422, messages)
  }
  
  // 其他错误使用默认处理
  return c.get('error')(500, '服务器内部错误')
})

// 静态文件服务
app.use('/static/*', serveStatic({ root: './' }))
app.use('/favicon.ico', serveStatic({ path: './favicon.ico' }))

// API 路由
app.route('/api', api)

// 根路径
app.get('/', (c) => {
  return c.get('success')({
    message: 'Welcome to Bun Hono Server!',
    version: '1.0.0',
    docs: '/api',
    health: '/api/health'
  }, '服务器运行正常')
})

// 404 处理
app.notFound((c) => {
  return c.get('error')(404, '请求的资源不存在')
})

// 初始化数据库（启动时）
initDatabase().catch(console.error)

export default {
  port: 3000,
  fetch: app.fetch,
}
