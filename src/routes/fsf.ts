/**
 * FSF 管理接口
 * 路径: /api/fsf/*
 * 场景管理、订阅管理（需管理员权限）
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppContext } from '../types'
import { authMiddleware } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'
import { db } from '../db'
import { notificationScenes, notificationSubscriptions } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { logger } from '../utils/logger'
import {
  createSceneSchema,
  updateSceneSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema
} from '../types/notification'
import { 
  triggerSubscription, 
  updateSubscriptionSchedule
} from '../services/notification'
import { clearSceneCache, getRegisteredHandlers } from '../services/notification/dataSources'

const fsf = new Hono<AppContext>()
const fsfLogger = logger.child({ module: 'fsf-api' })

// ==================== 场景管理 ====================

/**
 * 获取场景列表
 * GET /api/fsf/scenes
 */
fsf.get('/scenes', authMiddleware, adminMiddleware, async (c) => {
  try {
    const scenes = await db
      .select()
      .from(notificationScenes)
      .orderBy(desc(notificationScenes.createdAt))
    
    const handlers = getRegisteredHandlers()
    
    return c.get('success')({
      scenes,
      registeredHandlers: handlers
    }, '获取成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '获取场景列表失败')
    return c.get('error')(500, '获取场景列表失败')
  }
})

/**
 * 获取场景详情
 * GET /api/fsf/scenes/:id
 */
fsf.get('/scenes/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const scene = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.id, id))
      .get()
    
    if (!scene) {
      return c.get('error')(404, '场景不存在')
    }
    
    return c.get('success')(scene, '获取成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '获取场景详情失败')
    return c.get('error')(500, '获取场景详情失败')
  }
})

/**
 * 创建场景
 * POST /api/fsf/scenes
 */
fsf.post('/scenes', authMiddleware, adminMiddleware, zValidator('json', createSceneSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    
    // 检查场景名是否已存在
    const existing = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.name, data.name))
      .get()
    
    if (existing) {
      return c.get('error')(400, `场景名称 "${data.name}" 已存在`)
    }
    
    const result = await db
      .insert(notificationScenes)
      .values(data)
      .returning()
    
    fsfLogger.info({ sceneId: result[0].id, sceneName: data.name }, '场景创建成功')
    
    return c.get('success')(result[0], '场景创建成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '创建场景失败')
    return c.get('error')(500, '创建场景失败')
  }
})

/**
 * 更新场景
 * PUT /api/fsf/scenes/:id
 */
fsf.put('/scenes/:id', authMiddleware, adminMiddleware, zValidator('json', updateSceneSchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const data = c.req.valid('json')
    
    const scene = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.id, id))
      .get()
    
    if (!scene) {
      return c.get('error')(404, '场景不存在')
    }
    
    const result = await db
      .update(notificationScenes)
      .set({
        ...data,
        updatedAt: new Date().toISOString()
      })
      .where(eq(notificationScenes.id, id))
      .returning()
    
    // 清除缓存
    await clearSceneCache(scene.name)
    
    fsfLogger.info({ sceneId: id, sceneName: scene.name }, '场景更新成功')
    
    return c.get('success')(result[0], '场景更新成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '更新场景失败')
    return c.get('error')(500, '更新场景失败')
  }
})

/**
 * 删除场景
 * DELETE /api/fsf/scenes/:id
 */
fsf.delete('/scenes/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const scene = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.id, id))
      .get()
    
    if (!scene) {
      return c.get('error')(404, '场景不存在')
    }
    
    await db
      .delete(notificationScenes)
      .where(eq(notificationScenes.id, id))
    
    // 清除缓存
    await clearSceneCache(scene.name)
    
    fsfLogger.info({ sceneId: id, sceneName: scene.name }, '场景删除成功')
    
    return c.get('success')(null, '场景删除成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '删除场景失败')
    return c.get('error')(500, '删除场景失败')
  }
})

// ==================== 订阅管理 ====================

/**
 * 获取订阅列表
 * GET /api/fsf/subscriptions
 */
