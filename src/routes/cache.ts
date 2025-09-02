import { Hono } from 'hono'
import type { AppContext } from '../types'

// 注意：不再对外暴露任何“缓存写入/维护”接口。
// 缓存能力仅通过内部中间件与工具使用（见 src/cache/*）。
// 本文件保留空路由占位，避免误引入。

const deprecatedCacheRoutes = new Hono<AppContext>()

export default deprecatedCacheRoutes