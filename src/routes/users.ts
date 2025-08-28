import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
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
import { authMiddleware } from '../middleware'

const usersRouter = new Hono()

// 所有用户路由都需要认证
usersRouter.use('*', authMiddleware)

/**
 * 更新用户信息
 */
usersRouter.patch('/me', zValidator('json', updateUserSchema), async (c) => {
  const user = c.get('user')
  const updates = c.req.valid('json') as UpdateUserRequest

  if (!user) {
    throw new HTTPException(401, { message: '用户信息不存在' })
  }

  // 如果更新邮箱，检查是否已存在
  if (updates.email && updates.email !== user.email) {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, updates.email))
      .get()

    if (existingUser) {
      throw new HTTPException(422, { message: '邮箱已被使用' })
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
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })

  return c.get('success')(updatedUser, '用户信息更新成功')
})

/**
 * 修改密码
 */
usersRouter.patch('/me/password', zValidator('json', changePasswordSchema), async (c) => {
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

/**
 * 删除账户
 */
usersRouter.delete('/me', async (c) => {
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

/**
 * 获取用户统计信息
 */
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

export default usersRouter