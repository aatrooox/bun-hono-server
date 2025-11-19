import * as jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/auth'
import { randomUUID } from 'crypto'
import Config from '../config'

const JWT_SECRET = Config.JWT_SECRET
const ACCESS_TOKEN_EXPIRES_IN = '15m' // 15 分钟
const REFRESH_TOKEN_EXPIRES_IN = '7d' // 7 天

export class JwtUtils {
  /**
   * 生成 Access Token（短期令牌）
   */
  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'bun-hono-server',
      jwtid: randomUUID() // 每个 token 都有唯一 ID
    })
  }

  /**
   * 生成 Refresh Token（长期令牌）
   */
  static generateRefreshToken(): string {
    // 生成一个随机的字符串作为 refresh token
    return randomUUID() + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2)
  }

  /**
   * 生成一对 token
   */
  static generateTokenPair(payload: JwtPayload): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken()
    }
  }

  /**
   * 验证 Access Token
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload
    } catch (error) {
      throw error
    }
  }

  /**
   * 验证 JWT 令牌（兼容旧接口）
   */
  static verifyToken(token: string): JwtPayload {
    return this.verifyAccessToken(token)
  }

  /**
   * 解码JWT令牌（不验证）
   */
  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload
    } catch {
      return null
    }
  }

  /**
   * 获取 Refresh Token 过期时间
   */
  static getRefreshTokenExpiresAt(): Date {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7天后
    return expiresAt
  }

  /**
   * 检查 Refresh Token 是否过期
   */
  static isRefreshTokenExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date()
  }
}