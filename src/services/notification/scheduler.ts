/**
 * FSF 定时任务调度器
 * 管理 cron 订阅的定时触发
 */

import cron, { type ScheduledTask } from 'node-cron'
import { db } from '../../db'
import { notificationSubscriptions } from '../../db/schema'
import { and, eq } from 'drizzle-orm'
import { logger } from '../../utils/logger'
import { parseJsonSafely, validateCronExpression, type TriggerConfig } from '../../types/notification'

const schedulerLogger = logger.child({ module: 'fsf-scheduler' })

// 存储已注册的定时任务
const scheduledJobs = new Map<number, ScheduledTask>()

/**
 * 初始化调度器（启动时调用）
 */
export async function initScheduler() {
  try {
    // 加载所有启用的 cron 订阅
    const cronSubscriptions = await db
      .select()
      .from(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.status, 1),
          eq(notificationSubscriptions.triggerType, 'cron')
        )
      )
    
    schedulerLogger.info({ count: cronSubscriptions.length }, '开始加载定时订阅')
    
    for (const subscription of cronSubscriptions) {
      try {
        registerJob(subscription)
      } catch (error) {
        schedulerLogger.error({
          subscriptionId: subscription.id,
          error: (error as Error).message
        }, '注册定时任务失败')
      }
    }
    
    schedulerLogger.info({ 
      total: cronSubscriptions.length, 
      registered: scheduledJobs.size 
    }, '定时调度器初始化完成')
  } catch (error) {
    schedulerLogger.error({ error: (error as Error).message }, '定时调度器初始化失败')
  }
}

/**
 * 注册单个定时任务
 */
export function registerJob(subscription: any) {
  const config = parseJsonSafely<TriggerConfig>(subscription.triggerConfig, {})
  
  if (!config.cron) {
    throw new Error('缺少 cron 表达式')
  }
  
  if (!validateCronExpression(config.cron)) {
    throw new Error(`无效的 cron 表达式: ${config.cron}`)
  }
  
  // 如果已存在，先停止
  unregisterJob(subscription.id)
  
  const task = cron.schedule(config.cron, async () => {
    schedulerLogger.info({
      subscriptionId: subscription.id,
      subscriptionName: subscription.name,
      sceneName: subscription.sceneName
    }, 'Cron 任务触发')
    
    try {
      // 动态导入避免循环依赖
      const { triggerSubscription } = await import('./index')
      await triggerSubscription(subscription.id)
    } catch (error) {
      schedulerLogger.error({
        subscriptionId: subscription.id,
        error: (error as Error).message
      }, 'Cron 任务执行失败')
    }
  })
  
  task.start()
  scheduledJobs.set(subscription.id, task)
  
  schedulerLogger.info({
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
    cron: config.cron
  }, '定时任务已注册')
}

/**
 * 取消注册定时任务
 */
export function unregisterJob(subscriptionId: number) {
  const task = scheduledJobs.get(subscriptionId)
  if (task) {
    task.stop()
    scheduledJobs.delete(subscriptionId)
    schedulerLogger.info({ subscriptionId }, '定时任务已停止')
  }
}

/**
 * 重新加载所有定时任务
 */
export async function reloadAllJobs() {
  // 停止所有现有任务
  for (const [id, task] of scheduledJobs.entries()) {
    task.stop()
  }
  scheduledJobs.clear()
  
  // 重新初始化
  await initScheduler()
}

/**
 * 获取当前运行的任务数量
 */
export function getActiveJobCount(): number {
  return scheduledJobs.size
}

/**
 * 获取所有任务 ID
 */
export function getActiveJobIds(): number[] {
  return Array.from(scheduledJobs.keys())
}
