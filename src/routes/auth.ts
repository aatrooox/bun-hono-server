import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { db, users, refreshTokens } from '../db'
import { HashUtils, JwtUtils } from '../utils'
import { 
  registerSchema, 
  loginSchema,
  refreshTokenSchema,
  type RegisterRequest, 
  type LoginRequest,
  type RefreshTokenRequest,
  type UserResponse,
  type LoginResponse,
  type RefreshTokenResponse
} from '../types/auth'
import { ErrorCodes } from '../types/api'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware, authRateLimit } from '../middleware'
import { randomUUID } from 'crypto'
import type { AppContext } from '../types'

const auth = new Hono<AppContext>()

// 用户注册
auth.post('/register', authRateLimit, zValidator('json', registerSchema), async (c) => {
  const { email, password, name } = c.req.valid('json') as RegisterRequest

  // 检查邮箱是否已存在
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (existingUser) {
    throw new HTTPException(422, { message: '邮箱已被注册' })
  }

  // 哈希密码
  const hashedPassword = await HashUtils.hashPassword(password)

  // 创建用户
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      password: hashedPassword,
      name
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      nickname: users.nickname,
      avatar: users.avatar,
      phone: users.phone,
      gender: users.gender,
      birthday: users.birthday,
      bio: users.bio,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })

  // 生成 token 对
  const tokenPair = JwtUtils.generateTokenPair({
    userId: newUser.id,
    email: newUser.email
  })

  // 存储 refresh token
  const refreshTokenExpiresAt = JwtUtils.getRefreshTokenExpiresAt()
  await db.insert(refreshTokens).values({
    id: randomUUID(),
    userId: newUser.id,
    token: tokenPair.refreshToken,
    expiresAt: refreshTokenExpiresAt.toISOString(),
    deviceInfo: c.req.header('User-Agent') || 'Unknown',
    ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'Unknown'
  })

  const response: LoginResponse = {
    user: newUser,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: 15 * 60 // 15 分钟
  }

  return c.get('success')(response, '注册成功')
})

// 用户登录
auth.post('/login', authRateLimit, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json') as LoginRequest

  // 查找用户
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    throw new HTTPException(401, { message: '邮箱或密码错误' })
  }

  // 检查用户状态
  if (user.status !== 1) {
    throw new HTTPException(401, { message: '用户账户已被禁用' })
  }

  // 验证密码
  const isPasswordValid = await HashUtils.verifyPassword(password, user.password)
  if (!isPasswordValid) {
    throw new HTTPException(401, { message: '邮箱或密码错误' })
  }

  // 生成 token 对
  const tokenPair = JwtUtils.generateTokenPair({
    userId: user.id,
    email: user.email
  })

  // 存储 refresh token
  const refreshTokenExpiresAt = JwtUtils.getRefreshTokenExpiresAt()
  await db.insert(refreshTokens).values({
    id: randomUUID(),
    userId: user.id,
    token: tokenPair.refreshToken,
    expiresAt: refreshTokenExpiresAt.toISOString(),
    deviceInfo: c.req.header('User-Agent') || 'Unknown',
    ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'Unknown'
  })

  const userResponse: UserResponse = {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    avatar: user.avatar,
    phone: user.phone,
    gender: user.gender,
    birthday: user.birthday,
    bio: user.bio,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }

  const response: LoginResponse = {
    user: userResponse,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: 15 * 60 // 15 分钟
  }

  return c.get('success')(response, '登录成功')
})

// 获取当前用户信息
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  
  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  return c.get('success')(user, '获取用户信息成功')
})

// 刷新令牌
auth.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid('json') as RefreshTokenRequest
  
  // 查找 refresh token
  const tokenRecord = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
      isRevoked: refreshTokens.isRevoked,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status
      }
    })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(
      and(
        eq(refreshTokens.token, refreshToken),
        eq(refreshTokens.isRevoked, 0)
      )
    )
    .get()

  if (!tokenRecord) {
    throw new HTTPException(401, { message: '无效的刷新令牌' })
  }

  // 检查 refresh token 是否过期
  if (JwtUtils.isRefreshTokenExpired(tokenRecord.expiresAt)) {
    // 删除过期的 token
    await db
      .update(refreshTokens)
      .set({ isRevoked: 1 })
      .where(eq(refreshTokens.id, tokenRecord.id))
      
    throw new HTTPException(401, { message: '刷新令牌已过期' })
  }

  // 检查用户状态
  if (tokenRecord.user.status !== 1) {
    throw new HTTPException(401, { message: '用户账户已被禁用' })
  }

  // 生成新的 access token
  const newAccessToken = JwtUtils.generateAccessToken({
    userId: tokenRecord.user.id,
    email: tokenRecord.user.email
  })

  const response: RefreshTokenResponse = {
    accessToken: newAccessToken,
    expiresIn: 15 * 60 // 15 分钟
  }

  return c.get('success')(response, '令牌刷新成功')
})

// 退出登录（吃销 refresh token）
auth.post('/logout', zValidator('json', refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid('json') as RefreshTokenRequest
  
  // 查找并吃销 refresh token
  const result = await db
    .update(refreshTokens)
    .set({ 
      isRevoked: 1,
      updatedAt: new Date().toISOString()
    })
    .where(
      and(
        eq(refreshTokens.token, refreshToken),
        eq(refreshTokens.isRevoked, 0)
      )
    )
    .returning({ id: refreshTokens.id })

  if (result.length === 0) {
    throw new HTTPException(401, { message: '无效的刷新令牌' })
  }

  return c.get('success')(null, '退出登录成功')
})

// 退出所有设备（吃销用户所有 refresh token）
auth.post('/logout-all', authMiddleware, async (c) => {
  const user = c.get('user')
  
  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 吃销用户所有的 refresh token
  await db
    .update(refreshTokens)
    .set({ 
      isRevoked: 1,
      updatedAt: new Date().toISOString()
    })
    .where(
      and(
        eq(refreshTokens.userId, user.id),
        eq(refreshTokens.isRevoked, 0)
      )
    )

  return c.get('success')(null, '已退出所有设备')
})

export default auth