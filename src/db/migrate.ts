import { db } from './index'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createAdminUser } from '../scripts/create-admin'

async function initDatabase() {
  try {
    console.log('🚀 正在初始化数据库...')
    
    // 执行迁移
    console.log('📝 开始执行数据库迁移...')
    try {
      await migrate(db, { migrationsFolder: './src/db/migrations' })
      console.log('✅ 数据库迁移完成！')
    } catch (migrateError) {
      console.error('❌ 数据库迁移失败:', migrateError)
      throw migrateError
    }
    
    // 创建管理员账户
    console.log('👤 正在初始化管理员账户...')
    try {
      await createAdminUser()
      console.log('✅ 管理员账户处理完成！')
    } catch (adminError) {
      console.error('❌ 管理员账户创建失败:', adminError)
      console.log('⚠️  服务将继续启动，但可能没有管理员账户')
      // 不抛出错误，允许服务继续启动
    }
    
    console.log('✅ 数据库初始化完成！')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    console.error('错误详情:', error instanceof Error ? error.message : '未知错误')
    process.exit(1)
  }
}

// 如果直接运行此文件，则执行初始化
if (import.meta.main) {
  await initDatabase()
}

export { initDatabase }