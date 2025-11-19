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
import { eq, desc, sql } from 'drizzle-orm'
import { logger } from '../utils/logger'
import {
  createSceneSchema,
  updateSceneSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema
} from '../types/notification'
import { 
  triggerSubscription, 
  updateSubscriptionSchedule,
  broadcastToScene
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
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const [scenes, total] = await Promise.all([
      db.select()
        .from(notificationScenes)
        .orderBy(desc(notificationScenes.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(notificationScenes)
        .then(res => res[0].count)
    ])
    
    const handlers = getRegisteredHandlers()
    
    return c.get('success')({
      list: scenes,
      total,
      page,
      limit,
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

/**
 * 广播场景消息
 * POST /api/fsf/scenes/:id/broadcast
 */
fsf.post('/scenes/:id/broadcast', authMiddleware, adminMiddleware, async (c) => {
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
    
    fsfLogger.info({
      sceneId: id,
      sceneName: scene.name,
      userId: c.get('user')?.id
    }, '手动触发场景广播')
    
    // 异步执行
    broadcastToScene(scene.name).catch(error => {
      fsfLogger.error({ 
        sceneName: scene.name, 
        error: (error as Error).message 
      }, '异步广播失败')
    })
    
    return c.get('success')(null, '广播任务已下发')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '触发广播失败')
    return c.get('error')(500, `触发失败: ${(error as Error).message}`)
  }
})

// ==================== 订阅管理 ====================

/**
 * 获取订阅列表
 * GET /api/fsf/subscriptions
 */
fsf.get('/subscriptions', authMiddleware, adminMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit
    const sceneName = c.req.query('sceneName') // 可选过滤
    
    let query = db.select().from(notificationSubscriptions)
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(notificationSubscriptions)
    
    if (sceneName) {
      query = query.where(eq(notificationSubscriptions.sceneName, sceneName)) as any
      countQuery = countQuery.where(eq(notificationSubscriptions.sceneName, sceneName)) as any
    }
    
    const [subscriptions, total] = await Promise.all([
      query.orderBy(desc(notificationSubscriptions.createdAt)).limit(limit).offset(offset),
      countQuery.then(res => res[0].count)
    ])
    
    return c.get('success')({
      list: subscriptions,
      total,
      page,
      limit
    }, '获取成功')
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
    
    try {
      // 如果是 cron 类型，注册定时任务
      if (data.triggerType === 'cron' && data.status === 1) {
        await updateSubscriptionSchedule(result[0].id)
      }
    } catch (error) {
      // 回滚：删除刚创建的订阅
      await db.delete(notificationSubscriptions).where(eq(notificationSubscriptions.id, result[0].id))
      throw error
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
    
    try {
      // 更新定时任务
      await updateSubscriptionSchedule(id)
    } catch (error) {
      // 回滚：恢复旧数据
      await db
        .update(notificationSubscriptions)
        .set(subscription) // 恢复所有字段
        .where(eq(notificationSubscriptions.id, id))
      
      // 尝试恢复旧的定时任务
      try {
        await updateSubscriptionSchedule(id)
      } catch (e) {
        fsfLogger.error({ error: (e as Error).message }, '回滚定时任务失败')
      }
      
      throw error
    }
    
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
    
    // 异步执行，不阻塞接口
    triggerSubscription(id).catch(error => {
      fsfLogger.error({ 
        subscriptionId: id, 
        error: (error as Error).message 
      }, '异步触发订阅失败')
    })
    
    return c.get('success')(null, '推送任务已下发')
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '触发订阅失败')
    return c.get('error')(500, `触发失败: ${(error as Error).message}`)
  }
})

export default fsf
