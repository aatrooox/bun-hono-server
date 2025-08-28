/**
 * 上传安全中间件单元测试
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  uploadSecurityMiddleware, 
  sanitizeFilename, 
  isSecurePath, 
  performVirusScan, 
  checkImageBomb 
} from '../middleware/uploadSecurity'
import type { Context, Next } from 'hono'

// Mock dependencies
jest.mock('../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn()
    }))
  }
}))

describe('uploadSecurityMiddleware', () => {
  let mockContext: any
  let mockNext: jest.MockedFunction<() => Promise<void>>
  
  beforeEach(() => {
    mockNext = jest.fn(() => Promise.resolve())
    mockContext = {
      req: {
        header: jest.fn(),
        path: '/api/upload/single'
      },
      json: jest.fn((data: any, status?: number) => ({ 
        _data: data, 
        status, 
        data,
        json: () => Promise.resolve(data)
      }))
    }
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  it('应该通过有效的请求', async () => {
    mockContext.req.header.mockImplementation((name: string) => {
      switch (name) {
        case 'content-type':
          return 'multipart/form-data; boundary=----WebKitFormBoundary'
        case 'content-length':
          return '1024'
        default:
          return null
      }
    })
    
    await uploadSecurityMiddleware(mockContext, mockNext)
    
    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.json).not.toHaveBeenCalled()
  })
  
  it('应该拒绝过大的请求', async () => {
    mockContext.req.header.mockImplementation((name: string) => {
      switch (name) {
        case 'content-length':
          return String(100 * 1024 * 1024) // 100MB
        case 'content-type':
          return 'multipart/form-data'
        default:
          return null
      }
    })
    
    const result = await uploadSecurityMiddleware(mockContext, mockNext)
    
    expect(mockNext).not.toHaveBeenCalled()
    expect(result).toBeDefined()
    if (result) {
      expect(result.status).toBe(413)
      expect((result as any)._data.message).toContain('请求大小超过限制')
    }
  })
  
  it('应该拒绝非multipart/form-data请求', async () => {
    mockContext.req.header.mockImplementation((name: string) => {
      switch (name) {
        case 'content-type':
          return 'application/json'
        case 'content-length':
          return '1024'
        default:
          return null
      }
    })
    
    const result = await uploadSecurityMiddleware(mockContext, mockNext)
    
    expect(mockNext).not.toHaveBeenCalled()
    expect(result).toBeDefined()
    if (result) {
      expect(result.status).toBe(400)
      expect((result as any)._data.message).toContain('multipart/form-data')
    }
  })
})

describe('sanitizeFilename', () => {
  it('应该清理危险字符', () => {
    const dangerous = 'test<script>alert(1)</script>.jpg'
    const result = sanitizeFilename(dangerous)
    
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
    expect(result).not.toContain('script')
  })
  
  it('应该替换空格为下划线', () => {
    const filename = 'my test file.jpg'
    const result = sanitizeFilename(filename)
    
    expect(result).toBe('my_test_file.jpg')
  })
  
  it('应该移除开头和结尾的点', () => {
    const filename = '...test....jpg...'
    const result = sanitizeFilename(filename)
    
    expect(result).not.toMatch(/^\./)
    expect(result).not.toMatch(/\.$/)
  })
  
  it('应该限制文件名长度', () => {
    const longFilename = 'a'.repeat(300) + '.jpg'
    const result = sanitizeFilename(longFilename)
    
    expect(result.length).toBeLessThanOrEqual(255)
  })
  
  it('应该合并多个下划线', () => {
    const filename = 'test___file___name.jpg'
    const result = sanitizeFilename(filename)
    
    expect(result).toBe('test_file_name.jpg')
  })
})

describe('isSecurePath', () => {
  it('应该允许安全路径', () => {
    const safePaths = [
      'uploads/image.jpg',
      'documents/file.pdf',
      'folder/subfolder/test.txt'
    ]
    
    safePaths.forEach(path => {
      expect(isSecurePath(path)).toBe(true)
    })
  })
  
  it('应该拒绝路径遍历攻击', () => {
    const dangerousPaths = [
      '../../../etc/passwd',
      'uploads/../../../config.json',
      '..\\windows\\system32\\config',
      'folder/../../sensitive.txt'
    ]
    
    dangerousPaths.forEach(path => {
      expect(isSecurePath(path)).toBe(false)
    })
  })
  
  it('应该拒绝绝对路径', () => {
    const absolutePaths = [
      '/etc/passwd',
      '/var/www/html/index.php',
      '//network/share/file.txt'
    ]
    
    absolutePaths.forEach(path => {
      expect(isSecurePath(path)).toBe(false)
    })
  })
  
  it('应该拒绝包含危险字符的路径', () => {
    const dangerousPaths = [
      'file<script>.jpg',
      'test|pipe.txt',
      'file"quote.pdf',
      'test?query.png'
    ]
    
    dangerousPaths.forEach(path => {
      expect(isSecurePath(path)).toBe(false)
    })
  })
})

describe('performVirusScan', () => {
  it('应该通过安全文件', async () => {
    const safeBuffer = Buffer.from('This is safe content')
    const result = await performVirusScan(safeBuffer, 'safe.txt')
    
    expect(result).toBe(true)
  })
  
  it('应该检测PE文件', async () => {
    const peBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]) // MZ header
    const result = await performVirusScan(peBuffer, 'malware.exe')
    
    expect(result).toBe(false)
  })
  
  it('应该检测ELF文件', async () => {
    const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46]) // ELF header
    const result = await performVirusScan(elfBuffer, 'malware')
    
    expect(result).toBe(false)
  })
  
  it('应该检测Linux脚本', async () => {
    const scriptBuffer = Buffer.from('#!/bin/sh\\nrm -rf /', 'ascii')
    const result = await performVirusScan(scriptBuffer, 'script.sh')
    
    expect(result).toBe(false)
  })
})

describe('checkImageBomb', () => {
  it('应该通过正常大小的图片', () => {
    // 创建一个模拟的PNG图片缓冲区
    const normalPNG = Buffer.alloc(32)
    normalPNG[0] = 0x89
    normalPNG[1] = 0x50
    normalPNG[2] = 0x4E
    normalPNG[3] = 0x47
    
    // 设置较小的尺寸 (1000x1000)
    normalPNG.writeUInt32BE(1000, 16) // width
    normalPNG.writeUInt32BE(1000, 20) // height
    
    const result = checkImageBomb(normalPNG)
    expect(result).toBe(true)
  })
  
  it('应该检测过大的图片', () => {
    // 创建一个模拟的PNG图片缓冲区
    const largePNG = Buffer.alloc(32)
    largePNG[0] = 0x89
    largePNG[1] = 0x50
    largePNG[2] = 0x4E
    largePNG[3] = 0x47
    
    // 设置过大的尺寸 (10000x10000 = 100M pixels)
    largePNG.writeUInt32BE(10000, 16) // width
    largePNG.writeUInt32BE(10000, 20) // height
    
    const result = checkImageBomb(largePNG, 25000000) // 25M pixels limit
    expect(result).toBe(false)
  })
  
  it('应该处理非PNG文件', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]) // JPEG header
    const result = checkImageBomb(jpegBuffer)
    
    expect(result).toBe(true) // 非PNG文件应该通过检查
  })
  
  it('应该处理损坏的图片数据', () => {
    const corruptedBuffer = Buffer.from('not an image')
    const result = checkImageBomb(corruptedBuffer)
    
    expect(result).toBe(true) // 损坏的数据应该通过检查（避免误报）
  })
  
  it('应该处理过小的缓冲区', () => {
    const tinyBuffer = Buffer.alloc(10)
    const result = checkImageBomb(tinyBuffer)
    
    expect(result).toBe(true)
  })
})

describe('集成测试', () => {
  it('应该综合测试安全检查流程', async () => {
    // 模拟一个完整的恶意请求
    const mockContext = {
      req: {
        header: jest.fn((name: string) => {
          switch (name) {
            case 'content-type':
              return 'multipart/form-data'
            case 'content-length':
              return '1024'
            case 'user-agent':
              return 'AttackBot/1.0'
            case 'x-forwarded-for':
              return '192.168.1.100'
            default:
              return null
          }
        }),
        path: '/api/upload/single'
      },
      json: jest.fn((data: any, status?: number) => ({ 
        _data: data, 
        status, 
        data,
        json: () => Promise.resolve(data)
      }))
    }
    
    const mockNext: jest.MockedFunction<() => Promise<void>> = jest.fn(() => Promise.resolve())
    
    // 测试恶意文件名
    const maliciousFilename = '../../../etc/passwd<script>alert(1)</script>'
    const sanitized = sanitizeFilename(maliciousFilename)
    
    expect(sanitized).not.toContain('..')
    expect(sanitized).not.toContain('<script>')
    
    // 测试恶意路径
    const maliciousPath = '../../sensitive/config.json'
    expect(isSecurePath(maliciousPath)).toBe(false)
    
    // 测试恶意文件内容
    const maliciousBuffer = Buffer.from('<script>document.location="http://evil.com"</script>')
    const virusScanResult = await performVirusScan(maliciousBuffer, 'malicious.html')
    
    // 注意：当前的病毒扫描只检查二进制签名，不检查脚本内容
    // 实际的脚本检查在文件上传服务中进行
    expect(virusScanResult).toBe(true) // 这个特定的恶意脚本不会被二进制检查发现
  })
})