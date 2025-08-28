/**
 * 文件上传安全检查中间件
 * 提供文件上传的安全防护功能
 */

import { Context, Next } from 'hono'
import { FileValidationError } from '../types/upload'
import { logger } from '../utils/logger'

const securityLogger = logger.child({ module: 'upload-security' })

/**
 * 文件上传安全检查中间件
 */
export const uploadSecurityMiddleware = async (c: Context, next: Next) => {
  try {
    // 检查请求大小限制
    const contentLength = c.req.header('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      const maxSize = 50 * 1024 * 1024 // 50MB 硬限制
      
      if (size > maxSize) {
        securityLogger.warn({
          contentLength: size,
          maxSize,
          ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
          userAgent: c.req.header('user-agent')
        }, '请求大小超过硬限制')
        
        return c.json({
          code: 413,
          message: '请求大小超过限制',
          timestamp: Date.now()
        }, 413)
      }
    }
    
    // 检查Content-Type
    const contentType = c.req.header('content-type')
    if (!contentType || !contentType.includes('multipart/form-data')) {
      securityLogger.warn({
        contentType,
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        path: c.req.path
      }, '非法的Content-Type')
      
      return c.json({
        code: 400,
        message: '请使用 multipart/form-data 格式上传文件',
        timestamp: Date.now()
      }, 400)
    }
    
    // 检查请求频率（简单的限流）
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    if (await isRateLimited(ip)) {
      securityLogger.warn({
        ip,
        path: c.req.path
      }, '请求频率过高')
      
      return c.json({
        code: 429,
        message: '请求过于频繁，请稍后再试',
        timestamp: Date.now()
      }, 429)
    }
    
    await next()
  } catch (error: any) {
    securityLogger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      path: c.req.path
    }, '安全检查中间件错误')
    
    return c.json({
      code: 500,
      message: '服务器内部错误',
      timestamp: Date.now()
    }, 500)
  }
}

/**
 * 简单的IP频率限制检查
 * 实际生产中应该使用Redis等外部存储
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分钟
const RATE_LIMIT_MAX_REQUESTS = 30 // 每分钟最多30个请求

async function isRateLimited(ip: string): Promise<boolean> {
  const now = Date.now()
  const record = requestCounts.get(ip)
  
  if (!record || now > record.resetTime) {
    // 重置或创建新记录
    requestCounts.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    return false
  }
  
  record.count++
  
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return true
  }
  
  return false
}

/**
 * 文件名安全检查
 */
export function sanitizeFilename(filename: string): string {
  // 移除或替换危险字符
  return filename
    .replace(/[<>:"|?*\x00-\x1f]/g, '_') // 替换危险字符
    .replace(/^\.+/, '') // 移除开头的点
    .replace(/\.+$/, '') // 移除结尾的点
    .replace(/\s+/g, '_') // 空格替换为下划线
    .replace(/_{2,}/g, '_') // 多个下划线合并
    .substring(0, 255) // 限制长度
}

/**
 * 检查文件路径是否安全
 */
export function isSecurePath(path: string): boolean {
  // 检查路径遍历攻击
  const normalizedPath = path.replace(/\\/g, '/')
  
  // 禁止的路径模式
  const dangerousPatterns = [
    /\.\./,           // 路径遍历
    /^\/+/,           // 绝对路径
    /\/+\.\./,        // 路径遍历
    /\.\./,           // 任何位置的路径遍历
    /\/+/,            // 多个斜杠
    /[<>:"|?*\x00-\x1f]/ // 危险字符
  ]
  
  return !dangerousPatterns.some(pattern => pattern.test(normalizedPath))
}

/**
 * 病毒扫描模拟（实际环境中应集成真正的杀毒引擎）
 */
export async function performVirusScan(buffer: Buffer, filename: string): Promise<boolean> {
  // 这里只做简单的恶意文件签名检查
  const content = buffer.toString('hex').toLowerCase()
  
  // 常见的恶意文件签名（十六进制）
  const maliciousSignatures = [
    '4d5a', // PE文件头
    '7f454c46', // ELF文件头
    '213c617263683e', // Linux脚本
    '23212f62696e2f73', // #!/bin/sh
    '23212f62696e2f62617368', // #!/bin/bash
  ]
  
  for (const signature of maliciousSignatures) {
    if (content.startsWith(signature)) {
      securityLogger.warn({
        filename,
        signature,
        fileSize: buffer.length
      }, '检测到可疑文件签名')
      return false
    }
  }
  
  return true
}

/**
 * 检查文件是否为图片炸弹（过大的图片文件）
 */
export function checkImageBomb(buffer: Buffer, maxPixels: number = 25000000): boolean {
  if (buffer.length < 24) return true
  
  try {
    // 简单的图片尺寸检查（PNG为例）
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      // PNG格式
      const width = buffer.readUInt32BE(16)
      const height = buffer.readUInt32BE(20)
      const pixels = width * height
      
      if (pixels > maxPixels) {
        securityLogger.warn({
          width,
          height,
          pixels,
          maxPixels
        }, '检测到潜在的图片炸弹')
        return false
      }
    }
    
    // JPEG格式检查可以在这里添加
    
    return true
  } catch (error) {
    securityLogger.error({
      error: error instanceof Error ? error.message : String(error)
    }, '图片炸弹检查失败')
    return true // 检查失败时允许通过
  }
}

/**
 * 清理和重置请求计数（定期调用）
 */
export function cleanupRateLimitRecords(): void {
  const now = Date.now()
  
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip)
    }
  }
}

// 每5分钟清理一次过期记录
setInterval(cleanupRateLimitRecords, 5 * 60 * 1000)