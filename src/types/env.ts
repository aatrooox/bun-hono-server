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
      nickname?: string | null
      avatar?: string | null
      phone?: string | null
      gender?: number | null
      birthday?: string | null
      bio?: string | null
      status: number
    }
    jwtPayload?: {
      userId: number
      email: string
    }
  }
}