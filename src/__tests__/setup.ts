/**
 * Jest测试环境设置
 */

import { jest } from '@jest/globals'

// 设置测试超时
jest.setTimeout(10000)

// 全局模拟
global.console = {
  ...console,
  // 在测试中静默一些日志输出
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}

// 模拟环境变量
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key'
process.env.DATABASE_URL = ':memory:'
process.env.LOG_LEVEL = 'error'

// 设置测试用的上传配置
process.env.UPLOAD_STORAGE_TYPE = 'local'
process.env.UPLOAD_MAX_FILE_SIZE = '10485760'
process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,image/png,text/plain'
process.env.UPLOAD_ALLOWED_EXTENSIONS = '.jpg,.jpeg,.png,.txt'
process.env.UPLOAD_LOCAL_DIR = './test-uploads'
process.env.UPLOAD_LOCAL_BASE_URL = 'http://localhost:3000/test-uploads'

// 测试前清理
beforeEach(() => {
  jest.clearAllMocks()
})

// 测试后清理
afterEach(() => {
  jest.restoreAllMocks()
})