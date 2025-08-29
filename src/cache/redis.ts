import Redis from 'ioredis'
import { logger } from '../utils/logger'

// Redis 配置接口
export interface RedisConfig {
  host: string
  port: number
  password?: string
  db: number
  retryDelayOnFailover: number
  maxRetriesPerRequest: number
  lazyConnect: boolean
  connectTimeout: number
  commandTimeout: number
  keyPrefix?: string
}

// 默认 Redis 配置
const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '3'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'bun-hono:',
}

// Redis 客户端实例
let redisClient: Redis | null = null

/**
 * 获取 Redis 客户端实例
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = createRedisClient()
  }
  return redisClient
}

/**
 * 创建 Redis 客户端
 */
export const createRedisClient = (config?: Partial<RedisConfig>): Redis => {
  const finalConfig = { ...defaultConfig, ...config }
  
  const client = new Redis({
    host: finalConfig.host,
    port: finalConfig.port,
    password: finalConfig.password,
    db: finalConfig.db,
    maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
    lazyConnect: finalConfig.lazyConnect,
    connectTimeout: finalConfig.connectTimeout,
    commandTimeout: finalConfig.commandTimeout,
    keyPrefix: finalConfig.keyPrefix,
  })

  // 连接事件监听
  client.on('connect', () => {
    logger.info({
      host: finalConfig.host,
      port: finalConfig.port,
      db: finalConfig.db,
    }, 'Redis connected successfully')
  })

  client.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis connection error')
  })

  client.on('close', () => {
    logger.info('Redis connection closed')
  })

  client.on('reconnecting', () => {
    logger.info('Redis reconnecting...')
  })

  return client
}

/**
 * 关闭 Redis 连接
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.disconnect()
    redisClient = null
    logger.info('Redis connection closed')
  }
}

/**
 * 检查 Redis 连接状态
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const client = getRedisClient()
    const result = await client.ping()
    return result === 'PONG'
  } catch (error) {
    logger.error({ error }, 'Redis health check failed')
    return false
  }
}

// Redis 工具类
export class RedisUtils {
  private static client = getRedisClient()

  /**
   * 设置缓存
   */
  static async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value)
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue)
      } else {
        await this.client.set(key, serializedValue)
      }
      return true
    } catch (error) {
      logger.error({ key, error }, 'Redis set error')
      return false
    }
  }

  /**
   * 获取缓存
   */
  static async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      logger.error({ key, error }, 'Redis get error')
      return null
    }
  }

  /**
   * 删除缓存
   */
  static async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key)
      return result > 0
    } catch (error) {
      logger.error({ key, error }, 'Redis del error')
      return false
    }
  }

  /**
   * 检查 key 是否存在
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      logger.error({ key, error }, 'Redis exists error')
      return false
    }
  }

  /**
   * 设置过期时间
   */
  static async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds)
      return result === 1
    } catch (error) {
      logger.error({ key, error }, 'Redis expire error')
      return false
    }
  }

  /**
   * 获取剩余过期时间
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key)
    } catch (error) {
      logger.error({ key, error }, 'Redis ttl error')
      return -1
    }
  }

  /**
   * 原子递增
   */
  static async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key)
    } catch (error) {
      logger.error({ key, error }, 'Redis incr error')
      return 0
    }
  }

  /**
   * 原子递增指定值
   */
  static async incrby(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrby(key, increment)
    } catch (error) {
      logger.error({ key, increment, error }, 'Redis incrby error')
      return 0
    }
  }

  /**
   * 哈希表操作 - 设置字段
   */
  static async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      const result = await this.client.hset(key, field, JSON.stringify(value))
      return result >= 0
    } catch (error) {
      logger.error({ key, field, error }, 'Redis hset error')
      return false
    }
  }

  /**
   * 哈希表操作 - 获取字段
   */
  static async hget<T = any>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.client.hget(key, field)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      logger.error({ key, field, error }, 'Redis hget error')
      return null
    }
  }

  /**
   * 哈希表操作 - 获取所有字段
   */
  static async hgetall<T = Record<string, any>>(key: string): Promise<T | null> {
    try {
      const result = await this.client.hgetall(key)
      if (Object.keys(result).length === 0) return null
      
      const parsed: Record<string, any> = {}
      for (const [field, value] of Object.entries(result)) {
        try {
          parsed[field] = JSON.parse(value)
        } catch {
          parsed[field] = value
        }
      }
      return parsed as T
    } catch (error) {
      logger.error({ key, error }, 'Redis hgetall error')
      return null
    }
  }

  /**
   * 列表操作 - 左侧推入
   */
  static async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      const serializedValues = values.map(v => JSON.stringify(v))
      return await this.client.lpush(key, ...serializedValues)
    } catch (error) {
      logger.error({ key, error }, 'Redis lpush error')
      return 0
    }
  }

  /**
   * 列表操作 - 右侧弹出
   */
  static async rpop<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.rpop(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      logger.error({ key, error }, 'Redis rpop error')
      return null
    }
  }

  /**
   * 获取列表长度
   */
  static async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key)
    } catch (error) {
      logger.error({ key, error }, 'Redis llen error')
      return 0
    }
  }
}

export { Redis }
export default redisClient