/**
 * 创建管理员用户脚本
 * 用于初始化系统管理员账户
 */

import { db, users } from '../db'
import { HashUtils } from '../utils'
import { eq } from 'drizzle-orm'

const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'admin123456' // 建议在生产环境中使用更强的密码
const ADMIN_NAME = '系统管理员'

async function createAdminUser() {
  try {
    console.log('🔍 检查管理员账户是否存在...')
    
    // 检查是否已经存在管理员账户
    const existingAdmin = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .get()
    
    if (existingAdmin) {
      console.log('✅ 管理员账户已存在:', existingAdmin.email)
      
      // 确保该用户是管理员角色
      await db
        .update(users)
        .set({ 
          role: 'admin',
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, existingAdmin.id))
      
      console.log('✅ 管理员权限已确认')
      return
    }
    
    console.log('👤 创建管理员账户...')
    
    // 哈希密码
    const hashedPassword = await HashUtils.hashPassword(ADMIN_PASSWORD)
    
    // 创建管理员用户
    const newAdmin = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: ADMIN_NAME,
        role: 'admin',
        status: 1
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role
      })
    
    console.log('✅ 管理员账户创建成功:')
    console.log(`   邮箱: ${newAdmin[0].email}`)
    console.log(`   密码: ${ADMIN_PASSWORD}`)
    console.log(`   角色: ${newAdmin[0].role}`)
    console.log('')
    console.log('⚠️  请在生产环境中立即修改默认密码！')
    
  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件，则执行创建管理员用户
if (import.meta.main) {
  await createAdminUser()
  process.exit(0)
}

export { createAdminUser }