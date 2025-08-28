import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import auth from './auth'
import users from './users'

// 创建 API 路由器
const api = new Hono()

// 启用 JSON 格式化
api.use('*', prettyJSON())

// API 根路径
api.get('/', (c) => {
  return c.get('success')({
    name: 'Bun Hono Server API',
    version: '1.0.0',
    description: 'A fast and modern web server built with Bun and Hono',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users'
    }
  }, 'API 服务正常运行')
})

// 健康检查
api.get('/health', (c) => {
  return c.get('success')({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  }, '服务健康状态正常')
})

// 注册子路由
api.route('/auth', auth)
api.route('/users', users)

export default api