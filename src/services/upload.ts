/**
 * 文件上传服务
 * 统一管理文件上传逻辑，支持多种存储后端
 */

import { 
  StorageAdapter,
  FileInfo,
  UploadResult,
  UploadOptions,
  UploadConfig,
  StorageType,
  FileValidationError,
  StorageError,
  ImageProcessOptions
} from '../types/upload'
import { StorageAdapterFactory } from '../utils/storage/base'
import { LocalStorageAdapter } from '../utils/storage/local'
import { COSStorageAdapter } from '../utils/storage/cos'
import { ImageProcessor } from '../utils/imageProcessor'
import { logger } from '../utils/logger'

// 注册所有存储适配器
StorageAdapterFactory.register('local', LocalStorageAdapter)
StorageAdapterFactory.register('cos', COSStorageAdapter)

export class FileUploadService {
  private adapter: StorageAdapter
  private config: UploadConfig
  private logger = logger.child({ module: 'upload-service' })
  
  constructor(config: UploadConfig, adapterConfig: any) {
    this.config = config
    this.adapter = StorageAdapterFactory.create(config.storageType, adapterConfig)
    
    this.logger.info({
      storageType: config.storageType,
      maxFileSize: config.maxFileSize,
      allowedTypes: config.allowedTypes,
      allowedExtensions: config.allowedExtensions
    }, '文件上传服务初始化完成')
  }
  
