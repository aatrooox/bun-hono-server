/**
 * FSF 数据源注册与管理
 * 每个场景对应一个数据源处理函数
 */

import { logger } from '../../utils/logger'
import { RedisUtils } from '../../cache/redis'
import { db } from '../../db'
import { notificationScenes } from '../../db/schema'
import { eq } from 'drizzle-orm'

const sourceLogger = logger.child({ module: 'fsf-datasource' })

// 数据源处理函数类型
export type DataSourceHandler = () => Promise<any>

// 数据源处理器注册表
const dataSourceHandlers = new Map<string, DataSourceHandler>()

/**
 * 注册数据源处理器
 */
export function registerDataSource(handlerName: string, handler: DataSourceHandler) {
  dataSourceHandlers.set(handlerName, handler)
  sourceLogger.info({ handlerName }, '数据源处理器已注册')
}

/**
 * 获取场景数据（带缓存）
 */
export async function fetchSceneData(sceneName: string): Promise<any> {
  // 1. 查询场景配置
  const scene = await db
    .select()
    .from(notificationScenes)
    .where(eq(notificationScenes.name, sceneName))
    .get()
  
  if (!scene) {
    throw new Error(`场景 "${sceneName}" 不存在`)
  }
  
  if (scene.status !== 1) {
    throw new Error(`场景 "${sceneName}" 已禁用`)
  }
  
  // 2. 检查缓存
  if (scene.cacheTtl > 0) {
    const cacheKey = `fsf:scene:${sceneName}`
    const cached = await RedisUtils.get(cacheKey)
    if (cached) {
      sourceLogger.debug({ sceneName }, '使用缓存数据')
      return JSON.parse(cached)
    }
  }
  
  // 3. 获取处理器
  const handler = dataSourceHandlers.get(scene.handler)
  if (!handler) {
    throw new Error(`场景 "${sceneName}" 的处理器 "${scene.handler}" 未注册`)
  }
  
  // 4. 执行处理器获取数据
  sourceLogger.info({ sceneName, handler: scene.handler }, '开始获取场景数据')
  const startTime = Date.now()
  
  const data = await handler()
  
  const duration = Date.now() - startTime
  sourceLogger.info({ sceneName, duration }, '场景数据获取成功')
  
  // 5. 写入缓存
  if (scene.cacheTtl > 0) {
    const cacheKey = `fsf:scene:${sceneName}`
    await RedisUtils.set(cacheKey, JSON.stringify(data), scene.cacheTtl)
  }
  
  return data
}

/**
 * 清除场景缓存
 */
export async function clearSceneCache(sceneName: string): Promise<void> {
  const cacheKey = `fsf:scene:${sceneName}`
  await RedisUtils.del(cacheKey)
  sourceLogger.info({ sceneName }, '场景缓存已清除')
}

/**
 * 获取已注册的处理器列表
 */
export function getRegisteredHandlers(): string[] {
  return Array.from(dataSourceHandlers.keys())
}

/**
 * 初始化数据源（导入所有数据源处理器）
 */
export async function initDataSources() {
  sourceLogger.info('正在初始化 FSF 数据源...')
  
  // 动态导入所有数据源
  try {
    const { fetchWeiboHotSearch } = await import('./sources/weibo')
    const { fetchNewsHeadlines } = await import('./sources/news')
    
    // 注册数据源
    registerDataSource('weibo', fetchWeiboHotSearch)
    registerDataSource('news', fetchNewsHeadlines)
    
    sourceLogger.info({ count: getRegisteredHandlers().length }, 'FSF 数据源初始化完成')
  } catch (error) {
    sourceLogger.error({ error: (error as Error).message }, 'FSF 数据源初始化失败')
    throw error
  }
}
