/**
 * FSF 推送适配器
 * 支持 HTTP、飞书、钉钉、企业微信等推送目标
 */

import { logger } from '../../utils/logger'
import type { PushTarget, PushResult } from '../../types/notification'

const pushLogger = logger.child({ module: 'fsf-push' })

/**
 * 应用模板（简单的 Mustache 风格替换）
 */
function applyTemplate(template: string, data: any): any {
  if (!template) return data
  
  try {
    const templateObj = JSON.parse(template)
    const jsonStr = JSON.stringify(templateObj)
    
    // 简单替换 {{key}} 为对应的值
    const result = jsonStr.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], data)
      return value !== undefined ? JSON.stringify(value) : match
    })
    
    return JSON.parse(result)
  } catch (error) {
    pushLogger.warn({ error: (error as Error).message }, '模板解析失败，返回原始数据')
    return data
  }
}

/**
 * 包装飞书消息格式
 */
function wrapFeishuMessage(data: any): any {
  // 如果已经是飞书格式，直接返回
  if (data.msg_type) return data
  
  // 否则包装为简单文本消息
  return {
    msg_type: 'text',
    content: {
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    }
  }
}

/**
 * 包装钉钉消息格式
 */
function wrapDingtalkMessage(data: any): any {
  // 如果已经是钉钉格式，直接返回
  if (data.msgtype) return data
  
  // 否则包装为简单文本消息
  return {
    msgtype: 'text',
    text: {
      content: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    }
  }
}

/**
 * 包装企业微信消息格式
 */
function wrapWechatWorkMessage(data: any): any {
  // 如果已经是企业微信格式，直接返回
  if (data.msgtype) return data
  
  // 否则包装为简单文本消息
  return {
    msgtype: 'text',
    text: {
      content: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    }
  }
}

/**
 * 推送到目标
 */
export async function pushToTarget(
  target: PushTarget,
  data: any,
  template?: string,
  timeout: number = 30000
): Promise<PushResult> {
  const startTime = Date.now()
  
  try {
    // 1. 应用模板
    let payload = template ? applyTemplate(template, data) : data
    
    // 2. 根据类型包装消息格式
    if (target.type === 'feishu') {
      payload = wrapFeishuMessage(payload)
    } else if (target.type === 'dingtalk') {
      payload = wrapDingtalkMessage(payload)
    } else if (target.type === 'wechat_work') {
      payload = wrapWechatWorkMessage(payload)
    }
    
    // 3. 构造请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (target.auth?.type === 'bearer' && target.auth.token) {
      headers['Authorization'] = `Bearer ${target.auth.token}`
    } else if (target.auth?.type === 'custom' && target.auth.headers) {
      Object.assign(headers, target.auth.headers)
    }
    
    // 4. 发送请求
    pushLogger.info({ 
      targetType: target.type, 
      url: target.url 
    }, '开始推送')
    
    const response = await fetch(target.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout)
    })
    
    const body = await response.text()
    const duration = Date.now() - startTime
    
    const result: PushResult = {
      ok: response.ok,
      status: response.status,
      body,
      duration
    }
    
    if (response.ok) {
      pushLogger.info({ 
        targetType: target.type, 
        status: response.status, 
        duration 
      }, '推送成功')
    } else {
      pushLogger.warn({ 
        targetType: target.type, 
        status: response.status, 
        body, 
        duration 
      }, '推送失败')
    }
    
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = (error as Error).message
    
    pushLogger.error({ 
      targetType: target.type, 
      error: errorMessage, 
      duration 
    }, '推送异常')
    
    return {
      ok: false,
      status: 0,
      body: errorMessage,
      duration
    }
  }
}

/**
 * 重试推送（带指数退避）
 */
export async function pushWithRetry(
  target: PushTarget,
  data: any,
  template: string | undefined,
  timeout: number,
  maxRetries: number = 3
): Promise<PushResult> {
  let lastResult: PushResult | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 最多等待 10 秒
      pushLogger.info({ attempt, delay }, '准备重试推送')
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    lastResult = await pushToTarget(target, data, template, timeout)
    
    if (lastResult.ok) {
      if (attempt > 0) {
        pushLogger.info({ attempt }, '重试推送成功')
      }
      return lastResult
    }
  }
  
  pushLogger.error({ maxRetries }, '推送失败，已达最大重试次数')
  return lastResult!
}
