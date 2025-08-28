import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

// 从环境变量获取数据库URL，如果没有则使用默认值
const databaseUrl = process.env.DATABASE_URL || './database.sqlite'

// 创建 SQLite 数据库连接
const sqlite = new Database(databaseUrl, { create: true })

// 创建 Drizzle 实例
export const db = drizzle(sqlite, { schema })

// 导出数据库实例用于关闭连接
export { sqlite }

// 导出 schema
export * from './schema'