fsf.get('/subscriptions', authMiddleware, adminMiddleware, async (c) => {
  try {
    const sceneName = c.req.query('sceneName') // 可选过滤
    
    let query = db.select().from(notificationSubscriptions)
    
    if (sceneName) {
      query = query.where(eq(notificationSubscriptions.sceneName, sceneName)) as any
    }
    
    const subscriptions = await query.orderBy(desc(notificationSubscriptions.createdAt))
    
    return c.get('success')(subscriptions, '获取成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '获取订阅列表失败')
    return c.get('error')(500, '获取订阅列表失败')
  }
})

/**
 * 获取订阅详情
 * GET /api/fsf/subscriptions/:id
 */
fsf.get('/subscriptions/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const subscription = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.id, id))
      .get()
    
    if (!subscription) {
      return c.get('error')(404, '订阅不存在')
    }
    
    return c.get('success')(subscription, '获取成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '获取订阅详情失败')
    return c.get('error')(500, '获取订阅详情失败')
  }
})

/**
 * 创建订阅
 * POST /api/fsf/subscriptions
 */
fsf.post('/subscriptions', authMiddleware, adminMiddleware, zValidator('json', createSubscriptionSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const user = c.get('user')
    
    // 检查场景是否存在
    const scene = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.name, data.sceneName))
      .get()
    
    if (!scene) {
      return c.get('error')(400, `场景 "${data.sceneName}" 不存在`)
    }
    
    const result = await db
      .insert(notificationSubscriptions)
      .values({
        ...data,
        createdBy: user?.id
      })
      .returning()
    
    // 如果是 cron 类型，注册定时任务
    if (data.triggerType === 'cron' && data.status === 1) {
      await updateSubscriptionSchedule(result[0].id)
    }
    
    fsfLogger.info({
      subscriptionId: result[0].id,
      subscriptionName: data.name,
      sceneName: data.sceneName
    }, '订阅创建成功')
    
    return c.get('success')(result[0], '订阅创建成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '创建订阅失败')
    return c.get('error')(500, '创建订阅失败')
  }
})

/**
 * 更新订阅
 * PUT /api/fsf/subscriptions/:id
 */
fsf.put('/subscriptions/:id', authMiddleware, adminMiddleware, zValidator('json', updateSubscriptionSchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const data = c.req.valid('json')
    
    const subscription = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.id, id))
      .get()
    
    if (!subscription) {
      return c.get('error')(404, '订阅不存在')
    }
    
    const result = await db
      .update(notificationSubscriptions)
      .set({
        ...data,
        updatedAt: new Date().toISOString()
      })
      .where(eq(notificationSubscriptions.id, id))
      .returning()
    
    // 更新定时任务
    await updateSubscriptionSchedule(id)
    
    fsfLogger.info({ subscriptionId: id, subscriptionName: subscription.name }, '订阅更新成功')
    
    return c.get('success')(result[0], '订阅更新成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '更新订阅失败')
    return c.get('error')(500, '更新订阅失败')
  }
})

/**
 * 删除订阅
 * DELETE /api/fsf/subscriptions/:id
 */
fsf.delete('/subscriptions/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const subscription = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.id, id))
      .get()
    
    if (!subscription) {
      return c.get('error')(404, '订阅不存在')
    }
    
    await db
      .delete(notificationSubscriptions)
      .where(eq(notificationSubscriptions.id, id))
    
    // 取消定时任务
    await updateSubscriptionSchedule(id)
    
    fsfLogger.info({ subscriptionId: id, subscriptionName: subscription.name }, '订阅删除成功')
    
    return c.get('success')(null, '订阅删除成功')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '删除订阅失败')
    return c.get('error')(500, '删除订阅失败')
  }
})

/**
 * 手动触发订阅
 * POST /api/fsf/subscriptions/:id/trigger
 */
fsf.post('/subscriptions/:id/trigger', authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const subscription = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.id, id))
      .get()
    
    if (!subscription) {
      return c.get('error')(404, '订阅不存在')
    }
    
    fsfLogger.info({
      subscriptionId: id,
      subscriptionName: subscription.name,
      userId: c.get('user')?.id
    }, '手动触发订阅')
    
    await triggerSubscription(id)
    
    return c.get('success')(null, '推送已触发')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '触发订阅失败')
    return c.get('error')(500, `触发失败: ${(error as Error).message}`)
  }
})

export default fsf
