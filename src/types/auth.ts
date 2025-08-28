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
  nickname: z.string().min(1, '昵称不能为空').max(30, '昵称不能超过30位').optional(),
  avatar: z.string().url('头像必须是有效的URL').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional(),
  gender: z.number().int().min(0).max(2, '性别取值范围为0-2').optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '生日格式为YYYY-MM-DD').optional(),
  bio: z.string().max(200, '个人简介不能超过200字').optional()
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
  nickname?: string | null
  avatar?: string | null
  phone?: string | null
  gender?: number | null
  birthday?: string | null
  bio?: string | null
  status: number
  createdAt: string
  updatedAt: string
}

// 登录响应类型（新版双 token）
export interface LoginResponse {
  user: UserResponse
  accessToken: string
  refreshToken: string
  expiresIn: number // access token 过期时间（秒）
}

// token 刷新响应类型
export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number // access token 过期时间（秒）
}

// refresh token 请求类型
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token 不能为空')
})

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>