/**
 * FSF 通知服务主入口
 * 统一管理场景数据获取、订阅推送等功能
 */

import { db } from '../../db'
import { notificationScenes, notificationSubscriptions } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '../../utils/logger'
import { fetchSceneData, clearSceneCache } from './dataSources'
import { pushWithRetry } from './adapters'
import { parseJsonSafely, type PushTarget } from '../../types/notification'
import { registerJob, unregisterJob } from './scheduler'

const serviceLogger = logger.child({ module: 'fsf-service' })

/**
 * 广播消息给场景的所有订阅者
 */
export async function broadcastToScene(sceneName: string): Promise<{ total: number; success: number; failed: number }> {
  const startTime = Date.now()
  
  try {
    // 1. 获取场景信息（验证场景是否存在）
    const scene = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.name, sceneName))
      .get()
      
    if (!scene) {
      throw new Error(`场景 ${sceneName} 不存在`)
    }

    // 2. 获取该场景下所有启用的订阅
    const subscriptions = await db
      .select()
      .from(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.sceneName, sceneName),
          eq(notificationSubscriptions.status, 1)
        )
      )
      .all()
      
    if (subscriptions.length === 0) {
      serviceLogger.info({ sceneName }, '该场景没有启用的订阅，跳过广播')
      return { total: 0, success: 0, failed: 0 }
    }

    serviceLogger.info({ 
      sceneName, 
      count: subscriptions.length 
    }, '开始广播场景消息')

    // 3. 获取场景数据 (只获取一次，复用)
    const sceneData = await fetchSceneData(sceneName)

    // 4. 并发推送
    let successCount = 0
    let failedCount = 0

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        const target: PushTarget = {
          type: sub.targetType as any,
          url: sub.targetUrl,
          auth: parseJsonSafely(sub.targetAuth, undefined)
        }

        const result = await pushWithRetry(
          target,
          sceneData,
          sub.template || undefined,
          sub.timeout * 1000,
          sub.retryCount
        )

        if (result.ok) {
          successCount++
          // 更新最后触发时间
          await db
            .update(notificationSubscriptions)
            .set({
              lastTriggeredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
            .where(eq(notificationSubscriptions.id, sub.id))
        } else {
          failedCount++
          serviceLogger.error({
            subscriptionId: sub.id,
            error: result.body
          }, '广播推送失败')
        }
      } catch (err) {
        failedCount++
        serviceLogger.error({
          subscriptionId: sub.id,
          error: (err as Error).message
        }, '广播推送异常')
      }
    })

    await Promise.all(pushPromises)

    const duration = Date.now() - startTime
    serviceLogger.info({
      sceneName,
      total: subscriptions.length,
      success: successCount,
      failed: failedCount,
      duration
    }, '广播完成')

    return {
      total: subscriptions.length,
      success: successCount,
      failed: failedCount
    }

  } catch (error) {
    const duration = Date.now() - startTime
    serviceLogger.error({
      sceneName,
      error: (error as Error).message,
      duration
    }, '广播异常')
    throw error
  }
}

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
