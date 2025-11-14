/**
 * FSF 通知服务主入口
 * 统一管理场景数据获取、订阅推送等功能
 */

import { db } from '../../db'
import { notificationScenes, notificationSubscriptions } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '../../utils/logger'
import { fetchSceneData, clearSceneCache } from './dataSources'
import { pushWithRetry } from './adapters'
import { parseJsonSafely, type PushTarget } from '../../types/notification'
import { registerJob, unregisterJob } from './scheduler'

const serviceLogger = logger.child({ module: 'fsf-service' })

/**
 * 触发订阅推送
 */
export async function triggerSubscription(subscriptionId: number): Promise<void> {
  const startTime = Date.now()
  
  try {
    // 1. 获取订阅配置
    const subscription = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.id, subscriptionId))
      .get()
    
    if (!subscription) {
      throw new Error(`订阅 ${subscriptionId} 不存在`)
    }
    
    if (subscription.status !== 1) {
      throw new Error(`订阅 ${subscriptionId} 已禁用`)
    }
    
    serviceLogger.info({
      subscriptionId,
      subscriptionName: subscription.name,
      sceneName: subscription.sceneName,
      targetType: subscription.targetType
    }, '开始触发订阅推送')
    
    // 2. 获取场景数据
    const sceneData = await fetchSceneData(subscription.sceneName)
    
    // 3. 构造推送目标
    const target: PushTarget = {
      type: subscription.targetType as any,
      url: subscription.targetUrl,
      auth: parseJsonSafely(subscription.targetAuth, undefined)
    }
    
    // 4. 执行推送（带重试）
    const result = await pushWithRetry(
      target,
      sceneData,
      subscription.template || undefined,
      subscription.timeout * 1000,
      subscription.retryCount
    )
    
    const duration = Date.now() - startTime
    
    // 5. 记录结果（只打印日志，不入库）
    if (result.ok) {
      serviceLogger.info({
        subscriptionId,
        subscriptionName: subscription.name,
        sceneName: subscription.sceneName,
        status: 'success',
        httpStatus: result.status,
        duration,
        pushDuration: result.duration
      }, '订阅推送成功')
    } else {
      serviceLogger.error({
        subscriptionId,
        subscriptionName: subscription.name,
        sceneName: subscription.sceneName,
        status: 'failed',
        httpStatus: result.status,
        error: result.body,
        duration,
        pushDuration: result.duration
      }, '订阅推送失败')
    }
    
    // 6. 更新最后触发时间
    await db
      .update(notificationSubscriptions)
      .set({
        lastTriggeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(notificationSubscriptions.id, subscriptionId))
    
  } catch (error) {
    const duration = Date.now() - startTime
    serviceLogger.error({
      subscriptionId,
      error: (error as Error).message,
      duration
    }, '触发订阅推送异常')
    throw error
  }
}

/**
 * 更新订阅后重新注册定时任务
 */
export async function updateSubscriptionSchedule(subscriptionId: number) {
  const subscription = await db
    .select()
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.id, subscriptionId))
    .get()
  
  if (!subscription) return
  
  // 先取消旧任务
  unregisterJob(subscriptionId)
  
  // 如果是 cron 且启用，重新注册
  if (subscription.status === 1 && subscription.triggerType === 'cron') {
    registerJob(subscription)
  }
}
