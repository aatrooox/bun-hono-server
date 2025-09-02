import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import auth from './auth'
import users from './users'
import upload from './upload'
import health from './health'
import cache from './cache'

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
      users: '/api/users',
      upload: '/api/upload',
      health: '/api/health',
      cache: '/api/cache'
    }
  }, 'API 服务正常运行')
})

// 注册子路由
api.route('/auth', auth)
api.route('/users', users)
api.route('/upload', upload)
api.route('/health', health)
api.route('/cache', cache)

export default api