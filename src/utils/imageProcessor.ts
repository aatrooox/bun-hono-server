/**
 * 图片处理工具类
 * 使用 Sharp 库进行图片压缩、格式转换、尺寸调整等操作
 */

import sharp from 'sharp'
import { ImageProcessOptions } from '../types/upload'
import { logger } from './logger'

const imageLogger = logger.child({ module: 'image-processor' })

export class ImageProcessor {
  /**
   * 处理图片
   * @param buffer 原始图片数据
   * @param options 处理选项
   * @returns 处理后的图片数据和信息
   */
  static async processImage(
    buffer: Buffer, 
    options: ImageProcessOptions
  ): Promise<{
    buffer: Buffer
    info: {
      format: string
      width: number
      height: number
      size: number
      originalSize: number
      compressionRatio: number
    }
  }> {
    try {
      const originalSize = buffer.length
      
      // 创建 Sharp 实例
      let processor = sharp(buffer)
      
      // 获取原始图片信息
      const metadata = await processor.metadata()
      
      imageLogger.debug({
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        originalFormat: metadata.format,
        originalSize
      }, '开始处理图片')
      
      // 调整尺寸
      if (options.resize) {
        const { width, height, keepAspectRatio = true } = options.resize
        
        if (keepAspectRatio) {
          // 保持宽高比
          processor = processor.resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
          })
        } else {
          // 强制调整到指定尺寸
          processor = processor.resize(width, height, {
            fit: 'fill'
          })
        }
        
        imageLogger.debug({
          targetWidth: width,
          targetHeight: height,
          keepAspectRatio
        }, '调整图片尺寸')
      }
      
      // 设置输出格式和质量
      const outputFormat = options.format || 'jpeg'
      const quality = options.quality || 80
      
      switch (outputFormat) {
        case 'jpeg':
          processor = processor.jpeg({
            quality,
            progressive: true,
            mozjpeg: true // 使用 mozjpeg 引擎获得更好的压缩效果
          })
          break
          
        case 'png':
          processor = processor.png({
            quality,
            compressionLevel: 9,
            progressive: true
          })
          break
          
        case 'webp':
          processor = processor.webp({
            quality,
            effort: 6 // 压缩努力程度 (0-6, 6最高)
          })
          break
          
        default:
          throw new Error(`不支持的输出格式: ${outputFormat}`)
      }
      
      // 应用优化设置
      processor = processor
        .withMetadata() // 保留必要的元数据
        .sharpen() // 轻微锐化
      
      // 处理图片
      const { data: processedBuffer, info } = await processor.toBuffer({ resolveWithObject: true })
      
      const compressionRatio = ((originalSize - processedBuffer.length) / originalSize * 100)
      
      imageLogger.info({
        originalSize,
        processedSize: processedBuffer.length,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        outputFormat,
        quality,
        width: info.width,
        height: info.height
      }, '图片处理完成')
      
