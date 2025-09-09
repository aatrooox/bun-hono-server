/**
 * AWS S3 / 兼容 S3 协议对象存储适配器
 * 仅实现当前项目所需最小功能 + 预签名 URL 支持
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { BaseStorageAdapter } from './base'
import { 
  FileInfo,
  UploadResult,
  UploadOptions,
  FileMetadata,
  StorageError
} from '../../types/upload'

interface S3AdapterConfig {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region: string
  endpoint?: string
  forcePathStyle?: boolean
  // 预签名相关
  presignDefaultExpire?: number // 秒
  presignMaxExpire?: number // 秒
}

// 允许的自定义查询参数（会参与签名）
const ALLOWED_CUSTOM_QUERY_KEYS = new Set([
  'no-wait',
  'x-bitiful-max-requests',
  'x-bitiful-limit-rate'
])

export class S3StorageAdapter extends BaseStorageAdapter {
  private client: S3Client
  private config: S3AdapterConfig

  constructor(config: S3AdapterConfig) {
    super()
    this.config = {
      presignDefaultExpire: 3600,
      presignMaxExpire: 24 * 3600,
      forcePathStyle: false,
      ...config
    }

    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    })

    // 自定义中间件：在签名前注入自定义查询参数（预签名使用）
    this.client.middlewareStack.add(
      (next, context) => async (args: any) => {
        const { request } = args
        if (HttpRequest.isInstance(request) && (args.input as any)?.__customQuery) {
          request.query = request.query || {}
            ;(args.input as any).__customQuery.forEach((v: [string, string]) => {
              request.query[v[0]] = v[1]
            })
        }
        return next(args)
      },
      { step: 'build', name: 'InjectCustomSignedQuery', tags: ['S3', 'PRESIGN'] }
    )

    this.logOperation('initialized', {
      bucket: this.config.bucket,
      region: this.config.region,
      endpoint: this.config.endpoint || 'aws'
    })
  }

  /** 上传文件 */
  async upload(file: FileInfo, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      file.hash = this.calculateFileHash(file.buffer)
      const filename = options.filename || this.generateUniqueFilename(file.originalName, file.extension)
      let key = this.generateStoragePath(filename, options.path, true)

      // 检查存在（非覆盖）
      if (!options.overwrite && await this.exists(key)) {
        return { success: false, error: '文件已存在，请启用覆盖或改名' }
      }

      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        ContentLength: file.size,
        Metadata: {
          'original-name': file.originalName,
          'file-hash': file.hash,
          'uploaded-at': new Date().toISOString(),
          ...options.metadata
        }
      }))

      const url = await this.getUrl(key)
      this.logOperation('upload', { originalName: file.originalName, key, size: file.size, url })
      return {
        success: true,
        url,
        path: key,
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

  async delete(path: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: path }))
      this.logOperation('delete', { path })
      return true
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) return false
      this.handleError(error, 'delete')
    }
  }

  async getUrl(path: string): Promise<string> {
    // 如果自定义 endpoint 且为自托管兼容服务，通常支持 virtual host；简单拼接
    if (this.config.endpoint) {
      const ep = this.config.endpoint.replace(/\/$/, '')
      if (this.config.forcePathStyle) {
        return `${ep}/${this.config.bucket}/${path}`
      }
      // virtual-host
      try {
        const host = new URL(ep)
        return `${host.protocol}//${this.config.bucket}.${host.host}/${path}`
      } catch {
        return `${ep}/${path}`
      }
    }
    // AWS 官方
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${path}`
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: path }))
      return true
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) return false
      this.handleError(error, 'exists')
    }
  }

  async getFileInfo(path: string): Promise<FileMetadata | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: path }))
      const url = await this.getUrl(path)
      return {
        filename: path.split('/').pop() || '',
        size: head.ContentLength || 0,
        mimeType: head.ContentType || 'application/octet-stream',
        createdAt: head.LastModified || new Date(),
        modifiedAt: head.LastModified || new Date(),
        path,
        url,
        metadata: head.Metadata as any
      }
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) return null
      this.handleError(error, 'getFileInfo')
    }
  }

  /** 生成预签名URL（GET & PUT） */
  async generatePresignedUrls(params: {
    key: string
    expireSeconds?: number
    contentLength?: number
    forceDownload?: boolean
    customQuery?: Record<string, string | number>
  }): Promise<{ getUrl: string; putUrl: string }> {
    try {
      const expire = Math.min(
        Math.max(1, params.expireSeconds || this.config.presignDefaultExpire!),
        this.config.presignMaxExpire!
      )

      const customEntries: [string, string][] = []
      if (params.customQuery) {
        for (const [k, v] of Object.entries(params.customQuery)) {
          if (ALLOWED_CUSTOM_QUERY_KEYS.has(k) && v !== undefined && v !== null) {
            customEntries.push([k, String(v)])
          }
        }
      }

      // GET
      const getInput: any = {
        Bucket: this.config.bucket,
        Key: params.key
      }
      if (params.forceDownload) {
        getInput.ResponseContentDisposition = 'attachment'
      }
      if (customEntries.length) {
        getInput.__customQuery = customEntries
      }

      const getUrl = await getSignedUrl(this.client, new GetObjectCommand(getInput), { expiresIn: expire })

      // PUT
      const putInput: any = {
        Bucket: this.config.bucket,
        Key: params.key
      }
      if (params.contentLength) putInput.ContentLength = params.contentLength
      const putUrl = await getSignedUrl(this.client, new PutObjectCommand(putInput), { expiresIn: expire })

      this.logOperation('presign', {
        key: params.key,
        expire,
        customQueryCount: customEntries.length
      })

      return { getUrl, putUrl }
    } catch (error) {
      this.handleError(error, 'generatePresignedUrls')
    }
  }
}
