import { RedisUtils } from './redis'
import { logger } from '../utils/logger'

// 会话数据接口
export interface SessionData {
  userId: string
  email: string
  loginTime: string
  lastActivity: string
  userAgent?: string
  ipAddress?: string
  [key: string]: any
}

// JWT 黑名单项接口
export interface BlacklistItem {
  jti: string // JWT ID
  userId: string
  reason: string
  expiry: number
  createdAt: string
}

export class SessionService {
  private static readonly SESSION_PREFIX = 'session:'
  private static readonly BLACKLIST_PREFIX = 'jwt:blacklist:'
  private static readonly USER_SESSIONS_PREFIX = 'user:sessions:'
  
  // 默认会话过期时间（秒）
  private static readonly DEFAULT_SESSION_TTL = 24 * 60 * 60 // 24小时
  
  /**
   * 创建会话
   */
  static async createSession(
    sessionId: string, 
    sessionData: SessionData, 
    ttl = this.DEFAULT_SESSION_TTL
  ): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`
      const success = await RedisUtils.set(key, sessionData, ttl)
      
      if (success) {
        // 添加到用户会话列表
        await this.addUserSession(sessionData.userId, sessionId, ttl)
        
        logger.debug({ 
          sessionId, 
          userId: sessionData.userId,
          ttl 
        }, 'Session created')
      }
      
      return success
    } catch (error) {
      logger.error({ error, sessionId }, 'Create session error')
      return false
    }
  }

  /**
   * 获取会话
   */
  static async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`
      return await RedisUtils.get<SessionData>(key)
    } catch (error) {
      logger.error({ error, sessionId }, 'Get session error')
      return null
    }
  }

  /**
   * 更新会话
   */
  static async updateSession(
    sessionId: string, 
    updates: Partial<SessionData>
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId)
      if (!session) return false

      const updatedSession = { ...session, ...updates }
      const key = `${this.SESSION_PREFIX}${sessionId}`
      
      // 保持原有的TTL
      const ttl = await RedisUtils.ttl(key)
      if (ttl > 0) {
        return await RedisUtils.set(key, updatedSession, ttl)
      } else {
        return await RedisUtils.set(key, updatedSession)
      }
    } catch (error) {
      logger.error({ error, sessionId }, 'Update session error')
      return false
    }
  }

  /**
   * 删除会话
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // 先获取会话信息以便从用户会话列表中删除
      const session = await this.getSession(sessionId)
      
      const key = `${this.SESSION_PREFIX}${sessionId}`
      const success = await RedisUtils.del(key)
      
      if (success && session) {
        // 从用户会话列表中删除
        await this.removeUserSession(session.userId, sessionId)
        
        logger.debug({ sessionId, userId: session.userId }, 'Session deleted')
      }
      
      return success
    } catch (error) {
      logger.error({ error, sessionId }, 'Delete session error')
      return false
    }
  }

  /**
   * 刷新会话过期时间
   */
  static async refreshSession(
    sessionId: string, 
    ttl = this.DEFAULT_SESSION_TTL
  ): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`
      const exists = await RedisUtils.exists(key)
      
      if (exists) {
        await RedisUtils.expire(key, ttl)
        
        // 更新最后活动时间
        await this.updateSession(sessionId, {
          lastActivity: new Date().toISOString()
        })
        
        logger.debug({ sessionId, ttl }, 'Session refreshed')
        return true
      }
      
      return false
    } catch (error) {
      logger.error({ error, sessionId }, 'Refresh session error')
      return false
    }
  }

  /**
   * 添加到用户会话列表
   */
  private static async addUserSession(
    userId: string, 
    sessionId: string, 
    ttl: number
  ): Promise<void> {
    try {
      const key = `${this.USER_SESSIONS_PREFIX}${userId}`
      await RedisUtils.hset(key, sessionId, new Date().toISOString())
      await RedisUtils.expire(key, ttl)
    } catch (error) {
      logger.error({ error, userId, sessionId }, 'Add user session error')
    }
  }

  /**
   * 从用户会话列表中删除
   */
  private static async removeUserSession(
    userId: string, 
    sessionId: string
  ): Promise<void> {
    try {
      const key = `${this.USER_SESSIONS_PREFIX}${userId}`
      // Redis 不支持 hdel，这里需要用其他方式处理
      // 可以考虑重构为使用 Set 或其他数据结构
    } catch (error) {
      logger.error({ error, userId, sessionId }, 'Remove user session error')
    }
  }

  /**
   * 获取用户所有会话
   */
  static async getUserSessions(userId: string): Promise<string[]> {
    try {
      const key = `${this.USER_SESSIONS_PREFIX}${userId}`
      const sessions = await RedisUtils.hgetall(key)
      return sessions ? Object.keys(sessions) : []
    } catch (error) {
      logger.error({ error, userId }, 'Get user sessions error')
      return []
    }
  }

  /**
   * 删除用户所有会话（用户登出所有设备）
   */
  static async deleteUserAllSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await this.getUserSessions(userId)
      if (sessionIds.length === 0) return 0

      const deletePromises = sessionIds.map(sessionId => 
        this.deleteSession(sessionId)
      )
      
      const results = await Promise.all(deletePromises)
      const deletedCount = results.filter(Boolean).length

      // 清除用户会话列表
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`
      await RedisUtils.del(userSessionsKey)

      logger.info({ userId, deletedCount }, 'All user sessions deleted')
      return deletedCount
    } catch (error) {
      logger.error({ error, userId }, 'Delete user all sessions error')
      return 0
    }
  }

  // JWT 黑名单管理

  /**
   * 添加 JWT 到黑名单
   */
  static async addToBlacklist(
    jti: string, 
    userId: string, 
    expiry: number, 
    reason = 'logout'
  ): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${jti}`
      const item: BlacklistItem = {
        jti,
        userId,
        reason,
        expiry,
        createdAt: new Date().toISOString(),
      }

      // 设置过期时间为 JWT 的过期时间
      const ttl = Math.max(0, expiry - Math.floor(Date.now() / 1000))
      if (ttl <= 0) return true // JWT 已经过期，不需要加入黑名单

      const success = await RedisUtils.set(key, item, ttl)
      
      if (success) {
        logger.debug({ jti, userId, reason, ttl }, 'JWT added to blacklist')
      }
      
      return success
    } catch (error) {
      logger.error({ error, jti }, 'Add to blacklist error')
      return false
    }
  }

  /**
   * 检查 JWT 是否在黑名单中
   */
  static async isBlacklisted(jti: string): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${jti}`
      return await RedisUtils.exists(key)
    } catch (error) {
      logger.error({ error, jti }, 'Check blacklist error')
      return false
    }
  }

  /**
   * 从黑名单中删除 JWT（通常不需要，会自动过期）
   */
  static async removeFromBlacklist(jti: string): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${jti}`
      return await RedisUtils.del(key)
    } catch (error) {
      logger.error({ error, jti }, 'Remove from blacklist error')
      return false
    }
  }

  /**
   * 将用户所有 JWT 加入黑名单
   */
  static async blacklistUserTokens(
    userId: string, 
    tokenIds: string[], 
    expiry: number,
    reason = 'security'
  ): Promise<number> {
    try {
      const promises = tokenIds.map(jti => 
        this.addToBlacklist(jti, userId, expiry, reason)
      )
      
      const results = await Promise.all(promises)
      const blacklistedCount = results.filter(Boolean).length

      logger.info({ 
        userId, 
        blacklistedCount, 
        total: tokenIds.length,
        reason 
      }, 'User tokens blacklisted')
      
      return blacklistedCount
    } catch (error) {
      logger.error({ error, userId }, 'Blacklist user tokens error')
      return 0
    }
  }
}

export default SessionService