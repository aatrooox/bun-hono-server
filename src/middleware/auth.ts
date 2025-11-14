import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { JwtUtils } from '../utils/jwt'
import { db, users } from '../db'
import { eq } from 'drizzle-orm'
import { ErrorCodes } from '../types/api'

/**
 * JWT 认证中间件 - 使用 Access Token
 */
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // 从 Authorization header 获取 token
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: '缺少访问令牌' })
    }

    const token = authHeader.substring(7) // 移除 "Bearer " 前缀

    // 验证 access token
    const payload = JwtUtils.verifyAccessToken(token)
    
    // 查询用户信息
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        nickname: users.nickname,
        avatar: users.avatar,
        phone: users.phone,
        gender: users.gender,
        birthday: users.birthday,
        bio: users.bio,
        role: users.role,
        status: users.status
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .get()

    if (!user) {
      throw new HTTPException(401, { message: '用户不存在' })
    }

    // 检查用户状态
    if (user.status !== 1) {
      throw new HTTPException(401, { message: '用户账户已被禁用' })
    }

    // 将用户信息添加到上下文
    c.set('user', user)
    c.set('jwtPayload', payload)

    await next()
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    
    // JWT 相关错误
    if (error instanceof Error) {
      if (error.name === 'JsonWebTokenError') {
        throw new HTTPException(401, { message: '无效的访问令牌' })
      }
      if (error.name === 'TokenExpiredError') {
        throw new HTTPException(401, { message: '访问令牌已过期' })
      }
    }

    throw new HTTPException(401, { message: '认证失败' })
  }
}

/**
 * 可选认证中间件 - 如果有 token 则验证，没有则跳过
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const payload = JwtUtils.verifyAccessToken(token)
      
      const user = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          nickname: users.nickname,
          avatar: users.avatar,
          phone: users.phone,
          gender: users.gender,
          birthday: users.birthday,
          bio: users.bio,
          role: users.role,
          status: users.status
        })
        .from(users)
        .where(eq(users.id, payload.userId))
        .get()

      if (user && user.status === 1) {
        c.set('user', user)
        c.set('jwtPayload', payload)
      }
    }
    
    await next()
  } catch {
    // 可选认证，失败了就跳过
    await next()
  }
}