import { createMiddleware } from 'hono/factory'
import { RedisUtils } from './redis'
import { logger } from '../utils/logger'
import type { Context } from 'hono'
import type { AppContext } from '../types'

// 缓存选项接口
export interface CacheOptions {
  // 缓存时间（秒）
  ttl: number
  // 缓存键前缀
  keyPrefix?: string
  // 自定义键生成函数
  keyGenerator?: (c: Context) => string
  // 是否缓存错误响应
  cacheErrors?: boolean
  // 仅缓存特定状态码
  statusCodes?: number[]
  // 跳过缓存的条件
  skip?: (c: Context) => boolean
  // 缓存标签（用于批量清除）
  tags?: string[]
}

// 默认缓存选项
const defaultOptions: Partial<CacheOptions> = {
  ttl: 300, // 5分钟
  keyPrefix: 'cache:',
  cacheErrors: false,
  statusCodes: [200],
}

/**
 * 生成缓存键
 */
function generateCacheKey(c: Context, options: CacheOptions): string {
  if (options.keyGenerator) {
    return options.keyPrefix + options.keyGenerator(c)
  }

  const url = new URL(c.req.url)
  const method = c.req.method
  const path = url.pathname
  const query = url.search

  return `${options.keyPrefix}${method}:${path}${query}`
}

/**
 * 缓存中间件
 */
export const cache = (options: CacheOptions) => {
  const opts = { ...defaultOptions, ...options } as Required<CacheOptions>

  return createMiddleware<AppContext>(async (c, next) => {
    // 检查是否跳过缓存
    if (opts.skip && opts.skip(c)) {
      await next()
      return
    }

    // 只缓存 GET 请求
    if (c.req.method !== 'GET') {
      await next()
      return
    }

    const cacheKey = generateCacheKey(c, opts)

    try {
      // 尝试从缓存获取
      const cached = await RedisUtils.get(cacheKey)
      if (cached) {
        logger.debug({ key: cacheKey }, 'Cache hit')
        
        // 添加缓存命中头部
        c.header('X-Cache', 'HIT')
        c.header('X-Cache-Key', cacheKey)
        
        return new Response(cached.body, {
          status: cached.status,
          headers: cached.headers,
        })
      }

      logger.debug({ key: cacheKey }, 'Cache miss')
      
      // 执行原始处理器
      await next()

      // 检查是否应该缓存响应
      const shouldCache = 
        opts.statusCodes.includes(c.res.status) &&
        (opts.cacheErrors || c.res.status < 400)

      if (shouldCache) {
        // 克隆响应进行缓存
        const responseClone = c.res.clone()
        const body = await responseClone.text()
        
        const cacheData: any = {
          status: c.res.status,
          headers: Object.fromEntries(c.res.headers.entries()),
          body: body,
          cachedAt: new Date().toISOString(),
        }

        // 添加缓存标签
        if (opts.tags && opts.tags.length > 0) {
          cacheData.tags = opts.tags
        }

        // 存储到缓存
        await RedisUtils.set(cacheKey, cacheData, opts.ttl)
        
        // 如果有标签，建立标签索引
        if (opts.tags && opts.tags.length > 0) {
          for (const tag of opts.tags) {
            const tagKey = `${opts.keyPrefix}tag:${tag}`
            await RedisUtils.lpush(tagKey, cacheKey)
            await RedisUtils.expire(tagKey, opts.ttl)
          }
        }

        logger.debug({ 
          key: cacheKey, 
          ttl: opts.ttl,
          status: c.res.status 
        }, 'Response cached')
      }

      // 添加缓存未命中头部
      c.header('X-Cache', 'MISS')
      c.header('X-Cache-Key', cacheKey)

    } catch (error) {
      logger.error({ error, key: cacheKey }, 'Cache middleware error')
      // 缓存出错时继续执行原始逻辑
      if (!c.res) {
        await next()
      }
    }
  })
}

/**
 * 清除单个缓存
 */
export const clearCache = async (key: string): Promise<boolean> => {
  try {
    return await RedisUtils.del(key)
  } catch (error) {
    logger.error({ error, key }, 'Clear cache error')
    return false
  }
}

/**
 * 清除带标签的缓存
 */
export const clearCacheByTag = async (tag: string, keyPrefix = 'cache:'): Promise<number> => {
  try {
    const tagKey = `${keyPrefix}tag:${tag}`
    const cacheKeys = []
    
    // 获取所有标签对应的缓存键
    let key
    while ((key = await RedisUtils.rpop(tagKey)) !== null) {
      cacheKeys.push(key)
    }

    if (cacheKeys.length === 0) {
      return 0
    }

    // 批量删除缓存
    const promises = cacheKeys.map(key => RedisUtils.del(key))
    const results = await Promise.all(promises)
    
    const deletedCount = results.filter(Boolean).length
    logger.info({ 
      tag, 
      deletedCount, 
      totalKeys: cacheKeys.length 
    }, 'Cache cleared by tag')

    return deletedCount
  } catch (error) {
    logger.error({ error, tag }, 'Clear cache by tag error')
    return 0
  }
}

/**
 * 清除所有缓存（谨慎使用）
 */
export const clearAllCache = async (keyPrefix = 'cache:'): Promise<number> => {
  try {
    // 这里应该根据实际需求实现
    // 可以使用 Redis SCAN 命令来查找匹配的键
    logger.warn({ keyPrefix }, 'Clear all cache operation requested')
    
    // 暂时返回 0，实际实现需要谨慎处理
    return 0
  } catch (error) {
    logger.error({ error, keyPrefix }, 'Clear all cache error')
    return 0
  }
}