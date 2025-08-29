/**
 * 文件上传路由
 * 提供文件上传、删除、查看等API接口
 */

import { Hono, Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppContext } from '../types'
import { 
  getUploadService,
  initUploadService
} from '../services/upload.js'
import { 
  getFullUploadConfig,
  validateStorageConfig,
  getConfigSummary
} from '../config/upload.js'
import { 
  FileInfo,
  FileValidationError,
  StorageError
} from '../types/upload'
import { authMiddleware } from '../middleware/auth'
import { uploadSecurityMiddleware } from '../middleware/uploadSecurity'
import { logger } from '../utils/logger'

const upload = new Hono<AppContext>()
const uploadLogger = logger.child({ module: 'upload-routes' })

// 初始化上传服务
try {
  const { uploadConfig, adapterConfig } = getFullUploadConfig()
  validateStorageConfig(uploadConfig.storageType)
  initUploadService(uploadConfig, adapterConfig)
  
  uploadLogger.info({
    config: getConfigSummary()
  }, '文件上传服务初始化成功')
} catch (error: any) {
  uploadLogger.error({
    error: {
      name: error.name,
      message: error.message
    }
  }, '文件上传服务初始化失败')
}

// 上传配置查询
upload.get('/config', (c) => {
  try {
    const uploadService = getUploadService()
    const config = uploadService.getSupportedTypes()
    
    return c.get('success')({
      ...config,
      ...getConfigSummary()
    }, '获取上传配置成功')
  } catch (error) {
    return c.get('error')(500, '获取上传配置失败')
  }
})

// 文件上传验证schema
const uploadSchema = z.object({
  path: z.string().optional().describe('自定义上传路径'),
  overwrite: z.string().transform(val => val === 'true').optional().describe('是否覆盖existing文件'),
  
  // 图片处理选项
  resize_width: z.string().transform(val => parseInt(val, 10)).optional().describe('调整宽度'),
  resize_height: z.string().transform(val => parseInt(val, 10)).optional().describe('调整高度'),
  keep_aspect_ratio: z.string().transform(val => val === 'true').optional().describe('保持宽高比'),
  quality: z.string().transform(val => parseInt(val, 10)).optional().describe('压缩质量 0-100'),
  format: z.enum(['jpeg', 'png', 'webp']).optional().describe('输出格式'),
  
  // 缩略图选项
  generate_thumbnail: z.string().transform(val => val === 'true').optional().describe('生成缩略图'),
  thumbnail_width: z.string().transform(val => parseInt(val, 10)).optional().describe('缩略图宽度'),
  thumbnail_height: z.string().transform(val => parseInt(val, 10)).optional().describe('缩略图高度'),
  thumbnail_suffix: z.string().optional().describe('缩略图后缀'),
  
  // 自动优化
  auto_optimize: z.string().transform(val => val === 'true').optional().describe('自动优化'),
  target_size: z.string().transform(val => parseInt(val, 10)).optional().describe('目标文件大小(字节)')
})

// 解析multipart/form-data的中间件
const parseFormData = async (c: Context<AppContext>, next: () => Promise<void>) => {
  try {
    const contentType = c.req.header('content-type')
    if (!contentType?.includes('multipart/form-data')) {
      return c.get('error')(400, '请使用 multipart/form-data 格式上传文件')
    }
    
    // 解析form data
    const formData = await c.req.formData()
    const files: FileInfo[] = []
    const fields: Record<string, string> = {}
    
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'object' && value !== null && 'name' in value && 'size' in value && 'type' in value && 'arrayBuffer' in value) {
        const fileValue = value as any // 类型断言
        const buffer = await fileValue.arrayBuffer()
        const fileInfo: FileInfo = {
          originalName: fileValue.name,
          size: fileValue.size,
          mimeType: fileValue.type,
          extension: '.' + (fileValue.name.split('.').pop()?.toLowerCase() || ''),
          buffer: Buffer.from(buffer)
        }
        files.push(fileInfo)
      } else {
        fields[key] = value
      }
    }
    
    c.set('files', files)
    c.set('fields', fields)
    
    await next()
  } catch (error: any) {
    uploadLogger.error({
      error: {
        name: error.name,
        message: error.message
      }
    }, '解析上传数据失败')
    
    return c.get('error')(400, '解析上传数据失败')
  }
}

