import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, desc, count, like, or } from 'drizzle-orm'
import { db, users } from '../db'
import { HashUtils } from '../utils'
import { 
  updateUserSchema, 
  changePasswordSchema,
  type UpdateUserRequest,
  type ChangePasswordRequest,
  type UserResponse
} from '../types/auth'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware, adminMiddleware, userRateLimit, strictRateLimit } from '../middleware'
import type { AppContext } from '../types'
import { z } from 'zod'

const usersRouter = new Hono<AppContext>()

// 用户列表查询参数校验
const userListSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  search: z.string().optional(),
  status: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  role: z.enum(['user', 'admin']).optional()
})

// 删除用户参数校验
const deleteUserSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10))
})

// 所有用户路由都需要认证和限流
usersRouter.use('*', authMiddleware)
usersRouter.use('*', userRateLimit)

// 更新用户信息
usersRouter.post('/me', zValidator('json', updateUserSchema), async (c) => {
  const user = c.get('user')
  const updates = c.req.valid('json') as UpdateUserRequest

  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 如果更新手机号，检查是否已存在
  if (updates.phone && updates.phone !== user.phone) {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, updates.phone))
      .get()

    if (existingUser) {
      throw new HTTPException(422, { message: '手机号已被使用' })
    }
  }

  // 更新用户信息
  const [updatedUser] = await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, user.id))
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

  return c.get('success')(updatedUser, '用户信息更新成功')
})

// 修改密码
usersRouter.post('/me/password', strictRateLimit, zValidator('json', changePasswordSchema), async (c) => {
  const user = c.get('user')
  const { oldPassword, newPassword } = c.req.valid('json') as ChangePasswordRequest

  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 查询完整用户信息（包含密码）
  const fullUser = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .get()

  if (!fullUser) {
    throw new HTTPException(404, { message: '用户不存在' })
  }

  // 验证旧密码
  const isOldPasswordValid = await HashUtils.verifyPassword(oldPassword, fullUser.password)
  if (!isOldPasswordValid) {
    throw new HTTPException(401, { message: '旧密码错误' })
  }

  // 哈希新密码
  const hashedNewPassword = await HashUtils.hashPassword(newPassword)

  // 更新密码
  await db
    .update(users)
    .set({
      password: hashedNewPassword,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, user.id))

  return c.get('success')(null, '密码修改成功')
})

// 删除账户
usersRouter.delete('/me', strictRateLimit, async (c) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 删除用户账户
  await db
    .delete(users)
    .where(eq(users.id, user.id))

  return c.get('success')(null, '账户删除成功')
})

// 获取用户统计信息
usersRouter.get('/me/stats', async (c) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 这里可以添加更多用户相关的统计信息
  const stats = {
    userId: user.id,
    // 可以添加用户相关的统计数据，比如创建的文章数、评论数等
    // articlesCount: await getArticlesCount(user.id),
    // commentsCount: await getCommentsCount(user.id),
  }

  return c.get('success')(stats, '获取用户统计信息成功')
})

// ==========================
// 管理员接口（需要管理员权限）
// ==========================

// 获取用户列表（管理员）
usersRouter.get('/', adminMiddleware, zValidator('query', userListSchema), async (c) => {
  const { page, limit, search, status, role } = c.req.valid('query')
  
  // 构建查询条件
  const conditions = []
  
  if (search) {
    conditions.push(
      or(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`),
        like(users.nickname, `%${search}%`)
      )
    )
  }
  
  if (status !== undefined) {
    conditions.push(eq(users.status, status))
  }
  
  if (role) {
    conditions.push(eq(users.role, role))
  }
  
  // 查询用户列表
  const offset = (page - 1) * limit
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      nickname: users.nickname,
      avatar: users.avatar,
      phone: users.phone,
      gender: users.gender,
      status: users.status,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(conditions.length > 0 ? conditions.reduce((acc, condition) => condition) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)
  
  // 查询总数
  const totalResult = await db
    .select({ count: count() })
    .from(users)
    .where(conditions.length > 0 ? conditions.reduce((acc, condition) => condition) : undefined)
  
  const total = totalResult[0]?.count || 0
  const totalPages = Math.ceil(total / limit)
  
  return c.get('success')({
    users: userList,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }, '获取用户列表成功')
})

// 删除指定用户（管理员）
usersRouter.delete('/:id', adminMiddleware, strictRateLimit, zValidator('param', deleteUserSchema), async (c) => {
  const { id } = c.req.valid('param')
  const currentUser = c.get('user')
  
  // 防止管理员删除自己
  if (currentUser?.id === id) {
    throw new HTTPException(400, { message: '不能删除自己的账户' })
  }
  
  // 查找目标用户
  const targetUser = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .get()
  
  if (!targetUser) {
    throw new HTTPException(404, { message: '用户不存在' })
  }
  
  // 防止删除另一个管理员账户（可选限制）
  if (targetUser.role === 'admin') {
    throw new HTTPException(400, { message: '不能删除管理员账户' })
  }
  
  // 删除用户
  const deleteResult = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id })
  
  if (deleteResult.length === 0) {
    throw new HTTPException(500, { message: '删除用户失败' })
  }
  
  return c.get('success')(null, `用户 ID ${id} 已被删除`)
})

// 更新用户状态（管理员）
usersRouter.post('/:id/status', adminMiddleware, strictRateLimit, 
  zValidator('param', deleteUserSchema),
  zValidator('json', z.object({ status: z.number().int().min(0).max(1) })),
  async (c) => {
    const { id } = c.req.valid('param')
    const { status } = c.req.valid('json')
    const currentUser = c.get('user')
    
    // 防止管理员禁用自己
    if (currentUser?.id === id && status === 0) {
      throw new HTTPException(400, { message: '不能禁用自己的账户' })
    }
    
    // 查找目标用户
    const targetUser = await db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .get()
    
    if (!targetUser) {
      throw new HTTPException(404, { message: '用户不存在' })
    }
    
    // 防止禁用另一个管理员账户（可选限制）
    if (targetUser.role === 'admin' && status === 0 && currentUser?.id !== id) {
      throw new HTTPException(400, { message: '不能禁用其他管理员账户' })
    }
    
    // 更新用户状态
    const updateResult = await db
      .update(users)
      .set({
        status,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status
      })
    
    if (updateResult.length === 0) {
      throw new HTTPException(500, { message: '更新用户状态失败' })
    }
    
    const statusText = status === 1 ? '启用' : '禁用'
    return c.get('success')(updateResult[0], `用户状态已${statusText}`)
  }
)

export default usersRouter