      return {
        buffer: processedBuffer,
        info: {
          format: info.format!,
          width: info.width!,
          height: info.height!,
          size: processedBuffer.length,
          originalSize,
          compressionRatio
        }
      }
    } catch (error: any) {
      imageLogger.error({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        bufferSize: buffer.length,
        options
      }, '图片处理失败')
      
      throw new Error(`图片处理失败: ${error.message}`)
    }
  }
  
  /**
   * 生成缩略图
   * @param buffer 原始图片数据
   * @param options 缩略图选项
   * @returns 缩略图数据
   */
  static async generateThumbnail(
    buffer: Buffer,
    options: {
      width: number
      height: number
      quality?: number
      format?: 'jpeg' | 'png' | 'webp'
    }
  ): Promise<Buffer> {
    try {
      const { width, height, quality = 75, format = 'jpeg' } = options
      
      let processor = sharp(buffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
      
      // 设置输出格式
      switch (format) {
        case 'jpeg':
          processor = processor.jpeg({ quality })
          break
        case 'png':
          processor = processor.png({ quality })
          break
        case 'webp':
          processor = processor.webp({ quality })
          break
      }
      
      const thumbnailBuffer = await processor.toBuffer()
      
      imageLogger.debug({
        originalSize: buffer.length,
        thumbnailSize: thumbnailBuffer.length,
        width,
        height,
        format
      }, '缩略图生成完成')
      
      return thumbnailBuffer
    } catch (error: any) {
      imageLogger.error({
        error: (error as any).message,
        options
      }, '缩略图生成失败')
      
      throw new Error(`缩略图生成失败: ${error.message}`)
    }
  }
  
  /**
   * 批量处理图片
   * @param buffers 图片数据数组
   * @param options 处理选项
   * @returns 处理结果数组
   */
  static async batchProcessImages(
    buffers: Buffer[],
    options: ImageProcessOptions
  ): Promise<Array<{
    buffer: Buffer
    info: any
    success: boolean
    error?: string
  }>> {
    const results = []
    
    for (let i = 0; i < buffers.length; i++) {
      try {
        const result = await this.processImage(buffers[i], options)
        results.push({
          ...result,
          success: true
        })
      } catch (error: any) {
        results.push({
          buffer: buffers[i],
          info: null,
          success: false,
          error: error.message
        })
      }
    }
    
    return results
  }
  
  /**
   * 验证图片格式
   * @param buffer 图片数据
   * @returns 图片元数据或null
   */
  static async validateImageFormat(buffer: Buffer): Promise<sharp.Metadata | null> {
    try {
      const metadata = await sharp(buffer).metadata()
      
      // 检查是否为支持的图片格式
      const supportedFormats = ['jpeg', 'png', 'gif', 'webp', 'tiff', 'svg']
      if (!metadata.format || !supportedFormats.includes(metadata.format)) {
        return null
      }
      
      return metadata
    } catch (error: any) {
      imageLogger.warn({
        error: error.message,
        bufferSize: buffer.length
      }, '图片格式验证失败')
      
      return null
    }
  }
  
  /**
   * 获取图片信息
   * @param buffer 图片数据
   * @returns 图片详细信息
   */
  static async getImageInfo(buffer: Buffer): Promise<{
    width: number
    height: number
    format: string
    size: number
    channels: number
    hasAlpha: boolean
    orientation?: number
  }> {
    try {
      const metadata = await sharp(buffer).metadata()
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: buffer.length,
        channels: metadata.channels || 0,
        hasAlpha: metadata.hasAlpha || false,
        orientation: metadata.orientation
      }
    } catch (error: any) {
      throw new Error(`获取图片信息失败: ${error.message}`)
    }
  }
  
  /**
   * 自动优化图片
   * 根据图片大小和格式自动选择最佳的压缩参数
   * @param buffer 图片数据
   * @param targetSize 目标文件大小（字节），可选
   * @returns 优化后的图片数据
   */
  static async autoOptimize(buffer: Buffer, targetSize?: number): Promise<Buffer> {
    try {
      const metadata = await sharp(buffer).metadata()
      const originalSize = buffer.length
      
      // 如果图片已经很小，直接返回
      if (originalSize < 100 * 1024) { // 小于100KB
        return buffer
      }
      
      let quality = 85
      let format: 'jpeg' | 'png' | 'webp' = 'jpeg'
      
      // 根据原始格式选择输出格式
      if (metadata.format === 'png' && metadata.hasAlpha) {
        format = 'png'
        quality = 90
      } else if (metadata.format === 'gif') {
        format = 'png'
        quality = 90
      } else {
        format = 'jpeg'
      }
      
      // 根据文件大小调整质量
      if (originalSize > 5 * 1024 * 1024) { // 大于5MB
        quality = 70
      } else if (originalSize > 2 * 1024 * 1024) { // 大于2MB
        quality = 75
      } else if (originalSize > 1 * 1024 * 1024) { // 大于1MB
        quality = 80
      }
      
      // 处理图片
      const result = await this.processImage(buffer, {
        format,
        quality
      })
      
      // 如果指定了目标大小，尝试调整质量到目标大小
      if (targetSize && result.buffer.length > targetSize) {
        const ratio = targetSize / result.buffer.length
        const adjustedQuality = Math.max(30, Math.floor(quality * ratio))
        
        const reprocessed = await this.processImage(buffer, {
          format,
          quality: adjustedQuality
        })
        
        return reprocessed.buffer
      }
      
      return result.buffer
    } catch (error: any) {
      imageLogger.error({
        error: error.message
      }, '自动优化失败，返回原图')
      
      return buffer
    }
  }
  
  /**
   * 图片水印
   * @param buffer 原始图片
   * @param watermarkBuffer 水印图片
   * @param options 水印选项
   */
  static async addWatermark(
    buffer: Buffer,
    watermarkBuffer: Buffer,
    options: {
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
      opacity?: number
      scale?: number
    } = {}
  ): Promise<Buffer> {
    try {
      const { position = 'bottom-right', opacity = 0.5, scale = 0.1 } = options
      
      // 获取原图尺寸
      const mainImage = sharp(buffer)
      const metadata = await mainImage.metadata()
      
      // 处理水印
      const watermarkSize = Math.floor(Math.min(metadata.width!, metadata.height!) * scale)
      const watermark = await sharp(watermarkBuffer)
        .resize(watermarkSize, watermarkSize, { fit: 'inside' })
        .composite([{
          input: Buffer.from([255, 255, 255, Math.floor(255 * opacity)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }])
        .toBuffer()
      
      // 计算水印位置
      let left = 0, top = 0
      const margin = 20
      
      switch (position) {
        case 'top-left':
          left = margin
          top = margin
          break
        case 'top-right':
          left = metadata.width! - watermarkSize - margin
          top = margin
          break
        case 'bottom-left':
          left = margin
          top = metadata.height! - watermarkSize - margin
          break
        case 'bottom-right':
          left = metadata.width! - watermarkSize - margin
          top = metadata.height! - watermarkSize - margin
          break
        case 'center':
          left = Math.floor((metadata.width! - watermarkSize) / 2)
          top = Math.floor((metadata.height! - watermarkSize) / 2)
          break
      }
      
      // 合成图片
      const result = await mainImage
        .composite([{
          input: watermark,
          left,
          top
        }])
        .toBuffer()
      
      return result
    } catch (error: any) {
      imageLogger.error({
        error: error.message
      }, '水印添加失败')
      
      throw new Error(`水印添加失败: ${error.message}`)
    }
  }
}