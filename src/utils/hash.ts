import * as bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export class HashUtils {
  /**
   * 哈希密码
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  /**
   * 验证密码
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }
}