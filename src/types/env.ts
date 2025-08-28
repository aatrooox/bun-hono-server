// Hono 环境变量类型
export interface Env {
  JWT_SECRET: string
  DATABASE_URL?: string
  NODE_ENV?: string
  PORT?: string
}

// Hono 应用上下文类型
export interface AppContext {
  Bindings: Env
  Variables: {
    user?: {
      id: number
      email: string
      name: string
    }
    jwtPayload?: {
      userId: number
      email: string
    }
  }
}