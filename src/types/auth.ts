import { z } from 'zod'

// JWT Payload 类型
export interface JwtPayload {
  userId: number
  email: string
  iat?: number
  exp?: number
}

// 用户注册验证 Schema
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位').max(50, '密码不能超过50位'),
  name: z.string().min(2, '姓名至少2位').max(20, '姓名不能超过20位')
})

// 用户登录验证 Schema
export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空')
})

// 用户更新验证 Schema
export const updateUserSchema = z.object({
  name: z.string().min(2, '姓名至少2位').max(20, '姓名不能超过20位').optional(),
  email: z.string().email('邮箱格式不正确').optional()
})

// 密码修改验证 Schema
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '旧密码不能为空'),
  newPassword: z.string().min(6, '新密码至少6位').max(50, '新密码不能超过50位')
})

// 导出类型
export type RegisterRequest = z.infer<typeof registerSchema>
export type LoginRequest = z.infer<typeof loginSchema>
export type UpdateUserRequest = z.infer<typeof updateUserSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>

// 用户信息响应类型
export interface UserResponse {
  id: number
  email: string
  name: string
  createdAt: string
  updatedAt: string
}

// 登录响应类型
export interface LoginResponse {
  user: UserResponse
  token: string
}