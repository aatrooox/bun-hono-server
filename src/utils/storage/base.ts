/**
 * 存储适配器基础抽象类
 * 定义统一的文件存储接口，支持多种存储后端
 */

import { 
  StorageAdapter, 
  FileInfo, 
  UploadResult, 
  UploadOptions, 
  FileMetadata, 
  StorageError 
} from '../../types/upload'
import { logger } from '../logger'

// 存储适配器抽象基类
export abstract class BaseStorageAdapter implements StorageAdapter {
  protected logger = logger.child({ module: 'storage' })
  
  // 抽象方法 - 子类必须实现
  abstract upload(file: FileInfo, options?: UploadOptions): Promise<UploadResult>
  abstract delete(path: string): Promise<boolean>
  abstract getUrl(path: string): Promise<string>
  abstract exists(path: string): Promise<boolean>
  abstract getFileInfo(path: string): Promise<FileMetadata | null>
  
  // 通用方法
  
  /**
   * 生成唯一文件名
   * @param originalName 原始文件名
   * @param extension 文件扩展名
   * @returns 唯一文件名
   */
  protected generateUniqueFilename(originalName: string, extension: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const sanitizedName = this.sanitizeFilename(originalName.replace(/\.[^/.]+$/, ''))
    return `${sanitizedName}_${timestamp}_${random}${extension}`
  }
  
  /**
   * 清理文件名，移除不安全字符
   * @param filename 原始文件名
   * @returns 清理后的文件名
   */
  protected sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^\w\s.-]/g, '') // 只保留字母数字、空格、点和连字符
      .replace(/\s+/g, '_') // 空格替换为下划线
      .replace(/_{2,}/g, '_') // 多个下划线合并
      .toLowerCase()
  }
  
  /**
   * 生成存储路径
   * @param filename 文件名
   * @param customPath 自定义路径
   * @param createDateDir 是否创建日期目录
   * @returns 完整存储路径
   */
  protected generateStoragePath(
    filename: string, 
    customPath?: string, 
    createDateDir: boolean = true
  ): string {
    const parts = []
    
    if (customPath) {
      parts.push(customPath.replace(/^\/|\/$/g, ''))
    }
    
    if (createDateDir) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      parts.push(`${year}/${month}/${day}`)
    }
    
    parts.push(filename)
    
    return parts.join('/')
  }
  
  /**
   * 计算文件哈希值（用于重复检测）
   * @param buffer 文件缓冲区
   * @returns 文件哈希值
   */
  protected calculateFileHash(buffer: Buffer): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }
  
  /**
   * 验证文件类型
   * @param file 文件信息
   * @param allowedTypes 允许的MIME类型
   * @param allowedExtensions 允许的文件扩展名
   */
  protected validateFile(
    file: FileInfo, 
    allowedTypes: string[], 
    allowedExtensions: string[]
  ): void {
    // 验证MIME类型
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimeType)) {
      throw new StorageError(
        `不支持的文件类型: ${file.mimeType}`,
        'INVALID_FILE_TYPE',
        this.constructor.name
      )
    }
    
    // 验证文件扩展名
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(file.extension)) {
      throw new StorageError(
        `不支持的文件扩展名: ${file.extension}`,
        'INVALID_FILE_EXTENSION',
        this.constructor.name
      )
    }
  }
  
  /**
   * 处理上传错误
   * @param error 原始错误
   * @param operation 操作名称
   */
  protected handleError(error: any, operation: string): never {
    this.logger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      operation,
      provider: this.constructor.name
    }, `存储操作失败: ${operation}`)
    
    if (error instanceof StorageError) {
      throw error
    }
    
    throw new StorageError(
      `${operation}失败: ${error.message}`,
      'STORAGE_OPERATION_FAILED',
      this.constructor.name
    )
  }
  
  /**
   * 记录操作日志
   * @param operation 操作名称
   * @param details 操作详情
   */
  protected logOperation(operation: string, details: any): void {
    this.logger.info({
      operation,
      provider: this.constructor.name,
      ...details
    }, `存储操作: ${operation}`)
  }
}

// 存储适配器工厂
export class StorageAdapterFactory {
  private static adapters = new Map<string, new (config: any) => StorageAdapter>()
  
  /**
   * 注册存储适配器
   * @param type 存储类型
   * @param adapter 适配器类
   */
  static register(type: string, adapter: new (config: any) => StorageAdapter): void {
    this.adapters.set(type, adapter)
  }
  
  /**
   * 创建存储适配器实例
   * @param type 存储类型
   * @param config 配置对象
   * @returns 存储适配器实例
   */
  static create(type: string, config: any): StorageAdapter {
    const AdapterClass = this.adapters.get(type)
    if (!AdapterClass) {
      throw new Error(`未注册的存储类型: ${type}`)
    }
    return new AdapterClass(config)
  }
  
  /**
   * 获取已注册的存储类型列表
   * @returns 存储类型数组
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.adapters.keys())
  }
}