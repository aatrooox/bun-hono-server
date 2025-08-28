/**
 * 文件上传服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { FileUploadService, initUploadService, getUploadService, destroyUploadService } from '../services/upload'
import { FileValidationError, StorageError } from '../types/upload'
import type { UploadConfig, FileInfo } from '../types/upload'

// Mock dependencies
jest.mock('../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}))

jest.mock('../utils/storage/base', () => ({
  StorageAdapterFactory: {
    register: jest.fn(),
    create: jest.fn(() => ({
      upload: jest.fn(),
      delete: jest.fn(),
      getUrl: jest.fn(),
      exists: jest.fn(),
      getFileInfo: jest.fn()
    }))
  }
}))

jest.mock('../utils/imageProcessor', () => ({
  ImageProcessor: {
    validateImageFormat: jest.fn(),
    processImage: jest.fn(),
    autoOptimize: jest.fn()
  }
}))

describe('FileUploadService', () => {
  let service: FileUploadService
  let mockConfig: UploadConfig
  let mockAdapterConfig: any
  
  beforeEach(() => {
    // 设置模拟配置
    mockConfig = {
      storageType: 'local',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/png', 'text/plain'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.txt'],
      uploadPath: 'uploads',
      enableSecurityScan: true,
      blockExecutableFiles: true,
      scanFileContent: true,
      maxFilenameLength: 255,
      quarantineSuspiciousFiles: false
    }
    
    mockAdapterConfig = {
      uploadDir: './uploads',
      baseUrl: 'http://localhost:3000/uploads'
    }
    
    // 初始化服务
    service = initUploadService(mockConfig, mockAdapterConfig)
  })
  
  afterEach(() => {
    // 清理服务实例
    destroyUploadService()
  })
  
  describe('服务初始化', () => {
    it('应该正确初始化文件上传服务', () => {
      expect(service).toBeInstanceOf(FileUploadService)
      expect(service.getSupportedTypes()).toHaveProperty('types')
      expect(service.getSupportedTypes()).toHaveProperty('extensions')
      expect(service.getSupportedTypes()).toHaveProperty('maxSize')
    })
    
    it('应该通过getUploadService获取实例', () => {
      const instance = getUploadService()
      expect(instance).toBe(service)
    })
    
    it('未初始化时应该抛出错误', () => {
      destroyUploadService()
      expect(() => getUploadService()).toThrow('文件上传服务未初始化')
    })
  })
  
  describe('文件验证', () => {
    const createMockFile = (overrides: Partial<FileInfo> = {}): FileInfo => ({
      originalName: 'test.jpg',
      size: 1024 * 1024, // 1MB
      mimeType: 'image/jpeg',
      extension: '.jpg',
      buffer: Buffer.from('fake image data'),
      ...overrides
    })
    
    it('应该验证有效的文件', async () => {
      const file = createMockFile()
      
      // Mock adapter methods
      const mockAdapter = (service as any).adapter
      mockAdapter.upload.mockResolvedValue({
        success: true,
        url: 'http://example.com/test.jpg',
        path: 'uploads/test.jpg',
        filename: 'test.jpg',
        size: file.size
      })
      
      const result = await service.uploadFile(file)
      expect(result.success).toBe(true)
    })
    
    it('应该拒绝过大的文件', async () => {
      const file = createMockFile({
        size: 20 * 1024 * 1024 // 20MB, 超过10MB限制
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow(FileValidationError)
    })
    
    it('应该拒绝空文件', async () => {
      const file = createMockFile({
        size: 0
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('不允许上传空文件')
    })
    
    it('应该拒绝不支持的文件类型', async () => {
      const file = createMockFile({
        mimeType: 'application/executable',
        extension: '.exe'
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow(FileValidationError)
    })
    
    it('应该拒绝不支持的文件扩展名', async () => {
      const file = createMockFile({
        mimeType: 'image/jpeg',
        extension: '.exe'
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow(FileValidationError)
    })
    
    it('应该拒绝空文件名', async () => {
      const file = createMockFile({
        originalName: ''
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('文件名不能为空')
    })
    
    it('应该拒绝过长的文件名', async () => {
      const longName = 'a'.repeat(300) + '.jpg'
      const file = createMockFile({
        originalName: longName
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('文件名过长')
    })
    
    it('应该拒绝包含危险字符的文件名', async () => {
      const file = createMockFile({
        originalName: 'test<script>.jpg'
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('文件名包含非法字符')
    })
  })
  
  describe('安全检查', () => {
    const createMockFile = (overrides: Partial<FileInfo> = {}): FileInfo => ({
      originalName: 'test.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      extension: '.jpg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, ...Array(1000).fill(0)]), // JPEG文件头
      ...overrides
    })
    
    it('应该检测可执行文件', async () => {
      const file = createMockFile({
        originalName: 'malware.exe',
        extension: '.exe',
        mimeType: 'application/octet-stream'
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('不允许上传可执行文件')
    })
    
    it('应该检测PE文件头', async () => {
      const file = createMockFile({
        originalName: 'test.jpg',
        buffer: Buffer.from([0x4D, 0x5A, ...Array(1000).fill(0)]) // MZ header
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('检测到Windows可执行文件')
    })
    
    it('应该检测ELF文件头', async () => {
      const file = createMockFile({
        originalName: 'test.jpg',
        buffer: Buffer.from([0x7F, 0x45, 0x4C, 0x46, ...Array(1000).fill(0)]) // ELF header
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('检测到ELF可执行文件')
    })
    
    it('应该检测恶意扩展名', async () => {
      const file = createMockFile({
        originalName: 'shell.php',
        extension: '.php',
        mimeType: 'text/plain'
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('不允许上传此类型的文件')
    })
    
    it('应该检测双重扩展名', async () => {
      const file = createMockFile({
        originalName: 'image.php.jpg',
        extension: '.jpg'
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('检测到可疑的双重扩展名')
    })
    
    it('应该检测恶意脚本内容', async () => {
      const file = createMockFile({
        buffer: Buffer.from('<script>alert("xss")</script>')
      })
      
      await expect(service.uploadFile(file)).rejects.toThrow('文件内容包含可疑的脚本代码')
    })
  })
  
  describe('批量上传', () => {
    const createMockFiles = (count: number): FileInfo[] => {
      return Array.from({ length: count }, (_, i) => ({
        originalName: `test${i}.jpg`,
        size: 1024,
        mimeType: 'image/jpeg',
        extension: '.jpg',
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, ...Array(100).fill(0)])
      }))
    }
    
    it('应该批量上传多个文件', async () => {
      const files = createMockFiles(3)
      
      // Mock adapter
      const mockAdapter = (service as any).adapter
      mockAdapter.upload.mockResolvedValue({
        success: true,
        url: 'http://example.com/test.jpg',
        path: 'uploads/test.jpg'
      })
      
      const results = await service.uploadFiles(files)
      
      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
    })
    
    it('应该处理部分失败的批量上传', async () => {
      const files = createMockFiles(3)
      
      // Mock adapter - 第二个文件失败
      const mockAdapter = (service as any).adapter
      mockAdapter.upload
        .mockResolvedValueOnce({ success: true, url: 'http://example.com/test0.jpg' })
        .mockRejectedValueOnce(new Error('上传失败'))
        .mockResolvedValueOnce({ success: true, url: 'http://example.com/test2.jpg' })
      
      const results = await service.uploadFiles(files)
      
      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })
  })
  
  describe('文件操作', () => {
    it('应该删除文件', async () => {
      const mockAdapter = (service as any).adapter
      mockAdapter.delete.mockResolvedValue(true)
      
      const result = await service.deleteFile('test/path.jpg')
      expect(result).toBe(true)
      expect(mockAdapter.delete).toHaveBeenCalledWith('test/path.jpg')
    })
    
    it('应该获取文件URL', async () => {
      const mockAdapter = (service as any).adapter
      mockAdapter.getUrl.mockResolvedValue('http://example.com/test.jpg')
      
      const url = await service.getFileUrl('test/path.jpg')
      expect(url).toBe('http://example.com/test.jpg')
    })
    
    it('应该检查文件是否存在', async () => {
      const mockAdapter = (service as any).adapter
      mockAdapter.exists.mockResolvedValue(true)
      
      const exists = await service.fileExists('test/path.jpg')
      expect(exists).toBe(true)
    })
    
    it('应该获取文件信息', async () => {
      const mockFileInfo = {
        filename: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        modifiedAt: new Date(),
        path: 'test/path.jpg',
        url: 'http://example.com/test.jpg'
      }
      
      const mockAdapter = (service as any).adapter
      mockAdapter.getFileInfo.mockResolvedValue(mockFileInfo)
      
      const info = await service.getFileInfo('test/path.jpg')
      expect(info).toEqual(mockFileInfo)
    })
  })
  
  describe('配置管理', () => {
    it('应该获取支持的文件类型', () => {
      const types = service.getSupportedTypes()
      
      expect(types.types).toEqual(mockConfig.allowedTypes)
      expect(types.extensions).toEqual(mockConfig.allowedExtensions)
      expect(types.maxSize).toContain('MB')
    })
    
    it('应该更新配置', () => {
      const newConfig = {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/png']
      }
      
      service.updateConfig(newConfig)
      
      const types = service.getSupportedTypes()
      expect(types.maxSize).toContain('5.0')
      expect(types.types).toEqual(['image/png'])
    })
  })
})

describe('工具函数', () => {
  describe('文件大小格式化', () => {
    it('应该正确格式化不同大小的文件', () => {
      const service = new FileUploadService({
        storageType: 'local',
        maxFileSize: 1024,
        allowedTypes: [],
        allowedExtensions: [],
        uploadPath: 'test'
      }, {})
      
      // 通过getSupportedTypes测试formatFileSize
      const result = service.getSupportedTypes()
      expect(result.maxSize).toContain('KB') // 1024 bytes = 1.0 KB
    })
  })
})