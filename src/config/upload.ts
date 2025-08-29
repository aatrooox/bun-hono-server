/**
 * 文件上传配置管理
 * 优先使用环境变量，如果不存在则使用默认值
 */

import { z } from 'zod'
import { 
  UploadConfig, 
  LocalStorageConfig, 
  COSStorageConfig, 
  StorageType 
} from '../types/upload'

/**
 * 获取环境变量数值，提供默认值
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  return value ? parseInt(value, 10) : defaultValue
}

/**
 * 获取环境变量字符串，提供默认值
 */
function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

/**
 * 获取环境变量布尔值，提供默认值
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return value === 'true'
}

/**
 * 默认文件上传配置
 */
const defaultUploadConfig = {
  // 基础配置
  storageType: getEnvString('UPLOAD_STORAGE_TYPE', 'local') as StorageType,
  maxFileSize: getEnvNumber('UPLOAD_MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
  allowedTypes: getEnvString('UPLOAD_ALLOWED_TYPES', 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain').split(',').map(t => t.trim()),
  allowedExtensions: getEnvString('UPLOAD_ALLOWED_EXTENSIONS', '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt').split(',').map(e => e.trim().toLowerCase()),
  uploadPath: getEnvString('UPLOAD_PATH_PREFIX', 'uploads'),
  
  // 安全配置
  security: {
    enableSecurityScan: getEnvBoolean('UPLOAD_ENABLE_SECURITY_SCAN', true),
    blockExecutableFiles: getEnvBoolean('UPLOAD_BLOCK_EXECUTABLE_FILES', true),
    scanFileContent: getEnvBoolean('UPLOAD_SCAN_FILE_CONTENT', true),
    maxFilenameLength: getEnvNumber('UPLOAD_MAX_FILENAME_LENGTH', 255),
    quarantineSuspiciousFiles: getEnvBoolean('UPLOAD_QUARANTINE_SUSPICIOUS_FILES', false)
  },
  
  // 本地存储配置
  local: {
    uploadDir: getEnvString('UPLOAD_LOCAL_DIR', './uploads'),
    baseUrl: getEnvString('UPLOAD_LOCAL_BASE_URL', 'http://localhost:4778/uploads'),
    createDateDir: getEnvBoolean('UPLOAD_LOCAL_CREATE_DATE_DIR', true),
    fileMode: 0o644
  },
  
  // 腾讯云COS配置
  cos: {
    appId: getEnvString('COS_APP_ID', ''),
    secretId: getEnvString('COS_SECRET_ID', ''),
    secretKey: getEnvString('COS_SECRET_KEY', ''),
    bucket: getEnvString('COS_BUCKET', ''),
    region: getEnvString('COS_REGION', ''),
    domain: process.env.COS_DOMAIN,
    prefix: process.env.COS_PREFIX,
    https: getEnvBoolean('COS_HTTPS', true)
  },
  
  // AWS S3配置
  s3: {
    accessKeyId: getEnvString('S3_ACCESS_KEY_ID', ''),
    secretAccessKey: getEnvString('S3_SECRET_ACCESS_KEY', ''),
    bucket: getEnvString('S3_BUCKET', ''),
    region: getEnvString('S3_REGION', 'us-east-1'),
    endpoint: process.env.S3_ENDPOINT
  },
  
  // 阿里云OSS配置
  oss: {
    accessKeyId: getEnvString('OSS_ACCESS_KEY_ID', ''),
    accessKeySecret: getEnvString('OSS_ACCESS_KEY_SECRET', ''),
    bucket: getEnvString('OSS_BUCKET', ''),
    region: getEnvString('OSS_REGION', 'oss-cn-hangzhou'),
    endpoint: process.env.OSS_ENDPOINT
  }
}

/**
 * 获取基于环境的动态配置
 */
function getEnvironmentUploadConfig(environment: string = process.env.NODE_ENV || 'development') {
  const config = { ...defaultUploadConfig }
  
  // 生产环境配置
  if (environment === 'production') {
    return {
      ...config,
      maxFileSize: Math.min(config.maxFileSize, 50 * 1024 * 1024), // 生产环境最多50MB
      security: {
        ...config.security,
        enableSecurityScan: true, // 生产环境强制开启安全扫描
        blockExecutableFiles: true, // 生产环境强制阻止可执行文件
        scanFileContent: true
      },
      storageType: config.storageType === 'local' ? 'cos' : config.storageType // 生产环境推荐使用对象存储
    }
  }
  
  // 开发环境配置
  if (environment === 'development') {
    return {
      ...config,
      maxFileSize: Math.max(config.maxFileSize, 20 * 1024 * 1024), // 开发环境更大的文件限制
      security: {
        ...config.security,
        enableSecurityScan: false, // 开发环境可以关闭安全扫描以提高性能
        quarantineSuspiciousFiles: false
      }
    }
  }
  
  // 测试环境配置
  if (environment === 'test') {
    return {
      ...config,
      storageType: 'local' as StorageType,
      maxFileSize: 1024 * 1024, // 1MB
      allowedTypes: ['image/jpeg', 'image/png', 'text/plain'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.txt'],
      security: {
        enableSecurityScan: false,
        blockExecutableFiles: true,
        scanFileContent: false,
        maxFilenameLength: 50,
        quarantineSuspiciousFiles: false
      },
      local: {
        ...config.local,
        uploadDir: './test-uploads',
        baseUrl: 'http://localhost:3000/test-uploads',
        createDateDir: false
      }
    }
  }
  
  return config
}

/**
 * 获取上传配置
 */
export function getUploadConfig(): UploadConfig {
  const config = getEnvironmentUploadConfig()
  
  return {
    storageType: config.storageType,
    maxFileSize: config.maxFileSize,
    allowedTypes: config.allowedTypes,
    allowedExtensions: config.allowedExtensions,
    uploadPath: config.uploadPath,
    // 安全配置
    enableSecurityScan: config.security.enableSecurityScan,
    blockExecutableFiles: config.security.blockExecutableFiles,
    scanFileContent: config.security.scanFileContent,
    maxFilenameLength: config.security.maxFilenameLength,
    quarantineSuspiciousFiles: config.security.quarantineSuspiciousFiles
  }
}

/**
 * 获取安全配置
 */
export function getUploadSecurityConfig() {
  const config = getEnvironmentUploadConfig()
  return config.security
}

// 获取本地存储配置
export function getLocalStorageConfig(): LocalStorageConfig {
  const config = getEnvironmentUploadConfig()
  return config.local
}

// 获取腾讯云COS配置
export function getCOSStorageConfig(): COSStorageConfig {
  const config = getEnvironmentUploadConfig()
  
  // 验证必需的COS配置
  const requiredFields = {
    secretId: config.cos.secretId,
    secretKey: config.cos.secretKey,
    bucket: config.cos.bucket,
    region: config.cos.region
  }
  
  const missing = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key)
  
  if (missing.length > 0) {
    throw new Error(`腾讯云COS配置缺失: ${missing.join(', ')}`)
  }
  
  return {
    appId: config.cos.appId,
    secretId: config.cos.secretId,
    secretKey: config.cos.secretKey,
    bucket: config.cos.bucket,
    region: config.cos.region,
    domain: config.cos.domain,
    prefix: config.cos.prefix,
    https: config.cos.https
  }
}

/**
 * 获取S3存储配置
 */
export function getS3StorageConfig() {
  const config = getEnvironmentUploadConfig()
  
  const requiredFields = {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
    bucket: config.s3.bucket,
    region: config.s3.region
  }
  
  const missing = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key)
  
  if (missing.length > 0) {
    throw new Error(`AWS S3配置缺失: ${missing.join(', ')}`)
  }
  
  return config.s3
}

/**
 * 获取OSS存储配置
 */
export function getOSSStorageConfig() {
  const config = getEnvironmentUploadConfig()
  
  const requiredFields = {
    accessKeyId: config.oss.accessKeyId,
    accessKeySecret: config.oss.accessKeySecret,
    bucket: config.oss.bucket,
    region: config.oss.region
  }
  
  const missing = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key)
  
  if (missing.length > 0) {
    throw new Error(`阿里云OSS配置缺失: ${missing.join(', ')}`)
  }
  
  return config.oss
}

