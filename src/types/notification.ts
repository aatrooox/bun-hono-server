/**
 * FSF 通知系统类型定义
 */

import { z } from 'zod'

// 推送目标类型
export type TargetType = 'http' | 'feishu' | 'dingtalk' | 'wechat_work'

// 触发类型
export type TriggerType = 'cron' | 'manual' | 'passive'

// 推送目标配置
export interface PushTarget {
  type: TargetType
  url: string
  auth?: {
    type: 'bearer' | 'custom'
    token?: string
    headers?: Record<string, string>
  }
}

// 触发配置
export interface TriggerConfig {
  cron?: string // cron 表达式
}

// 推送结果
export interface PushResult {
  ok: boolean
  status: number
  body: string
  duration: number
}

// ==================== Zod Schemas ====================

// 创建场景
export const createSceneSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, '场景名称只能包含小写字母、数字、下划线和连字符'),
  description: z.string().optional(),
  handler: z.string().min(1),
  cacheTtl: z.number().min(0).default(300),
  status: z.number().min(0).max(1).default(1)
})

// 更新场景
export const updateSceneSchema = createSceneSchema.partial()

// 创建订阅
export const createSubscriptionSchema = z.object({
  sceneName: z.string().min(1),
  name: z.string().min(1).max(100),
  targetType: z.enum(['http', 'feishu', 'dingtalk', 'wechat_work']),
  targetUrl: z.string().url(),
  targetAuth: z.string().optional(), // JSON string
  triggerType: z.enum(['cron', 'manual', 'passive']),
  triggerConfig: z.string().optional(), // JSON string
  template: z.string().optional(),
  status: z.number().min(0).max(1).default(1),
  retryCount: z.number().min(0).max(10).default(3),
  timeout: z.number().min(5).max(300).default(30)
})

// 更新订阅
export const updateSubscriptionSchema = createSubscriptionSchema.partial()

// 验证 cron 表达式
export function validateCronExpression(cron: string): boolean {
  // 简单验证：5-6 个字段（秒 分 时 日 月 周）
  const parts = cron.trim().split(/\s+/)
  return parts.length >= 5 && parts.length <= 6
}

// 验证 JSON 字符串
export function parseJsonSafely<T = any>(jsonStr: string | null | undefined, defaultValue: T): T {
  if (!jsonStr) return defaultValue
  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return defaultValue
  }
}
