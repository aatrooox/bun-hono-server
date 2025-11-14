import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // 存储哈希后的密码
  name: text('name').notNull(), // 真实姓名
  nickname: text('nickname'), // 昵称
  avatar: text('avatar'), // 头像URL
  phone: text('phone').unique(), // 手机号
  gender: integer('gender'), // 性别：0-未知，1-男，2-女
  birthday: text('birthday'), // 生日
  bio: text('bio'), // 个人简介
  status: integer('status').notNull().default(1), // 状态：0-禁用，1-正常
  role: text('role').notNull().default('user'), // 角色：user-普通用户，admin-管理员
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})

// 刷新令牌表
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  deviceInfo: text('device_info'), // 设备信息
  ipAddress: text('ip_address'), // IP地址
  expiresAt: text('expires_at').notNull(),
  isRevoked: integer('is_revoked').notNull().default(0), // 是否已吃销：0-未吃销，1-已吃销
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})

// OAuth 第三方登录表
export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 登录提供方：wechat、qq、alipay、github等
  providerUserId: text('provider_user_id').notNull(), // 第三方用户ID
  providerUserId2: text('provider_user_id2'), // 第二个第三方用户ID（如微信小程序的unionid）
  providerUserInfo: text('provider_user_info'), // 第三方用户信息（JSON格式）
  accessToken: text('access_token'), // 第三方访问令牌
  refreshToken: text('refresh_token'), // 第三方刷新令牌
  expiresAt: text('expires_at'), // 第三方令牌过期时间
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
}, (table) => ({
  // 同一提供方的用户ID唯一
  providerUserUnique: unique().on(table.provider, table.providerUserId)
}))

// 用户类型（从数据库表推断）
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// 刷新令牌类型
export type RefreshToken = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert

// OAuth 账户类型
export type OAuthAccount = typeof oauthAccounts.$inferSelect
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert

// ==================== FSF 通知系统 ====================

// 场景表（数据源场景）
export const notificationScenes = sqliteTable('notification_scenes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 场景名称（语义化，如 weibo, news）
  description: text('description'), // 场景描述
  handler: text('handler').notNull(), // 处理器函数名（代码中的函数名）
  cacheTtl: integer('cache_ttl').notNull().default(300), // 缓存时长(秒)，0=不缓存
  status: integer('status').notNull().default(1), // 状态：0=禁用 1=启用
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`)
})

// 订阅表（推送规则）
export const notificationSubscriptions = sqliteTable('notification_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sceneName: text('scene_name').notNull().references(() => notificationScenes.name, { onDelete: 'cascade' }),
  name: text('name').notNull(), // 订阅名称（自定义标识）
  
  // 推送目标配置
  targetType: text('target_type').notNull(), // 类型: http | feishu | dingtalk | wechat_work
  targetUrl: text('target_url').notNull(), // 目标地址
  targetAuth: text('target_auth'), // 认证配置（JSON）
  
  // 触发配置
  triggerType: text('trigger_type').notNull(), // 触发类型: cron | manual | passive
  triggerConfig: text('trigger_config'), // 触发配置（JSON，如 cron 表达式）
  
  // 数据转换
  template: text('template'), // 数据模板（用于格式化输出）
  
  // 其他配置
  status: integer('status').notNull().default(1), // 状态：0=禁用 1=启用
  retryCount: integer('retry_count').notNull().default(3), // 失败重试次数
  timeout: integer('timeout').notNull().default(30), // 请求超时(秒)
  
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastTriggeredAt: text('last_triggered_at'), // 最后触发时间
  nextTriggerAt: text('next_trigger_at'), // 下次触发时间
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`)
})

// FSF 类型导出
export type NotificationScene = typeof notificationScenes.$inferSelect
export type NewNotificationScene = typeof notificationScenes.$inferInsert
export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect
export type NewNotificationSubscription = typeof notificationSubscriptions.$inferInsert