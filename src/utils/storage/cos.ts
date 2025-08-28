/**
 * 腾讯云COS对象存储适配器
 * 提供文件上传到腾讯云COS的功能
 */

import COS from 'cos-nodejs-sdk-v5'
import { BaseStorageAdapter } from './base'
import { 
  FileInfo, 
  UploadResult, 
  UploadOptions, 
  FileMetadata, 
  COSStorageConfig,
  StorageError 
} from '../../types/upload'

export class COSStorageAdapter extends BaseStorageAdapter {
  private cos: COS
  private config: COSStorageConfig
  
  /**
   * 检查错误对象是否包含statusCode属性
   */
  private hasStatusCode(error: unknown): error is { statusCode: number } {
    return typeof error === 'object' && error !== null && 'statusCode' in error
  }
  
  constructor(config: COSStorageConfig) {
    super()
    this.config = {
      https: true,
      prefix: '',
      ...config
    }
    
    // 初始化COS客户端
    this.cos = new COS({
      SecretId: this.config.secretId,
      SecretKey: this.config.secretKey
    })
    
    this.logOperation('initialized', {
      bucket: this.config.bucket,
      region: this.config.region,
      prefix: this.config.prefix
    })
  }
  
  /**
   * 上传文件到腾讯云COS
   */
  async upload(file: FileInfo, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      // 计算文件哈希
      file.hash = this.calculateFileHash(file.buffer)
      
      // 生成文件名
      const filename = options.filename || 
        this.generateUniqueFilename(file.originalName, file.extension)
      
      // 生成存储路径
      let key = this.generateStoragePath(filename, options.path, true)
      
      // 添加前缀
      if (this.config.prefix) {
        key = `${this.config.prefix.replace(/\/$/, '')}/${key}`
      }
      
      // 检查文件是否存在
      if (!options.overwrite) {
        const exists = await this.exists(key)
        if (exists) {
          return {
            success: false,
            error: '文件已存在，请启用覆盖选项或使用不同的文件名'
          }
        }
      }
      
      // 准备上传参数
      const uploadParams: any = {
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        ContentLength: file.size
      }
      
      // 添加自定义元数据
      if (options.metadata) {
        uploadParams.Metadata = {
          'original-name': file.originalName,
          'file-hash': file.hash,
          'uploaded-at': new Date().toISOString(),
          ...options.metadata
        }
      }
      
      // 执行上传
      const result = await this.cosUpload(uploadParams)
      
      // 生成访问URL
      const url = await this.getUrl(key)
      
      this.logOperation('upload', {
        originalName: file.originalName,
        filename,
        size: file.size,
        key,
        url,
        etag: result.ETag
      })
      
      return {
        success: true,
        url,
        path: key,
        filename,
        size: file.size,
        metadata: {
          hash: file.hash,
          etag: result.ETag,
          location: result.Location,
          uploadedAt: new Date().toISOString(),
          ...options.metadata
        }
      }
    } catch (error) {
      this.handleError(error, 'upload')
    }
  }
  
  /**
   * 删除文件
   */
  async delete(path: string): Promise<boolean> {
    try {
      await this.cosPromise('deleteObject', {
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: path
      })
      
      this.logOperation('delete', { path })
      
      return true
    } catch (error) {
      if (this.hasStatusCode(error) && error.statusCode === 404) {
        return false // 文件不存在
      }
      this.handleError(error, 'delete')
    }
  }
  
  /**
   * 获取文件访问URL
   */
  async getUrl(path: string): Promise<string> {
    try {
      // 如果配置了自定义域名，使用自定义域名
      if (this.config.domain) {
        const protocol = this.config.https ? 'https' : 'http'
        return `${protocol}://${this.config.domain}/${path}`
      }
      
      // 使用COS默认域名
      const url = this.cos.getObjectUrl({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: path,
        Sign: false // 公开读取，不需要签名
      })
      
      return url
    } catch (error) {
      this.handleError(error, 'getUrl')
    }
  }
  
  /**
   * 生成预签名URL（用于临时访问）
   */
  async getSignedUrl(path: string, expires: number = 3600): Promise<string> {
    try {
      const url = this.cos.getObjectUrl({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: path,
        Sign: true,
        Expires: expires
      })
      
      return url
    } catch (error) {
      this.handleError(error, 'getSignedUrl')
    }
  }
  
  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.cosPromise('headObject', {
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: path
      })
      return true
    } catch (error) {
      if (this.hasStatusCode(error) && error.statusCode === 404) {
        return false
      }
      this.handleError(error, 'exists')
    }
  }
  
  /**
   * 获取文件信息
   */
  async getFileInfo(path: string): Promise<FileMetadata | null> {
    try {
      const result = await this.cosPromise('headObject', {
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: path
      })
      
      const url = await this.getUrl(path)
      
      return {
        filename: path.split('/').pop() || '',
        size: parseInt(result.headers['content-length'] || '0'),
        mimeType: result.headers['content-type'] || 'application/octet-stream',
        createdAt: new Date(result.headers['date'] || Date.now()),
        modifiedAt: new Date(result.headers['last-modified'] || Date.now()),
        path,
        url,
        metadata: {
          etag: result.headers.etag,
          ...result.headers
        }
      }
    } catch (error) {
      if (this.hasStatusCode(error) && error.statusCode === 404) {
        return null
      }
      this.handleError(error, 'getFileInfo')
    }
  }
  
  /**
   * 列出指定前缀的文件
   */
  async listFiles(prefix: string = '', maxKeys: number = 1000): Promise<FileMetadata[]> {
    try {
      const result = await this.cosPromise('getBucket', {
        Bucket: this.config.bucket,
        Region: this.config.region,
        Prefix: prefix,
        MaxKeys: maxKeys
      })
      
      const files: FileMetadata[] = []
      
      for (const item of result.Contents || []) {
        const url = await this.getUrl(item.Key)
        
        files.push({
          filename: item.Key.split('/').pop() || '',
          size: parseInt(item.Size || '0'),
          mimeType: 'application/octet-stream', // COS列表接口不返回content-type
          createdAt: new Date(item.LastModified),
          modifiedAt: new Date(item.LastModified),
          path: item.Key,
          url,
          metadata: {
            etag: item.ETag,
            storageClass: item.StorageClass
          }
        })
      }
      
      return files
    } catch (error) {
      this.handleError(error, 'listFiles')
    }
  }
  
  /**
   * 获取存储桶统计信息
   */
  async getStorageStats(): Promise<{
    totalFiles: number
    totalSize: number
    lastModified?: Date
  }> {
    try {
      const result = await this.cosPromise('getBucket', {
        Bucket: this.config.bucket,
        Region: this.config.region,
        MaxKeys: 1000 // 可以根据需要调整
      })
      
      const stats = {
        totalFiles: result.Contents?.length || 0,
        totalSize: 0,
        lastModified: undefined as Date | undefined
      }
      
      for (const item of result.Contents || []) {
        stats.totalSize += parseInt(item.Size || '0')
        
        const itemDate = new Date(item.LastModified)
        if (!stats.lastModified || itemDate > stats.lastModified) {
          stats.lastModified = itemDate
        }
      }
      
      return stats
    } catch (error) {
      this.handleError(error, 'getStorageStats')
    }
  }
  
  /**
   * 批量删除文件
   */
  async batchDelete(paths: string[]): Promise<{ success: string[], failed: string[] }> {
    try {
      const result = {
        success: [] as string[],
        failed: [] as string[]
      }
      
      // 分批处理，每批最多1000个文件
      const batchSize = 1000
      
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize)
        
        try {
          const deleteResult = await this.cosPromise('deleteMultipleObject', {
            Bucket: this.config.bucket,
            Region: this.config.region,
            Objects: batch.map(path => ({ Key: path }))
          })
          
          // 处理删除结果
          for (const deleted of deleteResult.Deleted || []) {
            result.success.push(deleted.Key)
          }
          
          for (const error of deleteResult.Error || []) {
            result.failed.push(error.Key)
          }
        } catch (error) {
          // 批量删除失败，将整批标记为失败
          result.failed.push(...batch)
        }
      }
      
      this.logOperation('batchDelete', {
        totalCount: paths.length,
        successCount: result.success.length,
        failedCount: result.failed.length
      })
      
      return result
    } catch (error) {
      this.handleError(error, 'batchDelete')
    }
  }
  
  /**
   * Promise化COS方法
   */
  private cosPromise(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      (this.cos as any)[method](params, (err: any, data: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
  
  /**
   * Promise化COS上传方法
   */
  private cosUpload(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.cos.putObject(params, (err: any, data: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}