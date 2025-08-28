import { cors } from 'hono/cors'

// CORS 配置
export const corsConfig = cors({
  origin: ['https://zzao.club', 'http://localhost:5173', 'http://localhost:8080'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-ID'],
  maxAge: 86400, // 24小时
  credentials: true
})