// 单文件上传
upload.post('/single',
  uploadSecurityMiddleware,
  authMiddleware,
  parseFormData,
  zValidator('form', uploadSchema),
  async (c) => {
    try {
      const uploadService = getUploadService()
      const files = c.get('files') as FileInfo[]
      const options = c.req.valid('form')
      
      if (!files || files.length === 0) {
        return c.get('error')(400, '没有找到上传的文件')
      }
      
      if (files.length > 1) {
        return c.get('error')(400, '单文件上传接口只能上传一个文件')
      }
      
      const file = files[0]
      
      // 构建上传选项
      const uploadOptions: any = {
        path: options.path,
        overwrite: options.overwrite
      }
      
      // 图片处理选项
      const hasImageOptions = options.resize_width || options.resize_height || 
                              options.quality || options.format || 
                              options.generate_thumbnail || options.auto_optimize
      
      if (hasImageOptions) {
        uploadOptions.imageOptions = {}
        
        // 尺寸调整
        if (options.resize_width || options.resize_height) {
          uploadOptions.imageOptions.resize = {
            width: options.resize_width,
            height: options.resize_height,
            keepAspectRatio: options.keep_aspect_ratio !== false // 默认保持宽高比
          }
        }
        
        // 质量和格式
        if (options.quality) uploadOptions.imageOptions.quality = options.quality
        if (options.format) uploadOptions.imageOptions.format = options.format
        
        // 缩略图
        if (options.generate_thumbnail) {
          uploadOptions.imageOptions.thumbnail = {
            width: options.thumbnail_width || 200,
            height: options.thumbnail_height || 200,
            suffix: options.thumbnail_suffix || '_thumb'
          }
        }
      }
      
      // 自动优化处理
      if (options.auto_optimize && options.target_size) {
        uploadOptions.autoOptimize = {
          targetSize: options.target_size
        }
      }
      
      const result = await uploadService.uploadFile(file, uploadOptions)
      
      if (result.success) {
        uploadLogger.info({
          userId: c.get('user')?.id,
          file: {
            originalName: file.originalName,
            size: file.size,
            url: result.url
          }
        }, '文件上传成功')
        
        return c.get('success')({
          url: result.url,
          path: result.path,
          filename: result.filename,
          size: result.size,
          originalName: file.originalName,
          mimeType: file.mimeType,
          metadata: result.metadata
        }, '文件上传成功')
      } else {
        return c.get('error')(400, result.error || '文件上传失败')
      }
    } catch (error: any) {
      uploadLogger.error({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        userId: c.get('user')?.id
      }, '文件上传失败')
      
      if (error instanceof FileValidationError) {
        return c.get('error')(400, error.message)
      }
      
      if (error instanceof StorageError) {
        return c.get('error')(500, '存储服务错误: ' + error.message)
      }
      
      return c.get('error')(500, '文件上传失败')
    }
  }
)