// 根据存储类型获取对应的适配器配置
export function getStorageAdapterConfig(storageType: StorageType) {
  switch (storageType) {
    case 'local':
      return getLocalStorageConfig()
    case 'cos':
      return getCOSStorageConfig()
    case 's3':
      return getS3StorageConfig()
    case 'oss':
      return getOSSStorageConfig()
    default:
      throw new Error(`不支持的存储类型: ${storageType}`)
  }
}

// 验证存储配置
export function validateStorageConfig(storageType: StorageType): void {
  try {
    getStorageAdapterConfig(storageType)
  } catch (error: any) {
    throw new Error(`存储配置验证失败: ${error.message}`)
  }
}

// 获取完整的上传配置
export function getFullUploadConfig() {
  const uploadConfig = getUploadConfig()
  const adapterConfig = getStorageAdapterConfig(uploadConfig.storageType)
  
  return {
    uploadConfig,
    adapterConfig
  }
}

// 配置详情（用于调试和状态显示）
export function getConfigSummary() {
  const uploadConfig = getUploadConfig()
  const securityConfig = getUploadSecurityConfig()
  
  return {
    storageType: uploadConfig.storageType,
    maxFileSize: `${(uploadConfig.maxFileSize / 1024 / 1024).toFixed(1)}MB`,
    allowedTypes: uploadConfig.allowedTypes,
    allowedExtensions: uploadConfig.allowedExtensions,
    uploadPath: uploadConfig.uploadPath,
    security: {
      enableSecurityScan: securityConfig.enableSecurityScan,
      blockExecutableFiles: securityConfig.blockExecutableFiles,
      scanFileContent: securityConfig.scanFileContent
    }
  }
}

/**
 * 导出默认配置和环境配置函数
 */
export { defaultUploadConfig, getEnvironmentUploadConfig }