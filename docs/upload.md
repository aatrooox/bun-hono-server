# 文件上传功能 API 文档

## 概述

本系统提供了功能完整、安全可靠的文件上传服务，支持本地存储和对象存储（腾讯云COS），具有完善的安全检查、图片处理和类型验证功能。

## 特性

- 🚀 **多存储支持**: 本地存储、腾讯云COS（可扩展S3、OSS等）
- 🔒 **安全防护**: 文件类型验证、恶意文件检测、路径遍历防护
- 🖼️ **图片处理**: 自动压缩、格式转换、尺寸调整、缩略图生成
- 📊 **完善监控**: 详细日志记录、上传统计、错误追踪
- ⚡ **高性能**: 支持批量上传、流式处理、自动优化
- 🛡️ **限流保护**: 请求频率限制、文件大小限制

## 快速开始

### 环境配置

```bash
# 基础配置
UPLOAD_STORAGE_TYPE=local           # 存储类型: local, cos, s3, oss
UPLOAD_MAX_FILE_SIZE=10485760       # 最大文件大小(10MB)
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain
UPLOAD_ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt

# 安全配置
UPLOAD_ENABLE_SECURITY_SCAN=true    # 启用安全扫描
UPLOAD_BLOCK_EXECUTABLE_FILES=true  # 阻止可执行文件
UPLOAD_SCAN_FILE_CONTENT=true       # 扫描文件内容

# 本地存储配置
UPLOAD_LOCAL_DIR=./uploads
UPLOAD_LOCAL_BASE_URL=http://localhost:4778/uploads

# 腾讯云COS配置（可选）
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=your-bucket-name
COS_REGION=ap-beijing
```

### 存储类型切换

只需修改环境变量即可轻松切换存储方式：

```bash
# 切换到本地存储
UPLOAD_STORAGE_TYPE=local

# 切换到腾讯云COS
UPLOAD_STORAGE_TYPE=cos
```

## API 接口

### 1. 获取上传配置

```http
GET /api/upload/config
Authorization: Bearer <your-jwt-token>
```

**响应示例:**
```json
{
  "code": 200,
  "message": "获取上传配置成功",
  "data": {
    "types": ["image/jpeg", "image/png", "image/gif", "image/webp"],
    "extensions": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    "maxSize": "10.0 MB",
    "storageType": "local"
  },
  "timestamp": 1640995200000
}
```

### 2. 单文件上传

```http
POST /api/upload/single
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data
```

**请求参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file | File | ✅ | 要上传的文件 |
| path | string | ❌ | 自定义上传路径 |
| overwrite | boolean | ❌ | 是否覆盖已存在文件 |
| quality | number | ❌ | 图片压缩质量 (0-100) |
| format | string | ❌ | 输出格式 (jpeg/png/webp) |
| resize_width | number | ❌ | 调整宽度 |
| resize_height | number | ❌ | 调整高度 |
| keep_aspect_ratio | boolean | ❌ | 保持宽高比 |
| generate_thumbnail | boolean | ❌ | 生成缩略图 |
| thumbnail_width | number | ❌ | 缩略图宽度 |
| thumbnail_height | number | ❌ | 缩略图高度 |
| auto_optimize | boolean | ❌ | 自动优化 |
| target_size | number | ❌ | 目标文件大小(字节) |

**响应示例:**
```json
{
  "code": 200,
  "message": "文件上传成功",
  "data": {
    "url": "http://localhost:4778/static/uploads/2024/01/01/image_1640995200_abc123.jpg",
    "path": "uploads/2024/01/01/image_1640995200_abc123.jpg",
    "filename": "image_1640995200_abc123.jpg",
    "size": 856432,
    "originalName": "my-photo.jpg",
    "mimeType": "image/jpeg",
    "metadata": {
      "compressionRatio": 15.2,
      "dimensions": "800x600"
    }
  },
  "timestamp": 1640995200000
}
```

### 3. 多文件上传

```http
POST /api/upload/multiple
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data
```

**请求参数:** 与单文件上传相同，但支持多个文件

