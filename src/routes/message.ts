/**
 * FSF 被动拉取接口
 * 路径: /api/fsf/msg/:sceneName
 * 提供给第三方使用，需要 JWT 认证
 */

import { Hono } from 'hono'
import type { AppContext } from '../types'
import { authMiddleware } from '../middleware/auth'
import { fetchSceneData } from '../services/notification/dataSources'
import { logger } from '../utils/logger'

const message = new Hono<AppContext>()
const msgLogger = logger.child({ module: 'fsf-message' })

/**
 * 获取场景数据（被动拉取）
 * GET /api/fsf/msg/:sceneName
 */
message.get('/:sceneName', authMiddleware, async (c) => {
  const sceneName = c.req.param('sceneName')
  const user = c.get('user')
  
  try {
    msgLogger.info({
      userId: user?.id,
      sceneName
    }, '场景数据请求')
    
    const data = await fetchSceneData(sceneName)
    
    return c.get('success')({
      scene: sceneName,
      timestamp: Date.now(),
      content: data
    }, '获取成功')
  } catch (error) {
    msgLogger.error({
      userId: user?.id,
      sceneName,
      error: (error as Error).message
    }, '场景数据获取失败')
    
    return c.get('error')(400, (error as Error).message)
  }
})

export default message
