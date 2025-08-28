import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db, users } from '../db'
import { HashUtils, JwtUtils } from '../utils'
import { 
  registerSchema, 
  loginSchema, 
  type RegisterRequest, 
  type LoginRequest,
  type UserResponse,
  type LoginResponse
} from '../types/auth'
import { ErrorCodes } from '../types/api'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middleware'

const auth = new Hono()

/**
 * 用户注册
 */
auth.post('/register', zValidator('json', registerSchema), async (c) => {
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
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })

  // 生成 JWT
  const token = JwtUtils.generateToken({
    userId: newUser.id,
    email: newUser.email
  })

  const response: LoginResponse = {
    user: newUser,
    token
  }

  return c.get('success')(response, '注册成功')
})

/**
 * 用户登录
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
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

  // 验证密码
  const isPasswordValid = await HashUtils.verifyPassword(password, user.password)
  if (!isPasswordValid) {
    throw new HTTPException(401, { message: '邮箱或密码错误' })
  }

  // 生成 JWT
  const token = JwtUtils.generateToken({
    userId: user.id,
    email: user.email
  })

  const userResponse: UserResponse = {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }

  const response: LoginResponse = {
    user: userResponse,
    token
  }

  return c.get('success')(response, '登录成功')
})

/**
 * 获取当前用户信息
 */
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  
  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  return c.get('success')(user, '获取用户信息成功')
})

/**
 * 刷新令牌
 */
auth.post('/refresh', authMiddleware, async (c) => {
  const user = c.get('user')
  
  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 生成新的 JWT
  const token = JwtUtils.generateToken({
    userId: user.id,
    email: user.email
  })

  return c.get('success')({ token }, '令牌刷新成功')
})

export default auth