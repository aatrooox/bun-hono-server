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

// 基础订阅 Schema
const baseSubscriptionSchema = z.object({
  sceneName: z.string().min(1),
  name: z.string().min(1).max(100),
  targetType: z.enum(['http', 'feishu', 'dingtalk', 'wechat_work']),
  targetUrl: z.string().url().refine(url => !isPrivateIP(url), {
    message: '禁止使用私有 IP 地址或 localhost'
  }),
  targetAuth: z.string().optional(), // JSON string
  triggerType: z.enum(['cron', 'manual', 'passive']),
  triggerConfig: z.string().optional(), // JSON string
  template: z.string().optional(),
  status: z.number().min(0).max(1).default(1),
  retryCount: z.number().min(0).max(1).default(3),
  timeout: z.number().min(5).max(300).default(30)
})

// 创建订阅
export const createSubscriptionSchema = baseSubscriptionSchema.superRefine((data, ctx) => {
  if (data.triggerType === 'cron') {
    if (!data.triggerConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cron 类型订阅必须提供 triggerConfig',
        path: ['triggerConfig']
      })
      return
    }
    
    const config = parseJsonSafely<TriggerConfig>(data.triggerConfig, {})
    if (!config.cron || !validateCronExpression(config.cron)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '无效的 Cron 表达式',
        path: ['triggerConfig']
      })
    }
  }
})

// 更新订阅
export const updateSubscriptionSchema = baseSubscriptionSchema.partial().superRefine((data, ctx) => {
  // 如果更新了 triggerType 为 cron，或者只更新了 triggerConfig (假设原类型是 cron 或新类型是 cron)
  // 这里简化处理：如果有 triggerConfig，就尝试验证其中的 cron
  if (data.triggerConfig) {
    const config = parseJsonSafely<TriggerConfig>(data.triggerConfig, {})
    if (config.cron && !validateCronExpression(config.cron)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '无效的 Cron 表达式',
        path: ['triggerConfig']
      })
    }
  }
})

// 验证 cron 表达式
export function validateCronExpression(cron: string): boolean {
  // 简单验证：5-6 个字段（秒 分 时 日 月 周）
  const parts = cron.trim().split(/\s+/)
  return parts.length >= 5 && parts.length <= 6
}

// 验证是否为私有 IP
function isPrivateIP(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname
    
    // 本地地址
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
    
    // 私有 IP 段
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255
    const parts = hostname.split('.').map(Number)
    if (parts.length === 4) {
      if (parts[0] === 10) return true
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      if (parts[0] === 192 && parts[1] === 168) return true
    }
    
    return false
  } catch {
    return false
  }
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
