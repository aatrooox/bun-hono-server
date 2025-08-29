import { Hono } from 'hono'
import { cache } from '../cache/middleware'
import { RedisUtils } from '../cache/redis'
import type { AppContext } from '../types'

// 创建缓存示例路由
const cacheExample = new Hono<AppContext>()

/**
 * 缓存示例 - 自动缓存
 */
cacheExample.get(
  '/auto/:id',
  cache({
    ttl: 300, // 5分钟缓存
    keyPrefix: 'example:auto:',
    tags: ['examples', 'auto-cache'],
  }),
  async (c) => {
    const id = c.req.param('id')
    
    // 模拟数据库查询延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const data = {
      id,
      name: `Example Item ${id}`,
      value: Math.random() * 1000,
      timestamp: new Date().toISOString(),
      cached: false, // 首次查询
    }
    
    return c.get('success')(data, '数据获取成功（已自动缓存）')
  }
)

/**
 * 手动缓存示例
 */
cacheExample.get('/manual/:key', async (c) => {
  const key = c.req.param('key')
  const cacheKey = `manual:${key}`
  
  try {
    // 尝试从缓存获取
    let data = await RedisUtils.get(cacheKey)
    
    if (data) {
      // 缓存命中
      c.header('X-Cache', 'HIT')
      return c.get('success')({
        ...data,
        cached: true,
      }, '数据来自缓存')
    }
    
    // 缓存未命中，生成新数据
    data = {
      key,
      value: `Generated at ${new Date().toISOString()}`,
      randomNumber: Math.floor(Math.random() * 10000),
      cached: false,
    }
    
    // 存储到缓存（60秒）
    await RedisUtils.set(cacheKey, data, 60)
    
    c.header('X-Cache', 'MISS')
    return c.get('success')(data, '数据已生成并缓存')
    
  } catch (error) {
    return c.get('error')(500, '缓存操作失败')
  }
})

/**
 * 缓存计数器示例
 */
cacheExample.post('/counter/:name/increment', async (c) => {
  const name = c.req.param('name')
  const cacheKey = `counter:${name}`
  
  try {
    const newValue = await RedisUtils.incr(cacheKey)
    
    // 设置过期时间（如果是第一次创建）
    if (newValue === 1) {
      await RedisUtils.expire(cacheKey, 3600) // 1小时后过期
    }
    
    return c.get('success')({
      counter: name,
      value: newValue,
      ttl: await RedisUtils.ttl(cacheKey),
    }, '计数器递增成功')
    
  } catch (error) {
    return c.get('error')(500, '计数器操作失败')
  }
})

/**
 * 缓存统计信息
 */
cacheExample.get('/stats', async (c) => {
  try {
    const stats = {
      redisConnected: await RedisUtils.exists('test:connection') || true,
      cacheExamples: {
        autoCache: {
          description: 'GET /cache/auto/:id - 自动缓存示例',
          ttl: 300,
          tags: ['examples', 'auto-cache'],
        },
        manualCache: {
          description: 'GET /cache/manual/:key - 手动缓存示例',
          ttl: 60,
        },
        counter: {
          description: 'POST /cache/counter/:name/increment - 计数器示例',
          ttl: 3600,
        },
      },
      operations: {
        clearCache: 'DELETE /cache/clear/:key - 清除单个缓存',
        clearByTag: 'DELETE /cache/clear-tag/:tag - 按标签清除缓存',
      },
    }
    
    return c.get('success')(stats, '缓存统计信息')
    
  } catch (error) {
    return c.get('error')(500, '获取统计信息失败')
  }
})

/**
 * 清除单个缓存
 */
cacheExample.delete('/clear/:key', async (c) => {
  const key = c.req.param('key')
  
  try {
    const deleted = await RedisUtils.del(key)
    
    if (deleted) {
      return c.get('success')({ key, deleted: true }, '缓存清除成功')
    } else {
      return c.get('success')({ key, deleted: false }, '缓存不存在或已过期')
    }
    
  } catch (error) {
    return c.get('error')(500, '清除缓存失败')
  }
})

/**
 * 哈希缓存示例
 */
cacheExample.put('/hash/:key/:field', async (c) => {
  const key = c.req.param('key')
  const field = c.req.param('field')
  
  try {
    const body = await c.req.json()
    const success = await RedisUtils.hset(key, field, body)
    
    if (success) {
      return c.get('success')({ key, field, value: body }, '哈希字段设置成功')
    } else {
      return c.get('error')(500, '哈希字段设置失败')
    }
    
  } catch (error) {
    return c.get('error')(400, '请求参数错误')
  }
})

/**
 * 获取哈希字段
 */
cacheExample.get('/hash/:key/:field', async (c) => {
  const key = c.req.param('key')
  const field = c.req.param('field')
  
  try {
    const value = await RedisUtils.hget(key, field)
    
    if (value !== null) {
      return c.get('success')({ key, field, value }, '哈希字段获取成功')
    } else {
      return c.get('error')(404, '哈希字段不存在')
    }
    
  } catch (error) {
    return c.get('error')(500, '获取哈希字段失败')
  }
})

/**
 * 获取整个哈希表
 */
cacheExample.get('/hash/:key', async (c) => {
  const key = c.req.param('key')
  
  try {
    const hash = await RedisUtils.hgetall(key)
    
    if (hash) {
      return c.get('success')({ key, fields: hash }, '哈希表获取成功')
    } else {
      return c.get('error')(404, '哈希表不存在')
    }
    
  } catch (error) {
    return c.get('error')(500, '获取哈希表失败')
  }
})

/**
 * 队列操作示例
 */
cacheExample.post('/queue/:name/push', async (c) => {
  const name = c.req.param('name')
  const queueKey = `queue:${name}`
  
  try {
    const body = await c.req.json()
    const length = await RedisUtils.lpush(queueKey, {
      ...body,
      timestamp: new Date().toISOString(),
    })
    
    return c.get('success')({
      queue: name,
      length,
      pushed: body,
    }, '消息推送成功')
    
  } catch (error) {
    return c.get('error')(400, '队列推送失败')
  }
})

/**
 * 从队列弹出消息
 */
cacheExample.post('/queue/:name/pop', async (c) => {
  const name = c.req.param('name')
  const queueKey = `queue:${name}`
  
  try {
    const message = await RedisUtils.rpop(queueKey)
    
    if (message) {
      const length = await RedisUtils.llen(queueKey)
      return c.get('success')({
        queue: name,
        message,
        remainingLength: length,
      }, '消息弹出成功')
    } else {
      return c.get('error')(404, '队列为空')
    }
    
  } catch (error) {
    return c.get('error')(500, '队列弹出失败')
  }
})

export default cacheExample