**响应示例:**
```json
{
  "code": 200,
  "message": "批量上传完成: 成功 2 个，失败 0 个",
  "data": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "results": [
      {
        "originalName": "photo1.jpg",
        "success": true,
        "url": "http://localhost:4778/static/uploads/2024/01/01/photo1_1640995200_abc123.jpg",
        "size": 756432
      },
      {
        "originalName": "photo2.png",
        "success": true,
        "url": "http://localhost:4778/static/uploads/2024/01/01/photo2_1640995201_def456.png",
        "size": 432156
      }
    ]
  },
  "timestamp": 1640995200000
}
```

### 4. 删除文件

```http
DELETE /api/upload/:path
Authorization: Bearer <your-jwt-token>
```

**示例:**
```http
DELETE /api/upload/2024/01/01/image_1640995200_abc123.jpg
```

**响应示例:**
```json
{
  "code": 200,
  "message": "文件删除成功",
  "data": null,
  "timestamp": 1640995200000
}
```

### 5. 获取文件信息

```http
GET /api/upload/info/:path
Authorization: Bearer <your-jwt-token>
```

**响应示例:**
```json
{
  "code": 200,
  "message": "获取文件信息成功",
  "data": {
    "filename": "image_1640995200_abc123.jpg",
    "size": 856432,
    "mimeType": "image/jpeg",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "modifiedAt": "2024-01-01T00:00:00.000Z",
    "path": "uploads/2024/01/01/image_1640995200_abc123.jpg",
    "url": "http://localhost:4778/static/uploads/2024/01/01/image_1640995200_abc123.jpg"
  },
  "timestamp": 1640995200000
}
```

### 6. 检查文件是否存在

```http
GET /api/upload/exists/:path
Authorization: Bearer <your-jwt-token>
```

**响应示例:**
```json
{
  "code": 200,
  "message": "文件存在",
  "data": {
    "exists": true
  },
  "timestamp": 1640995200000
}
```

## 图片处理功能

### 基础压缩

```bash
curl -X POST http://localhost:4778/api/upload/single \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@photo.jpg" \\
  -F "quality=80" \\
  -F "format=webp"
```

### 尺寸调整

```bash
curl -X POST http://localhost:4778/api/upload/single \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@photo.jpg" \\
  -F "resize_width=800" \\
  -F "resize_height=600" \\
  -F "keep_aspect_ratio=true"
```

### 生成缩略图

```bash
curl -X POST http://localhost:4778/api/upload/single \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@photo.jpg" \\
  -F "generate_thumbnail=true" \\
  -F "thumbnail_width=200" \\
  -F "thumbnail_height=200"
```

### 自动优化

```bash
curl -X POST http://localhost:4778/api/upload/single \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@large-photo.jpg" \\
  -F "auto_optimize=true" \\
  -F "target_size=500000"  # 目标500KB
```

## 安全特性

### 文件类型检查

- MIME类型验证
- 文件扩展名检查
- 文件头魔数验证
- 防止文件伪造攻击

### 恶意文件检测

- 可执行文件拦截
- 脚本文件检测
- 双重扩展名检查
- 恶意代码扫描

### 路径安全

- 路径遍历防护
- 文件名清理
- 危险字符过滤
- 绝对路径拦截

### 请求保护

- 文件大小限制
- 请求频率限制
- 内容类型验证
- IP白名单支持

## 错误码说明

| 错误码 | 说明 | 解决方案 |
|-------|------|----------|
| 400 | 请求参数错误 | 检查请求格式和参数 |
| 401 | 未授权访问 | 提供有效的JWT token |
| 413 | 文件过大 | 减小文件大小或调整限制 |
| 415 | 不支持的文件类型 | 使用支持的文件格式 |
| 422 | 文件验证失败 | 检查文件内容和格式 |
| 429 | 请求过于频繁 | 降低请求频率 |
| 500 | 服务器内部错误 | 联系技术支持 |

## 客户端示例

### JavaScript (Browser)