// 多文件上传
upload.post('/multiple',
  uploadSecurityMiddleware,
  authMiddleware,
  parseFormData,
  zValidator('form', uploadSchema),
  async (c) => {
    try {
      const uploadService = getUploadService()
      const files = c.get('files') as FileInfo[]
      const options = c.req.valid('form')
      
      if (!files || files.length === 0) {
        return c.get('error')(400, '没有找到上传的文件')
      }
      
      // 构建上传选项
      const uploadOptions: any = {
        path: options.path,
        overwrite: options.overwrite
      }
      
      // 图片处理选项
      const hasImageOptions = options.resize_width || options.resize_height || 
                              options.quality || options.format || 
                              options.generate_thumbnail || options.auto_optimize
      
      if (hasImageOptions) {
        uploadOptions.imageOptions = {}
        
        // 尺寸调整
        if (options.resize_width || options.resize_height) {
          uploadOptions.imageOptions.resize = {
            width: options.resize_width,
            height: options.resize_height,
            keepAspectRatio: options.keep_aspect_ratio !== false
          }
        }
        
        // 质量和格式
        if (options.quality) uploadOptions.imageOptions.quality = options.quality
        if (options.format) uploadOptions.imageOptions.format = options.format
        
        // 缩略图
        if (options.generate_thumbnail) {
          uploadOptions.imageOptions.thumbnail = {
            width: options.thumbnail_width || 200,
            height: options.thumbnail_height || 200,
            suffix: options.thumbnail_suffix || '_thumb'
          }
        }
      }
      
      const results = await uploadService.uploadFiles(files, uploadOptions)
      
      const successCount = results.filter((r: any) => r.success).length
      const failedCount = results.filter((r: any) => !r.success).length
      
      uploadLogger.info({
        userId: c.get('user')?.id,
        totalFiles: files.length,
        successCount,
        failedCount
      }, '批量文件上传完成')
      
      return c.get('success')({
        total: files.length,
        success: successCount,
        failed: failedCount,
        results: results.map((result: any, index: number) => ({
          originalName: files[index].originalName,
          ...result
        }))
      }, `批量上传完成: 成功 ${successCount} 个，失败 ${failedCount} 个`)
    } catch (error: any) {
      uploadLogger.error({
        error: {
          name: error.name,
          message: error.message
        },
        userId: c.get('user')?.id
      }, '批量文件上传失败')
      
      return c.get('error')(500, '批量文件上传失败')
    }
  }
)

// 删除文件
upload.delete('/:path{.+}',
  authMiddleware,
  async (c) => {
    try {
      const uploadService = getUploadService()
      const path = c.req.param('path')
      
      if (!path) {
        return c.get('error')(400, '缺少文件路径参数')
      }
      
      const result = await uploadService.deleteFile(path)
      
      if (result) {
        uploadLogger.info({
          userId: c.get('user')?.id,
          path
        }, '文件删除成功')
        
        return c.get('success')(null, '文件删除成功')
      } else {
        return c.get('error')(404, '文件不存在')
      }
    } catch (error: any) {
      uploadLogger.error({
        error: {
          name: error.name,
          message: error.message
        },
        userId: c.get('user')?.id,
        path: c.req.param('path')
      }, '文件删除失败')
      
      return c.get('error')(500, '文件删除失败')
    }
  }
)

// 获取文件信息
upload.get('/info/:path{.+}',
  authMiddleware,
  async (c) => {
    try {
      const uploadService = getUploadService()
      const path = c.req.param('path')
      
      if (!path) {
        return c.get('error')(400, '缺少文件路径参数')
      }
      
      const fileInfo = await uploadService.getFileInfo(path)
      
      if (fileInfo) {
        return c.get('success')(fileInfo, '获取文件信息成功')
      } else {
        return c.get('error')(404, '文件不存在')
      }
    } catch (error: any) {
      uploadLogger.error({
        error: {
          name: error.name,
          message: error.message
        },
        path: c.req.param('path')
      }, '获取文件信息失败')
      
      return c.get('error')(500, '获取文件信息失败')
    }
  }
)

// 检查文件是否存在
upload.get('/exists/:path{.+}',
  authMiddleware,
  async (c: Context<AppContext>) => {
    try {
      const uploadService = getUploadService()
      const path = c.req.param('path')
      
      if (!path) {
        return c.get('error')(400, '缺少文件路径参数')
      }
      
      const exists = await uploadService.fileExists(path)
      
      return c.get('success')({ exists }, exists ? '文件存在' : '文件不存在')
    } catch (error) {
      return c.get('error')(500, '检查文件失败')
    }
  }
)

export default upload