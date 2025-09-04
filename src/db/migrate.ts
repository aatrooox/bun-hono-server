import { db } from './index'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createAdminUser } from '../scripts/create-admin'

async function initDatabase() {
  try {
    console.log('🚀 正在初始化数据库...')
    
    // 执行迁移
    await migrate(db, { migrationsFolder: './src/db/migrations' })
    console.log('✅ 数据库迁移完成！')
    
    // 创建管理员账户
    console.log('👤 正在初始化管理员账户...')
    await createAdminUser()
    
    console.log('✅ 数据库初始化完成！')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件，则执行初始化
if (import.meta.main) {
  await initDatabase()
}

export { initDatabase }