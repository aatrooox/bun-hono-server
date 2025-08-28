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

// 创建日志器
let loggerInstance: pino.Logger

// 创建日志流配置
const createLogStreams = () => {
  const streams: any[] = []
  
  if (isProduction || logFileEnabled) {
    // 控制台输出
    if (isProduction) {
      // 生产环境：JSON格式输出到控制台
      streams.push({ stream: process.stdout })
    }
    
    // 文件输出（生产环境或明确启用时）
    if (isProduction || logFileEnabled) {
      streams.push({ stream: pino.destination(resolve(logDir, 'app.log')) })
    }
    
    // 错误日志文件（生产环境或明确启用时）
    if (isProduction || logErrorFileEnabled) {
      streams.push({ 
        level: 'error',
        stream: pino.destination(resolve(logDir, 'error.log')) 
      })
    }
  }
  
  return streams
}

if (isProduction) {
  // 生产环境：JSON格式，文件输出
  loggerInstance = pino({
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
  }, pino.multistream(createLogStreams()))
} else if (logFileEnabled) {
  // 开发环境但启用文件输出：美化控制台 + 文件输出
  const streams: any[] = [
    // 美化的控制台输出
    {
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
    },
    // 文件输出（JSON格式）
    { stream: pino.destination(resolve(logDir, 'app.log')) }
  ]
  
  // 错误日志文件
  if (logErrorFileEnabled) {
    streams.push({ 
      level: 'error',
      stream: pino.destination(resolve(logDir, 'error.log')) 
    })
  }
  
  loggerInstance = pino({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['password', 'token', 'authorization'],
      remove: true
    }
  }, pino.multistream(streams))
} else {
  // 开发环境：仅美化控制台输出
  loggerInstance = pino({
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: false,
        levelFirst: true,
      }
    }
  })
}

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
export class Logger {
  private logger: pino.Logger

  constructor(module?: string) {
    this.logger = module ? createChildLogger(module) : logger
  }

  info(msg: string, obj?: any) {
    if (obj) {
      this.logger.info(obj, msg)
    } else {
      this.logger.info(msg)
    }
  }

  error(msg: string, obj?: any) {
    if (obj) {
      this.logger.error(obj, msg)
    } else {
      this.logger.error(msg)
    }
  }

  warn(msg: string, obj?: any) {
    if (obj) {
      this.logger.warn(obj, msg)
    } else {
      this.logger.warn(msg)
    }
  }

  debug(msg: string, obj?: any) {
    if (obj) {
      this.logger.debug(obj, msg)
    } else {
      this.logger.debug(msg)
    }
  }

  trace(msg: string, obj?: any) {
    if (obj) {
      this.logger.trace(obj, msg)
    } else {
      this.logger.trace(msg)
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