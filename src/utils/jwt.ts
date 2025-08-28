import * as jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
const JWT_EXPIRES_IN = '7d'

export class JwtUtils {
  /**
   * 生成JWT令牌
   */
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'bun-hono-server'
    })
  }

  /**
   * 验证JWT令牌
   */
  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload
    } catch (error) {
      throw error
    }
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
}