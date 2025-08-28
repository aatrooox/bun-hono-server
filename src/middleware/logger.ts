import { logger } from 'hono/logger'

// 自定义日志格式
export const loggerConfig = logger((str, ...rest) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${str}`, ...rest)
})