```javascript
// 单文件上传
async function uploadFile(file, options = {}) {
  const formData = new FormData()
  formData.append('file', file)
  
  // 添加图片处理选项
  if (options.quality) formData.append('quality', options.quality)
  if (options.format) formData.append('format', options.format)
  if (options.resize_width) formData.append('resize_width', options.resize_width)
  if (options.resize_height) formData.append('resize_height', options.resize_height)
  
  try {
    const response = await fetch('/api/upload/single', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    })
    
    const result = await response.json()
    
    if (result.code === 200) {
      console.log('上传成功:', result.data.url)
      return result.data
    } else {
      throw new Error(result.message)
    }
  } catch (error) {
    console.error('上传失败:', error)
    throw error
  }
}

// 使用示例
const fileInput = document.getElementById('file-input')
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (file) {
    try {
      const result = await uploadFile(file, {
        quality: 80,
        format: 'webp',
        resize_width: 800
      })
      
      console.log('文件上传成功:', result.url)
    } catch (error) {
      console.error('上传失败:', error.message)
    }
  }
})

// 多文件上传
async function uploadMultipleFiles(files, options = {}) {
  const formData = new FormData()
  
  Array.from(files).forEach(file => {
    formData.append('file', file)
  })
  
  // 添加选项
  Object.keys(options).forEach(key => {
    formData.append(key, options[key])
  })
  
  const response = await fetch('/api/upload/multiple', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData
  })
  
  return response.json()
}
```

### React Hook 示例

```javascript
import { useState, useCallback } from 'react'

export function useFileUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  
  const uploadFile = useCallback(async (file, options = {}) => {
    setUploading(true)
    setProgress(0)
    
    const formData = new FormData()
    formData.append('file', file)
    
    Object.keys(options).forEach(key => {
      formData.append(key, options[key])
    })
    
    try {
      const xhr = new XMLHttpRequest()
      
      // 上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress((e.loaded / e.total) * 100)
        }
      })
      
      const response = await new Promise((resolve, reject) => {
        xhr.open('POST', '/api/upload/single')
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`)
        
        xhr.onload = () => resolve(JSON.parse(xhr.responseText))
        xhr.onerror = () => reject(new Error('Network error'))
        
        xhr.send(formData)
      })
      
      if (response.code === 200) {
        return response.data
      } else {
        throw new Error(response.message)
      }
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [])
  
  return { uploadFile, uploading, progress }
}

// 使用示例
function FileUploader() {
  const { uploadFile, uploading, progress } = useFileUpload()
  
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (file) {
      try {
        const result = await uploadFile(file, {
          quality: 80,
          auto_optimize: true
        })
        
        console.log('上传成功:', result.url)
      } catch (error) {
        console.error('上传失败:', error.message)
      }
    }
  }
  
  return (
    <div>
      <input type="file" onChange={handleFileSelect} disabled={uploading} />
      {uploading && (
        <div>
          <div>上传中... {progress.toFixed(1)}%</div>
          <progress value={progress} max="100" />
        </div>
      )}
    </div>
  )
}
```

### Node.js 示例

```javascript
const FormData = require('form-data')
const fs = require('fs')

async function uploadFile(filePath, options = {}) {
  const form = new FormData()
  form.append('file', fs.createReadStream(filePath))
  
  Object.keys(options).forEach(key => {
    form.append(key, options[key])
  })
  
  const response = await fetch('http://localhost:4778/api/upload/single', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-jwt-token',
      ...form.getHeaders()
    },
    body: form
  })
  
  return response.json()
}

// 使用示例
uploadFile('./photo.jpg', {
  quality: 85,
  format: 'webp',
  resize_width: 1200
}).then(result => {
  console.log('上传成功:', result.data.url)
}).catch(error => {
  console.error('上传失败:', error)
})
```

### cURL 示例

```bash
# 基础上传
curl -X POST http://localhost:4778/api/upload/single \\
  -H "Authorization: Bearer your-jwt-token" \\
  -F "file=@./photo.jpg"

