/**
 * 管理员权限中间件
 * 用于检查用户是否具有管理员权限
 */

import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppContext } from '../types'

/**
 * 管理员权限检查中间件
 * 需要在 authMiddleware 之后使用
 */
export const adminMiddleware = async (c: Context<AppContext>, next: Next) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: '请先登录' })
  }

  if (user.role !== 'admin') {
    throw new HTTPException(403, { message: '需要管理员权限' })
  }

  await next()
}

/**
 * 检查是否为管理员用户
 */
export const isAdmin = (user: any): boolean => {
  return user?.role === 'admin'
}

/**
 * 检查是否可以管理指定用户
 * 管理员可以管理所有用户，普通用户只能管理自己
 */
export const canManageUser = (currentUser: any, targetUserId: number): boolean => {
  if (!currentUser) return false
  
  // 管理员可以管理所有用户
  if (currentUser.role === 'admin') return true
  
  // 普通用户只能管理自己
  return currentUser.id === targetUserId
}