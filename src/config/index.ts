import { z } from 'zod'
import dotenv from 'dotenv'
import { logger } from '../utils/logger'
import packageJson from '../../package.json'

// 加载环境变量
dotenv.config()

// 环境变量验证 Schema
const envSchema = z.object({
  // 基础配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  
  // 数据库配置
  DATABASE_URL: z.string().default('./database.sqlite'),
  
  // JWT 配置
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Redis 配置 (可选)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().min(0).max(15)).default('0'),
  REDIS_KEY_PREFIX: z.string().default('bun-hono:'),
  
  // 文件上传配置
  UPLOAD_MAX_SIZE: z.string().transform(Number).pipe(z.number().positive()).default('10485760'), // 10MB
  UPLOAD_ALLOWED_TYPES: z.string().default('image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain'),
  
  // 对象存储配置 (可选)
  COS_SECRET_ID: z.string().optional(),
  COS_SECRET_KEY: z.string().optional(),
  COS_REGION: z.string().optional(),
  COS_BUCKET: z.string().optional(),
  
  // 日志配置
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
  
  // 安全配置
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('900000'), // 15分钟
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),
  BCRYPT_ROUNDS: z.string().transform(Number).pipe(z.number().min(10).max(15)).default('12'),
  
  // 应用配置
  APP_NAME: z.string().default('Bun Hono Server'),
  APP_URL: z.string().url().optional(),
  
  // 监控配置
  HEALTH_CHECK_ENABLED: z.string().transform(v => v === 'true').default('true'),
  METRICS_ENABLED: z.string().transform(v => v === 'true').default('false'),
})

// 验证环境变量
let config: z.infer<typeof envSchema>

try {
  config = envSchema.parse(process.env)
  logger.info({
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    logLevel: config.LOG_LEVEL,
  }, 'Environment configuration loaded successfully')
} catch (error) {
  if (error instanceof z.ZodError) {
    const errorMessages = error.errors.map(err => {
      return `${err.path.join('.')}: ${err.message}`
    })
    
    logger.error({
      errors: errorMessages,
    }, 'Environment configuration validation failed')
    
    console.error('❌ Environment configuration errors:')
    errorMessages.forEach(msg => console.error(`  - ${msg}`))
    process.exit(1)
  }
  
  logger.error({ error }, 'Failed to load environment configuration')
  process.exit(1)
}

// 配置类
export class Config {
  // 基础配置
  static readonly NODE_ENV = config.NODE_ENV
  static readonly PORT = config.PORT
  static readonly IS_PRODUCTION = config.NODE_ENV === 'production'
  static readonly IS_DEVELOPMENT = config.NODE_ENV === 'development'
  static readonly IS_TEST = config.NODE_ENV === 'test'
  
  // 数据库配置
  static readonly DATABASE_URL = config.DATABASE_URL
  
  // JWT 配置
  static readonly JWT_SECRET = config.JWT_SECRET
  static readonly JWT_ACCESS_EXPIRES_IN = config.JWT_ACCESS_EXPIRES_IN
  static readonly JWT_REFRESH_EXPIRES_IN = config.JWT_REFRESH_EXPIRES_IN
  
  // Redis 配置
  static readonly REDIS_HOST = config.REDIS_HOST
  static readonly REDIS_PORT = config.REDIS_PORT
  static readonly REDIS_PASSWORD = config.REDIS_PASSWORD
  static readonly REDIS_DB = config.REDIS_DB
  static readonly REDIS_KEY_PREFIX = config.REDIS_KEY_PREFIX
  
  // 文件上传配置
  static readonly UPLOAD_MAX_SIZE = config.UPLOAD_MAX_SIZE
  static readonly UPLOAD_ALLOWED_TYPES = config.UPLOAD_ALLOWED_TYPES.split(',').map(t => t.trim())
  
  // 对象存储配置
  static readonly COS_SECRET_ID = config.COS_SECRET_ID
  static readonly COS_SECRET_KEY = config.COS_SECRET_KEY
  static readonly COS_REGION = config.COS_REGION
  static readonly COS_BUCKET = config.COS_BUCKET
  static readonly HAS_COS_CONFIG = !!(config.COS_SECRET_ID && config.COS_SECRET_KEY && config.COS_REGION && config.COS_BUCKET)
  
  // 日志配置
  static readonly LOG_LEVEL = config.LOG_LEVEL
  static readonly LOG_FILE_PATH = config.LOG_FILE_PATH
  
  // 安全配置
  static readonly RATE_LIMIT_WINDOW_MS = config.RATE_LIMIT_WINDOW_MS
  static readonly RATE_LIMIT_MAX_REQUESTS = config.RATE_LIMIT_MAX_REQUESTS
  static readonly BCRYPT_ROUNDS = config.BCRYPT_ROUNDS
  
  // 应用配置
  static readonly APP_NAME = config.APP_NAME
  static readonly APP_VERSION = packageJson.version
  static readonly APP_URL = config.APP_URL
  
  // 监控配置
  static readonly HEALTH_CHECK_ENABLED = config.HEALTH_CHECK_ENABLED
  static readonly METRICS_ENABLED = config.METRICS_ENABLED
  
  /**
   * 获取所有配置（去除敏感信息）
   */
  static getPublicConfig() {
    return {
      app: {
        name: this.APP_NAME,
        version: this.APP_VERSION,
        environment: this.NODE_ENV,
        url: this.APP_URL,
      },
      server: {
        port: this.PORT,
      },
      features: {
        redis: !!this.REDIS_HOST,
        cos: this.HAS_COS_CONFIG,
        healthCheck: this.HEALTH_CHECK_ENABLED,
        metrics: this.METRICS_ENABLED,
      },
      upload: {
        maxSize: this.UPLOAD_MAX_SIZE,
        allowedTypes: this.UPLOAD_ALLOWED_TYPES,
      },
      security: {
        rateLimitWindowMs: this.RATE_LIMIT_WINDOW_MS,
        rateLimitMaxRequests: this.RATE_LIMIT_MAX_REQUESTS,
      },
    }
  }
  
  /**
   * 验证必需的配置
   */
  static validateRequiredConfig(): boolean {
    const required = [
      'JWT_SECRET',
    ]
    
    const missing = required.filter(key => !process.env[key])
    
    if (missing.length > 0) {
      logger.error({ missing }, 'Missing required environment variables')
      return false
    }
    
    return true
  }
  
  /**
   * 获取数据库配置
   */
  static getDatabaseConfig() {
    return {
      url: this.DATABASE_URL,
    }
  }
  
  /**
   * 获取 Redis 配置
   */
  static getRedisConfig() {
    return {
      host: this.REDIS_HOST,
      port: this.REDIS_PORT,
      password: this.REDIS_PASSWORD,
      db: this.REDIS_DB,
      keyPrefix: this.REDIS_KEY_PREFIX,
    }
  }
  
  /**
   * 获取 JWT 配置
   */
  static getJWTConfig() {
    return {
      secret: this.JWT_SECRET,
      accessExpiresIn: this.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: this.JWT_REFRESH_EXPIRES_IN,
    }
  }
}

// 启动时验证配置
if (!Config.validateRequiredConfig()) {
  process.exit(1)
}

export default Config
export { config as rawConfig }