  /**
   * 上传单个文件
   */
  async uploadFile(file: FileInfo, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      // 验证文件
      this.validateFile(file)
      
      // 执行安全检查
      await this.performSecurityChecks(file)
      
      // 添加图片处理
      if (this.isImage(file.mimeType)) {
        // 验证图片格式
        const imageMetadata = await ImageProcessor.validateImageFormat(file.buffer)
        if (!imageMetadata) {
          throw new FileValidationError(
            '无效的图片格式',
            'INVALID_IMAGE_FORMAT',
            { mimeType: file.mimeType }
          )
        }
        
        // 检查图片尺寸（防止图片炸弹）
        const maxPixels = 50000000 // 5000万像素
        const pixels = (imageMetadata.width || 0) * (imageMetadata.height || 0)
        if (pixels > maxPixels) {
          throw new FileValidationError(
            `图片尺寸过大，最大允许 ${Math.sqrt(maxPixels).toFixed(0)}x${Math.sqrt(maxPixels).toFixed(0)} 像素`,
            'IMAGE_TOO_LARGE',
            { width: imageMetadata.width, height: imageMetadata.height, pixels, maxPixels }
          )
        }
        
        // 处理图片
        if (options.imageOptions) {
          file.buffer = await this.processImage(file.buffer, options.imageOptions)
        } else {
          // 如果没有指定处理选项，但图片较大，则自动优化
          if (file.size > 1024 * 1024) { // 大于1MB的图片自动优化
            file.buffer = await ImageProcessor.autoOptimize(file.buffer)
            this.logger.info({
              originalSize: file.size,
              optimizedSize: file.buffer.length,
              compressionRatio: ((file.size - file.buffer.length) / file.size * 100).toFixed(2) + '%'
            }, '自动优化大图片')
          }
        }
      }
      
      // 执行上传
      const result = await this.adapter.upload(file, options)
      
      this.logger.info({
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        success: result.success,
        url: result.url
      }, '文件上传完成')
      
      return result
    } catch (error: any) {
      this.logger.error({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        file: {
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType
        }
      }, '文件上传失败')
      
      throw error
    }
  }
  
  /**
   * 批量上传文件
   */
  async uploadFiles(files: FileInfo[], options: UploadOptions = {}): Promise<UploadResult[]> {
    const results: UploadResult[] = []
    
    for (const file of files) {
      try {
        const result = await this.uploadFile(file, {
          ...options,
          // 为每个文件生成独特的路径
          path: options.path ? `${options.path}/${file.originalName}` : undefined
        })
        results.push(result)
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message
        })
      }
    }
    
    return results
  }
  
  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<boolean> {
    try {
      const result = await this.adapter.delete(path)
      
      this.logger.info({ path, success: result }, '文件删除操作')
      
      return result
    } catch (error: any) {
      this.logger.error({
        error: {
          name: error.name,
          message: error.message
        },
        path
      }, '文件删除失败')
      
      throw error
    }
  }
  
  /**
   * 获取文件URL
   */
  async getFileUrl(path: string): Promise<string> {
    return await this.adapter.getUrl(path)
  }
  
  /**
   * 检查文件是否存在
   */
  async fileExists(path: string): Promise<boolean> {
    return await this.adapter.exists(path)
  }
  
  /**
   * 获取文件信息
   */
  async getFileInfo(path: string) {
    return await this.adapter.getFileInfo(path)
  }
  
  /**
   * 验证文件基本信息
   */
  private validateFile(file: FileInfo): void {
    // 检查文件大小
    if (file.size > this.config.maxFileSize) {
      throw new FileValidationError(
        `文件大小超过限制。最大允许 ${this.formatFileSize(this.config.maxFileSize)}，实际大小 ${this.formatFileSize(file.size)}`,
        'FILE_TOO_LARGE',
        { maxSize: this.config.maxFileSize, actualSize: file.size }
      )
    }
    
    // 检查文件大小下限（防止空文件）
    if (file.size === 0) {
      throw new FileValidationError(
        '不允许上传空文件',
        'EMPTY_FILE',
        { actualSize: file.size }
      )
    }
    
    // 检查文件名
    if (!file.originalName || file.originalName.trim() === '') {
      throw new FileValidationError(
        '文件名不能为空',
        'INVALID_FILENAME',
        { filename: file.originalName }
      )
    }
    
    // 检查文件名长度
    if (file.originalName.length > 255) {
      throw new FileValidationError(
        '文件名过长，最大长度为255个字符',
        'FILENAME_TOO_LONG',
        { filename: file.originalName, length: file.originalName.length }
      )
    }
    
    // 检查文件名中的危险字符
    const dangerousChars = /[<>:"|?*\x00-\x1f]/
    if (dangerousChars.test(file.originalName)) {
      throw new FileValidationError(
        '文件名包含非法字符',
        'INVALID_FILENAME_CHARS',
        { filename: file.originalName }
      )
    }
    
    // 检查文件类型
    if (this.config.allowedTypes.length > 0 && !this.config.allowedTypes.includes(file.mimeType)) {
      throw new FileValidationError(
        `不支持的文件类型: ${file.mimeType}`,
        'INVALID_FILE_TYPE',
        { allowedTypes: this.config.allowedTypes, actualType: file.mimeType }
      )
    }
    
    // 检查文件扩展名
    if (this.config.allowedExtensions.length > 0 && !this.config.allowedExtensions.includes(file.extension.toLowerCase())) {
      throw new FileValidationError(
        `不支持的文件扩展名: ${file.extension}`,
        'INVALID_FILE_EXTENSION',
        { allowedExtensions: this.config.allowedExtensions, actualExtension: file.extension }
      )
    }
  }
  
  /**
   * 执行安全检查
   */
  private async performSecurityChecks(file: FileInfo): Promise<void> {
    // 文件内容验证（基于文件头）
    this.validateFileContent(file)
    
    // 检查可执行文件
    this.checkExecutableFile(file)
    
    // 检查恶意文件扩展名
    this.checkMaliciousExtensions(file)
    
    // 检查双重扩展名
    this.checkDoubleExtensions(file)
    
    // 检查文件内容中的恶意代码（基本检查）
    this.scanForMaliciousContent(file)
  }
  
  /**
   * 验证文件内容（基于文件头魔数）
   */
  private validateFileContent(file: FileInfo): void {
    const buffer = file.buffer
    if (buffer.length < 4) return
    
    // 常见文件类型的魔数（文件头）
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
      'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
      'text/plain': [], // 文本文件不检查魔数
      'application/json': [], // JSON文件不检查魔数
      'text/csv': [] // CSV文件不检查魔数
    }
    
    const expectedSignatures = signatures[file.mimeType]
    if (!expectedSignatures || expectedSignatures.length === 0) return // 没有定义签名的文件类型跳过检查
    
    const isValid = expectedSignatures.some(signature => {
      return signature.every((byte, index) => buffer[index] === byte)
    })
    
    if (!isValid) {
      throw new FileValidationError(
        '文件内容与声明的类型不匹配，可能是伪造的文件',
        'FILE_CONTENT_MISMATCH',
        { declaredType: file.mimeType, fileHeader: Array.from(buffer.slice(0, 8)) }
      )
    }
  }
  
  /**
   * 检查可执行文件
   */
  private checkExecutableFile(file: FileInfo): void {
    const executableExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
      '.app', '.deb', '.pkg', '.dmg', '.run', '.bin', '.sh', '.ps1'
    ]
    
    const extension = file.extension.toLowerCase()
    if (executableExtensions.includes(extension)) {
      throw new FileValidationError(
        '不允许上传可执行文件',
        'EXECUTABLE_FILE_FORBIDDEN',
        { extension, filename: file.originalName }
      )
    }
    
    // 检查PE文件头（Windows可执行文件）
    const buffer = file.buffer
    if (buffer.length >= 2) {
      const mzHeader = buffer[0] === 0x4D && buffer[1] === 0x5A // "MZ"
      if (mzHeader) {
        throw new FileValidationError(
          '检测到Windows可执行文件，禁止上传',
          'PE_FILE_FORBIDDEN',
          { filename: file.originalName }
        )
      }
    }
    
    // 检查ELF文件头（Linux可执行文件）
    if (buffer.length >= 4) {
      const elfHeader = buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46 // "\x7FELF"
      if (elfHeader) {
        throw new FileValidationError(
          '检测到ELF可执行文件，禁止上传',
          'ELF_FILE_FORBIDDEN',
          { filename: file.originalName }
        )
      }
    }
  }
  
  /**
   * 检查恶意文件扩展名
   */
  private checkMaliciousExtensions(file: FileInfo): void {
    const maliciousExtensions = [
      '.php', '.asp', '.aspx', '.jsp', '.jspx', '.cgi', '.pl', '.py', '.rb',
      '.htaccess', '.htpasswd', '.config', '.ini', '.conf'
    ]
    
    const extension = file.extension.toLowerCase()
    if (maliciousExtensions.includes(extension)) {
      throw new FileValidationError(
        '不允许上传此类型的文件',
        'MALICIOUS_EXTENSION',
        { extension, filename: file.originalName }
      )
    }
  }
  
  /**
   * 检查双重扩展名
   */
  private checkDoubleExtensions(file: FileInfo): void {
    const filename = file.originalName.toLowerCase()
    const parts = filename.split('.')
    
    if (parts.length > 2) {
      const secondLastExt = '.' + parts[parts.length - 2]
      const dangerousSecondExts = ['.php', '.asp', '.jsp', '.exe', '.bat', '.cmd']
      
      if (dangerousSecondExts.includes(secondLastExt)) {
        throw new FileValidationError(
          '检测到可疑的双重扩展名',
          'DOUBLE_EXTENSION_SUSPICIOUS',
          { filename: file.originalName, suspiciousExtension: secondLastExt }
        )
      }
    }
  }
  
  /**
   * 扫描文件内容中的恶意代码（基本检查）
   */
  private scanForMaliciousContent(file: FileInfo): void {
    const content = file.buffer.toString('utf8', 0, Math.min(1024, file.buffer.length)) // 只检查前1KB内容
    
    // 检查常见的恶意脚本标签
    const maliciousPatterns = [
      /<\s*script[^>]*>/i,
      /<\s*iframe[^>]*>/i,
      /<\s*object[^>]*>/i,
      /<\s*embed[^>]*>/i,
      /javascript\s*:/i,
      /vbscript\s*:/i,
      /data\s*:\s*text\/html/i,
      /eval\s*\(/i,
      /document\.write/i,
      /window\.location/i
    ]
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        throw new FileValidationError(
          '文件内容包含可疑的脚本代码',
          'MALICIOUS_CONTENT_DETECTED',
          { 
            filename: file.originalName,
            pattern: pattern.toString(),
            contentPreview: content.substring(0, 100)
          }
        )
      }
    }
    
    // 对于图片文件，检查EXIF数据中的恶意内容
    if (this.isImage(file.mimeType)) {
      this.scanImageExifData(file)
    }
  }
  
  /**
   * 扫描图片EXIF数据
   */
  private scanImageExifData(file: FileInfo): void {
    const buffer = file.buffer
    const content = buffer.toString('binary')
    
    // 检查EXIF数据中的可疑内容
    const suspiciousPatterns = [
      /<script/i,
      /javascript/i,
      /<?php/i,
      /<%/i
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new FileValidationError(
          '图片EXIF数据包含可疑内容',
          'MALICIOUS_EXIF_DATA',
          { filename: file.originalName }
        )
      }
    }
  }
  
  /**
   * 检查是否为图片文件
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/')
  }
  
  /**
   * 处理图片（压缩、调整大小等）
   */
  private async processImage(buffer: Buffer, options: ImageProcessOptions): Promise<Buffer> {
    try {
      this.logger.debug({
        originalSize: buffer.length, 
        options
      }, '开始处理图片')
      
      // 使用ImageProcessor进行图片处理
      const result = await ImageProcessor.processImage(buffer, options)
      
      this.logger.info({
        originalSize: result.info.originalSize,
        processedSize: result.info.size,
        compressionRatio: result.info.compressionRatio,
        format: result.info.format,
        dimensions: `${result.info.width}x${result.info.height}`
      }, '图片处理完成')
      
      return result.buffer
    } catch (error: any) {
      this.logger.warn({
        error: error.message,
        options
      }, '图片处理失败，使用原图')
      
      // 如果处理失败，尝试自动优化
      try {
        return await ImageProcessor.autoOptimize(buffer)
      } catch (optimizeError: any) {
        this.logger.warn({
          error: optimizeError.message
        }, '自动优化也失败，返回原图')
        return buffer
      }
    }
  }
  
  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
  
  /**
   * 获取支持的文件类型描述
   */
  getSupportedTypes(): {
    types: string[]
    extensions: string[]
    maxSize: string
  } {
    return {
      types: this.config.allowedTypes,
      extensions: this.config.allowedExtensions,
      maxSize: this.formatFileSize(this.config.maxFileSize)
    }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<UploadConfig>): void {
    this.config = { ...this.config, ...config }
    
    this.logger.info({
      newConfig: this.config
    }, '文件上传配置已更新')
  }
}

// 文件上传服务单例
let uploadServiceInstance: FileUploadService | null = null

/**
 * 获取文件上传服务实例
 */
export function getUploadService(): FileUploadService {
  if (!uploadServiceInstance) {
    throw new Error('文件上传服务未初始化，请先调用 initUploadService()')
  }
  return uploadServiceInstance
}

/**
 * 初始化文件上传服务
 */
export function initUploadService(config: UploadConfig, adapterConfig: any): FileUploadService {
  uploadServiceInstance = new FileUploadService(config, adapterConfig)
  return uploadServiceInstance
}

/**
 * 销毁文件上传服务实例
 */
export function destroyUploadService(): void {
  uploadServiceInstance = null
}