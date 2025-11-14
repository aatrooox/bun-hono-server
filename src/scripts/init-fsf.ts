/**
 * FSF 系统初始化脚本
 * 创建示例场景和订阅配置
 */

import { db } from '../db'
import { notificationScenes, notificationSubscriptions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '../utils/logger'

const fsfLogger = logger.child({ module: 'fsf-init' })

async function initFsfData() {
  fsfLogger.info('🚀 开始初始化 FSF 系统数据...')
  
  try {
    // ==================== 初始化场景 ====================
    
    fsfLogger.info('📝 创建默认场景...')
    
    // 检查场景是否已存在
    const existingWeibo = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.name, 'weibo'))
      .get()
    
    if (!existingWeibo) {
      await db.insert(notificationScenes).values({
        name: 'weibo',
        description: '微博热搜榜单',
        handler: 'weibo',
        cacheTtl: 300, // 5分钟缓存
        status: 1
      })
      fsfLogger.info('✅ 场景创建成功: weibo')
    } else {
      fsfLogger.info('⏭️  场景已存在: weibo')
    }
    
    const existingNews = await db
      .select()
      .from(notificationScenes)
      .where(eq(notificationScenes.name, 'news'))
      .get()
    
    if (!existingNews) {
      await db.insert(notificationScenes).values({
        name: 'news',
        description: '新闻头条',
        handler: 'news',
        cacheTtl: 600, // 10分钟缓存
        status: 1
      })
      fsfLogger.info('✅ 场景创建成功: news')
    } else {
      fsfLogger.info('⏭️  场景已存在: news')
    }
    
    // ==================== 初始化订阅示例 ====================
    
    fsfLogger.info('📝 创建示例订阅配置...')
    
    // 获取管理员用户（用于 createdBy）
    const adminUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.role, 'admin')
    })
    
    if (!adminUser) {
      fsfLogger.warn('⚠️  未找到管理员用户，跳过订阅创建')
      return
    }
    
    // 示例1: 飞书推送微博热搜（每30分钟）
    const existingFeishuWeibo = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.name, 'feishu-weibo-cron'))
      .get()
    
    if (!existingFeishuWeibo) {
      await db.insert(notificationSubscriptions).values({
        sceneName: 'weibo',
        name: 'feishu-weibo-cron',
        targetType: 'feishu',
        targetUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_TOKEN',
        targetAuth: null,
        triggerType: 'cron',
        triggerConfig: JSON.stringify({
          cron: '*/30 * * * *', // 每30分钟
          timezone: 'Asia/Shanghai'
        }),
        template: JSON.stringify({
          title: '微博热搜 TOP 10',
          content: '{{content}}'
        }),
        status: 0, // 默认禁用，需手动配置 webhook 后启用
        retryCount: 3,
        timeout: 10000,
        createdBy: adminUser.id
      })
      fsfLogger.info('✅ 订阅创建成功: feishu-weibo-cron')
    } else {
      fsfLogger.info('⏭️  订阅已存在: feishu-weibo-cron')
    }
    
    // 示例2: 钉钉推送新闻（每小时）
    const existingDingtalkNews = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.name, 'dingtalk-news-cron'))
      .get()
    
    if (!existingDingtalkNews) {
      await db.insert(notificationSubscriptions).values({
        sceneName: 'news',
        name: 'dingtalk-news-cron',
        targetType: 'dingtalk',
        targetUrl: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_ACCESS_TOKEN',
        targetAuth: null,
        triggerType: 'cron',
        triggerConfig: JSON.stringify({
          cron: '0 * * * *', // 每小时
          timezone: 'Asia/Shanghai'
        }),
        template: JSON.stringify({
          title: '新闻头条',
          content: '{{content}}'
        }),
        status: 0, // 默认禁用
        retryCount: 3,
        timeout: 10000,
        createdBy: adminUser.id
      })
      fsfLogger.info('✅ 订阅创建成功: dingtalk-news-cron')
    } else {
      fsfLogger.info('⏭️  订阅已存在: dingtalk-news-cron')
    }
    
    // 示例3: HTTP Webhook 手动触发
    const existingHttpManual = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.name, 'http-weibo-manual'))
      .get()
    
    if (!existingHttpManual) {
      await db.insert(notificationSubscriptions).values({
        sceneName: 'weibo',
        name: 'http-weibo-manual',
        targetType: 'http',
        targetUrl: 'https://example.com/webhook',
        targetAuth: JSON.stringify({
          type: 'bearer',
          token: 'YOUR_API_TOKEN'
        }),
        triggerType: 'manual',
        triggerConfig: null,
        template: null, // HTTP 直接发送原始数据
        status: 0, // 默认禁用
        retryCount: 3,
        timeout: 15000,
        createdBy: adminUser.id
      })
      fsfLogger.info('✅ 订阅创建成功: http-weibo-manual')
    } else {
      fsfLogger.info('⏭️  订阅已存在: http-weibo-manual')
    }
    
    // 示例4: 被动拉取订阅（实际不会主动推送，仅标记场景可用）
    const existingPassive = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.name, 'passive-news-pull'))
      .get()
    
    if (!existingPassive) {
      await db.insert(notificationSubscriptions).values({
        sceneName: 'news',
        name: 'passive-news-pull',
        targetType: 'http',
        targetUrl: 'https://external-system.com/api/news',
        targetAuth: null,
        triggerType: 'passive',
        triggerConfig: null,
        template: null,
        status: 1, // 启用（允许第三方拉取）
        retryCount: 0,
        timeout: 5000,
        createdBy: adminUser.id
      })
      fsfLogger.info('✅ 订阅创建成功: passive-news-pull')
    } else {
      fsfLogger.info('⏭️  订阅已存在: passive-news-pull')
    }
    
    fsfLogger.info('✅ FSF 系统数据初始化完成！')
    fsfLogger.info('')
    fsfLogger.info('📝 使用说明:')
    fsfLogger.info('1. 示例订阅默认为禁用状态（status=0）')
    fsfLogger.info('2. 请在管理后台配置正确的 webhook URL 和认证信息')
    fsfLogger.info('3. 启用订阅前请确保目标服务可用')
    fsfLogger.info('4. 使用 GET /api/fsf/msg/:sceneName 可被动拉取数据')
    fsfLogger.info('5. 使用 POST /api/fsf/subscriptions/:id/trigger 可手动触发推送')
    fsfLogger.info('')
    
  } catch (error) {
    fsfLogger.error({ error: (error as Error).message }, '❌ FSF 初始化失败')
    throw error
  }
}

// 如果直接运行此脚本
if (import.meta.main) {
  initFsfData()
    .then(() => {
      fsfLogger.info('🎉 初始化脚本执行完成')
      process.exit(0)
    })
    .catch((error) => {
      fsfLogger.error(error, '💥 初始化脚本执行失败')
      process.exit(1)
    })
}

export { initFsfData }
