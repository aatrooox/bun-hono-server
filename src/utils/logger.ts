import pino from 'pino'
import { resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'

// 确保日志目录存在
const logDir = resolve(process.cwd(), 'logs')
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true })
}

// 环境变量配置
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
const isProduction = process.env.NODE_ENV === 'production'
const logFileEnabled = process.env.LOG_FILE_ENABLED === 'true'
const logErrorFileEnabled = process.env.LOG_ERROR_FILE === 'true'

// 创建统一的日志配置
const baseConfig = {
  level: logLevel,
  base: isProduction ? {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'unknown',
    service: 'bun-hono-server'
  } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'token', 'authorization'],
    remove: true
  }
}

// 创建日志流配置
const createStreams = () => {
  const streams: any[] = []
  
  // 控制台输出（美化输出用于开发环境，JSON输出用于生产环境）
  if (isProduction) {
    streams.push({
      level: 'trace',
      stream: process.stdout
    })
  } else {
    streams.push({
      level: 'trace',
      stream: pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
          levelFirst: true,
        }
      })
    })
  }
  
  // 普通日志文件输出（info级别及以上，但排除error级别）
  if (logFileEnabled) {
    streams.push({
      level: 'info',
      stream: pino.destination({
        dest: resolve(logDir, 'app.log'),
        sync: false
      })
    })
  }
  
  // 错误日志文件输出（仅error级别）
  if (logErrorFileEnabled) {
    streams.push({
      level: 'error',
      stream: pino.destination({
        dest: resolve(logDir, 'error.log'),
        sync: false
      })
    })
  }
  
  return streams
}

// 创建主日志器
const loggerInstance = pino(baseConfig, pino.multistream(createStreams()))

export const logger = loggerInstance

// 为不同模块创建子logger
export const createChildLogger = (module: string) => {
  return logger.child({ module })
}

// 高级日志配置（用于生产环境日志轮转）
export const createProductionLoggerWithRotation = () => {
  if (!isProduction) {
    return logger
  }
  
  try {
    const logFileMaxSize = process.env.LOG_FILE_MAX_SIZE || '10'
    const logFileMaxFiles = parseInt(process.env.LOG_FILE_MAX_FILES || '7', 10)
    
    // 使用 pino-roll 实现日志轮转
    const pinoms = require('pino-roll')
    
    const rollOptions = {
      file: resolve(logDir, 'app'),
      frequency: 'daily',
      size: `${logFileMaxSize}m`,
      limit: {
        count: logFileMaxFiles
      }
    }
    
    return pino({
      level: logLevel,
      base: {
        pid: process.pid,
        hostname: process.env.HOSTNAME || 'unknown',
        service: 'bun-hono-server'
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: ['password', 'token', 'authorization'],
        remove: true
      }
    }, pinoms(rollOptions))
  } catch (error) {
    console.warn('日志轮转初始化失败，使用默认日志器:', error)
    return logger
  }
}

// 日志工具类
export class CustomLogger {
  private logger: pino.Logger

  constructor(module?: string) {
    this.logger = module ? createChildLogger(module) : logger
  }

  info(obj: any, msg?: string): void
  info(msg: string): void
  info(objOrMsg: any, msg?: string) {
    if (typeof objOrMsg === 'string' && msg === undefined) {
      this.logger.info(objOrMsg)
    } else {
      this.logger.info(objOrMsg, msg || '')
    }
  }

  error(obj: any, msg?: string): void
  error(msg: string): void
  error(objOrMsg: any, msg?: string) {
    if (typeof objOrMsg === 'string' && msg === undefined) {
      this.logger.error(objOrMsg)
    } else {
      this.logger.error(objOrMsg, msg || '')
    }
  }

  warn(obj: any, msg?: string): void
  warn(msg: string): void
  warn(objOrMsg: any, msg?: string) {
    if (typeof objOrMsg === 'string' && msg === undefined) {
      this.logger.warn(objOrMsg)
    } else {
      this.logger.warn(objOrMsg, msg || '')
    }
  }

  debug(obj: any, msg?: string): void
  debug(msg: string): void
  debug(objOrMsg: any, msg?: string) {
    if (typeof objOrMsg === 'string' && msg === undefined) {
      this.logger.debug(objOrMsg)
    } else {
      this.logger.debug(objOrMsg, msg || '')
    }
  }

  trace(obj: any, msg?: string): void
  trace(msg: string): void
  trace(objOrMsg: any, msg?: string) {
    if (typeof objOrMsg === 'string' && msg === undefined) {
      this.logger.trace(objOrMsg)
    } else {
      this.logger.trace(objOrMsg, msg || '')
    }
  }

  // HTTP 请求日志
  httpRequest(req: any, res: any, responseTime: number) {
    this.logger.info({
      req,
      res,
      responseTime: `${responseTime}ms`
    }, `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`)
  }

  // 数据库操作日志
  dbQuery(query: string, params?: any, duration?: number) {
    this.logger.debug({
      query,
      params,
      duration: duration ? `${duration}ms` : undefined
    }, 'Database query executed')
  }

  // 业务操作日志
  business(action: string, userId?: number, data?: any) {
    this.logger.info({
      action,
      userId,
      data
    }, `Business action: ${action}`)
  }
}

// 默认导出
export default logger