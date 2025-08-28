/**
 * 文件上传配置管理
 * 从环境变量读取和验证文件上传配置
 */

import { z } from 'zod'
import { 
  UploadConfig, 
  LocalStorageConfig, 
  COSStorageConfig, 
  StorageType 
} from '../types/upload'

// 文件上传环境变量schema
const uploadConfigSchema = z.object({
  // 基础配置
  UPLOAD_STORAGE_TYPE: z.enum(['local', 'cos', 's3', 'oss']).default('local'),
  UPLOAD_MAX_FILE_SIZE: z.string().transform(val => parseInt(val, 10)).default('10485760'), // 10MB
  UPLOAD_ALLOWED_TYPES: z.string().default('image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain'),
  UPLOAD_ALLOWED_EXTENSIONS: z.string().default('.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt'),
  UPLOAD_PATH_PREFIX: z.string().default('uploads'),
  
  // 安全配置
  UPLOAD_ENABLE_SECURITY_SCAN: z.string().transform(val => val === 'true').default('true'),
  UPLOAD_BLOCK_EXECUTABLE_FILES: z.string().transform(val => val === 'true').default('true'),
  UPLOAD_SCAN_FILE_CONTENT: z.string().transform(val => val === 'true').default('true'),
  UPLOAD_MAX_FILENAME_LENGTH: z.string().transform(val => parseInt(val, 10)).default('255'),
  UPLOAD_QUARANTINE_SUSPICIOUS_FILES: z.string().transform(val => val === 'true').default('false'),
  
  // 本地存储配置
  UPLOAD_LOCAL_DIR: z.string().default('./uploads'),
  UPLOAD_LOCAL_BASE_URL: z.string().default('http://localhost:3000/static/uploads'),
  UPLOAD_LOCAL_CREATE_DATE_DIR: z.string().transform(val => val === 'true').default('true'),
  
  // 腾讯云COS配置
  COS_APP_ID: z.string().optional(),
  COS_SECRET_ID: z.string().optional(),
  COS_SECRET_KEY: z.string().optional(),
  COS_BUCKET: z.string().optional(),
  COS_REGION: z.string().optional(),
  COS_DOMAIN: z.string().optional(),
  COS_PREFIX: z.string().optional(),
  COS_HTTPS: z.string().transform(val => val === 'true').default('true'),
  
  // AWS S3配置
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  
  // 阿里云OSS配置
  OSS_ACCESS_KEY_ID: z.string().optional(),
  OSS_ACCESS_KEY_SECRET: z.string().optional(),
  OSS_BUCKET: z.string().optional(),
  OSS_REGION: z.string().optional(),
  OSS_ENDPOINT: z.string().optional()
})

// 解析和验证环境变量
function parseUploadEnv() {
  const result = uploadConfigSchema.safeParse(process.env)
  
  if (!result.success) {
    throw new Error(`文件上传配置验证失败: ${result.error.message}`)
  }
  
  return result.data
}

// 获取上传配置
export function getUploadConfig(): UploadConfig {
  const env = parseUploadEnv()
  
  return {
    storageType: env.UPLOAD_STORAGE_TYPE as StorageType,
    maxFileSize: env.UPLOAD_MAX_FILE_SIZE,
    allowedTypes: env.UPLOAD_ALLOWED_TYPES.split(',').map(t => t.trim()).filter(Boolean),
    allowedExtensions: env.UPLOAD_ALLOWED_EXTENSIONS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
    uploadPath: env.UPLOAD_PATH_PREFIX,
    // 安全配置
    enableSecurityScan: env.UPLOAD_ENABLE_SECURITY_SCAN,
    blockExecutableFiles: env.UPLOAD_BLOCK_EXECUTABLE_FILES,
    scanFileContent: env.UPLOAD_SCAN_FILE_CONTENT,
    maxFilenameLength: env.UPLOAD_MAX_FILENAME_LENGTH,
    quarantineSuspiciousFiles: env.UPLOAD_QUARANTINE_SUSPICIOUS_FILES
  }
}

// 获取本地存储配置
export function getLocalStorageConfig(): LocalStorageConfig {
  const env = parseUploadEnv()
  
  return {
    uploadDir: env.UPLOAD_LOCAL_DIR,
    baseUrl: env.UPLOAD_LOCAL_BASE_URL,
    createDateDir: env.UPLOAD_LOCAL_CREATE_DATE_DIR,
    fileMode: 0o644
  }
}

// 获取腾讯云COS配置
export function getCOSStorageConfig(): COSStorageConfig {
  const env = parseUploadEnv()
  
  // 验证必需的COS配置
  const requiredFields = ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET', 'COS_REGION']
  const missing = requiredFields.filter(field => !env[field as keyof typeof env])
  
  if (missing.length > 0) {
    throw new Error(`腾讯云COS配置缺失: ${missing.join(', ')}`)
  }
  
  return {
    appId: env.COS_APP_ID || '',
    secretId: env.COS_SECRET_ID!,
    secretKey: env.COS_SECRET_KEY!,
    bucket: env.COS_BUCKET!,
    region: env.COS_REGION!,
    domain: env.COS_DOMAIN,
    prefix: env.COS_PREFIX,
    https: env.COS_HTTPS
  }
}

// 根据存储类型获取对应的适配器配置
export function getStorageAdapterConfig(storageType: StorageType) {
  switch (storageType) {
    case 'local':
      return getLocalStorageConfig()
    case 'cos':
      return getCOSStorageConfig()
    case 's3':
      // TODO: 实现S3配置
      throw new Error('S3存储适配器尚未实现')
    case 'oss':
      // TODO: 实现OSS配置
      throw new Error('OSS存储适配器尚未实现')
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
  
  return {
    storageType: uploadConfig.storageType,
    maxFileSize: `${(uploadConfig.maxFileSize / 1024 / 1024).toFixed(1)}MB`,
    allowedTypes: uploadConfig.allowedTypes,
    allowedExtensions: uploadConfig.allowedExtensions,
    uploadPath: uploadConfig.uploadPath
  }
}