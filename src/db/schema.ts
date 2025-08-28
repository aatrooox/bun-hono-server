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