# 带图片处理的上传
curl -X POST http://localhost:4778/api/upload/single \\
  -H "Authorization: Bearer your-jwt-token" \\
  -F "file=@./photo.jpg" \\
  -F "quality=80" \\
  -F "format=webp" \\
  -F "resize_width=800" \\
  -F "resize_height=600" \\
  -F "generate_thumbnail=true"

# 多文件上传
curl -X POST http://localhost:4778/api/upload/multiple \\
  -H "Authorization: Bearer your-jwt-token" \\
  -F "file=@./photo1.jpg" \\
  -F "file=@./photo2.png" \\
  -F "quality=75"

# 删除文件
curl -X DELETE http://localhost:4778/api/upload/2024/01/01/photo_123456_abc.jpg \\
  -H "Authorization: Bearer your-jwt-token"

# 获取文件信息
curl -X GET http://localhost:4778/api/upload/info/2024/01/01/photo_123456_abc.jpg \\
  -H "Authorization: Bearer your-jwt-token"
```

## 扩展新的存储适配器

如果需要接入其他对象存储服务，只需要实现存储适配器接口：

```typescript
// 1. 创建新的适配器类
export class S3StorageAdapter extends BaseStorageAdapter {
  constructor(private config: S3StorageConfig) {
    super()
    // 初始化S3客户端
  }
  
  async upload(file: FileInfo, options?: UploadOptions): Promise<UploadResult> {
    // 实现S3上传逻辑
  }
  
  async delete(path: string): Promise<boolean> {
    // 实现S3删除逻辑
  }
  
  async getUrl(path: string): Promise<string> {
    // 实现S3 URL获取逻辑
  }
  
  async exists(path: string): Promise<boolean> {
    // 实现S3文件存在检查逻辑
  }
  
  async getFileInfo(path: string): Promise<FileMetadata | null> {
    // 实现S3文件信息获取逻辑
  }
}

// 2. 注册新的适配器
StorageAdapterFactory.register('s3', S3StorageAdapter)

// 3. 设置环境变量
UPLOAD_STORAGE_TYPE=s3
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

## 监控和日志

系统提供详细的监控和日志功能：

```bash
# 查看上传日志
tail -f logs/app.log | grep upload

# 查看错误日志
tail -f logs/error.log | grep upload

# 查看特定用户的上传活动
grep "userId.*123" logs/app.log | grep upload
```

## 性能优化建议

1. **启用CDN**: 为静态文件配置CDN加速
2. **图片优化**: 使用WebP格式和适当的压缩质量
3. **缓存策略**: 设置合理的缓存头
4. **批量处理**: 对于大量小文件，使用批量上传
5. **异步处理**: 对于大文件，考虑使用后台队列处理

## 安全最佳实践

1. **定期更新**: 保持依赖库和系统的最新版本
2. **访问控制**: 严格控制上传权限和文件访问权限
3. **监控告警**: 设置异常上传行为的监控告警
4. **备份策略**: 定期备份重要文件和配置
5. **审计日志**: 记录所有文件操作的审计日志

## 故障排除

### 常见问题

**Q: 文件上传后无法访问？**
A: 检查静态文件服务配置和文件权限设置

**Q: 图片处理失败？**
A: 确认已安装sharp库，检查图片格式是否支持

**Q: 上传到COS失败？**
A: 验证COS配置信息，检查网络连接和权限设置

**Q: 文件被误杀？**
A: 检查安全扫描配置，调整文件类型白名单

### 调试模式

```bash
# 启用调试日志
LOG_LEVEL=debug

# 禁用安全扫描（仅用于调试）
UPLOAD_ENABLE_SECURITY_SCAN=false
```

## 更新日志

### v1.0.0
- ✅ 基础文件上传功能
- ✅ 本地存储支持
- ✅ 腾讯云COS支持
- ✅ 图片处理功能
- ✅ 安全检查机制
- ✅ 完整的API接口
- ✅ 单元测试覆盖

## 联系支持

如有问题，请通过以下方式联系：

- 📧 邮箱: support@example.com
- 💬 Issues: GitHub Issues
- 📚 文档: 在线文档地址