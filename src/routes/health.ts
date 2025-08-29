import { Hono } from 'hono'
import type { AppContext } from '../types'
import { checkRedisHealth } from '../cache/redis'
import { db } from '../db'
import { sql } from 'drizzle-orm'
import { Config } from '../config'

// 创建健康检查路由器
const health = new Hono<AppContext>()

// 基础健康检查
health.get('/', async (c) => {
  const memoryUsage = process.memoryUsage()
  
  // 检查各项服务状态
  const checks = {
    redis: await checkRedisHealth(),
    database: await checkDatabaseHealth(),
  }
  
  const allHealthy = Object.values(checks).every(Boolean)
  const status = allHealthy ? 'healthy' : 'degraded'
  
  const healthData = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    environment: process.env.NODE_ENV || 'development',
    version: Config.APP_VERSION,
    services: checks,
  }
  
  return c.get('success')(healthData, `服务状态: ${status}`)
})

// 详细的系统信息
health.get('/system', (c) => {
  const memoryUsage = process.memoryUsage()
  
  return c.get('success')({
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      bunVersion: process.versions.bun || 'N/A',
    },
    process: {
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      cwd: process.cwd(),
    },
    memory: memoryUsage,
  }, '系统信息获取成功')
})

// 数据库健康检查
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // 执行简单查询测试连接
    await db.run(sql`SELECT 1`)
    return true
  } catch (error) {
    return false
  }
}

export default health