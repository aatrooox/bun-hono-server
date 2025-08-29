import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { 
  corsConfig, 
  loggerConfig, 
  responseMiddleware, 
  errorHandler,
  globalRateLimit,
  securityHeaders,
  requestSizeLimit
} from './middleware'
import api from './routes'
import { initDatabase } from './db/migrate'
import type { AppContext } from './types'
import { logger } from './utils/logger'
import { UploadTestPage } from './views/UploadTest'
import { Config } from './config'

// 创建 Hono 应用
const app = new Hono<AppContext>()

// 全局中间件（顺序很重要！）
app.use('*', corsConfig)          // CORS 必须在最前面
app.use('*', securityHeaders)     // 安全头部
app.use('*', requestSizeLimit())  // 请求大小限制
app.use('*', globalRateLimit)     // 全局限流
app.use('*', loggerConfig)        // 日志记录
app.use('*', responseMiddleware)  // 响应工具

// 设置错误处理
app.onError(errorHandler)

// 静态文件服务
app.use('/static/*', serveStatic({ root: './' }))
app.use('/favicon.ico', serveStatic({ path: './favicon.ico' }))

// 公共文件服务 (HTML测试页面等)
app.use('/public/*', serveStatic({ root: './' }))

// 上传文件访问（支持本地存储）
app.use('/uploads/*', serveStatic({ 
  root: './',
  rewriteRequestPath: (path) => {
    // 将 /uploads/* 路径重写为实际的上传目录路径
    return path.replace(/^\/uploads/, './uploads')
  }
}))

// API 路由
app.route('/api', api)

// 根路径
app.get('/', (c) => {
  return c.get('success')({
    message: 'Welcome to Bun Hono Server!',
    version: Config.APP_VERSION,
    api: '/api',
    health: '/api/health',
    uploadTest: '/test-upload',
    uploadTestJSX: '/test-upload-jsx'
  }, '服务器运行正常')
})

// 文件上传测试页面
app.get('/test-upload', (c) => {
  return c.redirect('/public/upload-test.html')
})

// JSX 版本的测试页面
app.get('/test-upload-jsx', (c) => {
  return c.html(UploadTestPage())
})

// 404 处理
app.notFound((c) => {
  return c.get('error')(404, '请求的资源不存在')
})

// 初始化数据库（启动时）
initDatabase()
  .then(() => {
    logger.info('Database initialized successfully')
  })
  .catch((error) => {
    logger.error({ error }, 'Database initialization failed')
    process.exit(1)
  })

// 启动日志
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
logger.info({
  port,
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug'
}, 'Server starting')

export default {
  port,
  fetch: app.fetch,
}
