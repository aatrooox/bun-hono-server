/**
 * 文件上传相关的类型定义
 * 支持本地存储和对象存储（腾讯云COS等）
 */

// 支持的存储类型
export type StorageType = 'local' | 'cos' | 's3' | 'oss'

// 文件上传配置
export interface UploadConfig {
  // 存储类型
  storageType: StorageType
  // 最大文件大小（字节）
  maxFileSize: number
  // 允许的文件类型
  allowedTypes: string[]
  // 允许的文件扩展名
  allowedExtensions: string[]
  // 上传路径前缀
  uploadPath: string
  // 安全配置
  enableSecurityScan?: boolean // 是否启用安全扫描
  blockExecutableFiles?: boolean // 是否阻止可执行文件
  scanFileContent?: boolean // 是否扫描文件内容
  maxFilenameLength?: number // 最大文件名长度
  quarantineSuspiciousFiles?: boolean // 是否隔离可疑文件
}

// 文件信息
export interface FileInfo {
  // 原始文件名
  originalName: string
  // 文件大小（字节）
  size: number
  // MIME类型
  mimeType: string
  // 文件扩展名
  extension: string
  // 文件缓冲区
  buffer: Buffer
  // 文件哈希值（用于重复检测）
  hash?: string
}

// 上传结果
export interface UploadResult {
  // 是否成功
  success: boolean
  // 文件访问URL
  url?: string
  // 文件存储路径
  path?: string
  // 文件名（生成的唯一名称）
  filename?: string
  // 文件大小
  size?: number
  // 错误信息
  error?: string
  // 额外信息
  metadata?: Record<string, any>
}

// 存储适配器接口
export interface StorageAdapter {
  // 上传文件
  upload(file: FileInfo, options?: UploadOptions): Promise<UploadResult>
  // 删除文件
  delete(path: string): Promise<boolean>
  // 获取文件URL
  getUrl(path: string): Promise<string>
  // 检查文件是否存在
  exists(path: string): Promise<boolean>
  // 获取文件信息
  getFileInfo(path: string): Promise<FileMetadata | null>
}

// 上传选项
export interface UploadOptions {
  // 自定义文件名
  filename?: string
  // 存储路径
  path?: string
  // 是否覆盖existing文件
  overwrite?: boolean
  // 图片处理选项
  imageOptions?: ImageProcessOptions
  // 自定义metadata
  metadata?: Record<string, any>
}

// 图片处理选项
export interface ImageProcessOptions {
  // 调整大小
  resize?: {
    width?: number
    height?: number
    // 保持宽高比
    keepAspectRatio?: boolean
  }
  // 压缩质量 (0-100)
  quality?: number
  // 输出格式
  format?: 'jpeg' | 'png' | 'webp'
  // 是否生成缩略图
  thumbnail?: {
    width: number
    height: number
    suffix?: string // 默认 '_thumb'
  }
}

// 文件元数据
export interface FileMetadata {
  filename: string
  size: number
  mimeType: string
  createdAt: Date
  modifiedAt: Date
  path: string
  url: string
  metadata?: Record<string, any>
}

// 本地存储配置
export interface LocalStorageConfig {
  // 上传根目录
  uploadDir: string
  // 静态文件服务URL前缀
  baseUrl: string
  // 是否创建日期子目录
  createDateDir?: boolean
  // 文件权限
  fileMode?: number
}

// 腾讯云COS配置
export interface COSStorageConfig {
  // 应用ID
  appId: string
  // 密钥ID
  secretId: string
  // 密钥Key
  secretKey: string
  // 存储桶名称
  bucket: string
  // 地域
  region: string
  // 自定义域名
  domain?: string
  // 存储路径前缀
  prefix?: string
  // 是否使用HTTPS
  https?: boolean
}

// 存储配置联合类型
export type StorageConfig = LocalStorageConfig | COSStorageConfig

// 文件验证错误类型
export class FileValidationError extends Error {
  public code: string
  public details?: any

  constructor(message: string, code: string, details?: any) {
    super(message)
    this.name = 'FileValidationError'
    this.code = code
    this.details = details
  }
}

// 存储错误类型
export class StorageError extends Error {
  public code: string
  public provider: string
  
  constructor(message: string, code: string, provider: string) {
    super(message)
    this.name = 'StorageError'
    this.code = code
    this.provider = provider
  }
}