/**
 * 本地文件系统存储适配器
 * 将文件保存到本地文件系统，并提供静态文件访问URL
 */

import { promises as fs } from 'fs'
import { join, dirname, extname } from 'path'
import { existsSync, mkdirSync, statSync } from 'fs'
import { BaseStorageAdapter } from './base'
import { 
  FileInfo, 
  UploadResult, 
  UploadOptions, 
  FileMetadata, 
  LocalStorageConfig,
  StorageError 
} from '../../types/upload'

export class LocalStorageAdapter extends BaseStorageAdapter {
  private config: LocalStorageConfig
  
  constructor(config: LocalStorageConfig) {
    super()
    this.config = {
      createDateDir: true,
      fileMode: 0o644,
      ...config
    }
    
    // 确保上传目录存在
    this.ensureUploadDir()
    
    this.logOperation('initialized', {
      uploadDir: this.config.uploadDir,
      baseUrl: this.config.baseUrl
    })
  }
  
  /**
   * 上传文件到本地文件系统
   */
  async upload(file: FileInfo, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      // 计算文件哈希
      file.hash = this.calculateFileHash(file.buffer)
      
      // 生成文件名
      const filename = options.filename || 
        this.generateUniqueFilename(file.originalName, file.extension)
      
      // 生成存储路径
      const relativePath = this.generateStoragePath(
        filename, 
        options.path, 
        this.config.createDateDir
      )
      
      const fullPath = join(this.config.uploadDir, relativePath)
      
      // 检查是否覆盖
      if (!options.overwrite && existsSync(fullPath)) {
        return {
          success: false,
          error: '文件已存在，请启用覆盖选项或使用不同的文件名'
        }
      }
      
      // 确保目录存在
      const dir = dirname(fullPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      
      // 写入文件
      await fs.writeFile(fullPath, file.buffer, { mode: this.config.fileMode })
      
      // 生成访问URL
      const url = await this.getUrl(relativePath)
      
      this.logOperation('upload', {
        originalName: file.originalName,
        filename,
        size: file.size,
        path: relativePath,
        url
      })
      
      return {
        success: true,
        url,
        path: relativePath,
        filename,
        size: file.size,
        metadata: {
          hash: file.hash,
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
      const fullPath = join(this.config.uploadDir, path)
      
      if (!existsSync(fullPath)) {
        return false
      }
      
      await fs.unlink(fullPath)
      
      this.logOperation('delete', { path })
      
      return true
    } catch (error) {
      this.handleError(error, 'delete')
    }
  }
  
  /**
   * 获取文件访问URL
   */
  async getUrl(path: string): Promise<string> {
    // 确保path以/开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${this.config.baseUrl.replace(/\/$/, '')}${normalizedPath}`
  }
  
  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    const fullPath = join(this.config.uploadDir, path)
    return existsSync(fullPath)
  }
  
  /**
   * 获取文件信息
   */
  async getFileInfo(path: string): Promise<FileMetadata | null> {
    try {
      const fullPath = join(this.config.uploadDir, path)
      
      if (!existsSync(fullPath)) {
        return null
      }
      
      const stats = statSync(fullPath)
      const url = await this.getUrl(path)
      
      // 通过扩展名推断MIME类型
      const extension = extname(path).toLowerCase()
      const mimeType = this.getMimeTypeByExtension(extension)
      
      return {
        filename: path.split('/').pop() || '',
        size: stats.size,
        mimeType,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        path,
        url
      }
    } catch (error) {
      this.handleError(error, 'getFileInfo')
    }
  }
  
  /**
   * 确保上传目录存在
   */
  private ensureUploadDir(): void {
    if (!existsSync(this.config.uploadDir)) {
      mkdirSync(this.config.uploadDir, { recursive: true })
      this.logger.info(`创建上传目录: ${this.config.uploadDir}`)
    }
  }
  
  /**
   * 根据文件扩展名获取MIME类型
   */
  private getMimeTypeByExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    }
    
    return mimeTypes[extension] || 'application/octet-stream'
  }
  
  /**
   * 获取目录大小统计
   */
  async getStorageStats(): Promise<{
    totalFiles: number
    totalSize: number
    directories: string[]
  }> {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        directories: [] as string[]
      }
      
      const scanDirectory = async (dir: string) => {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          const fullPath = join(dir, item.name)
          
          if (item.isDirectory()) {
            stats.directories.push(fullPath.replace(this.config.uploadDir, ''))
            await scanDirectory(fullPath)
          } else if (item.isFile()) {
            const stat = await fs.stat(fullPath)
            stats.totalFiles++
            stats.totalSize += stat.size
          }
        }
      }
      
      if (existsSync(this.config.uploadDir)) {
        await scanDirectory(this.config.uploadDir)
      }
      
      return stats
    } catch (error) {
      this.handleError(error, 'getStorageStats')
    }
  }
  
  /**
   * 清理过期文件（可选功能）
   */
  async cleanupOldFiles(maxAge: number): Promise<number> {
    try {
      let deletedCount = 0
      const cutoffTime = Date.now() - maxAge
      
      const scanAndClean = async (dir: string) => {
        const items = await fs.readdir(dir, { withFileTypes: true })
        
        for (const item of items) {
          const fullPath = join(dir, item.name)
          
          if (item.isDirectory()) {
            await scanAndClean(fullPath)
            // 尝试删除空目录
            try {
              const dirItems = await fs.readdir(fullPath)
              if (dirItems.length === 0) {
                await fs.rmdir(fullPath)
              }
            } catch {
              // 忽略删除目录错误
            }
          } else if (item.isFile()) {
            const stat = await fs.stat(fullPath)
            if (stat.mtime.getTime() < cutoffTime) {
              await fs.unlink(fullPath)
              deletedCount++
            }
          }
        }
      }
      
      if (existsSync(this.config.uploadDir)) {
        await scanAndClean(this.config.uploadDir)
      }
      
      this.logOperation('cleanup', { deletedCount, maxAge })
      
      return deletedCount
    } catch (error) {
      this.handleError(error, 'cleanupOldFiles')
    }
  }
}