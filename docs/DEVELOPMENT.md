# 二次开发指南

## 📋 概述

本项目提供了完整的用户认证和权限管理系统，但基础表结构可能不满足特定业务需求。本指南将指导你如何基于现有架构进行二次开发，包括数据库结构修改、初始化和定制化配置。

## 🗂 项目结构分析

### 核心文件位置
```
src/
├── db/
│   ├── schema.ts           # 数据库表结构定义
│   ├── index.ts           # 数据库连接和配置
│   ├── migrate.ts         # 迁移脚本
│   └── migrations/        # 迁移文件目录
│       ├── 0000_xxx.sql
│       ├── 0001_xxx.sql
│       └── meta/
├── routes/
│   ├── auth.ts            # 认证相关路由
│   └── users.ts           # 用户管理路由
├── middleware/
│   └── auth.ts            # 认证中间件
└── scripts/
    └── create-admin.ts    # 管理员创建脚本
```

## 🔄 二次开发步骤

### 0. 配置管理员账户

在开始数据库修改之前，首先配置管理员账户信息。系统会在数据库初始化时自动创建管理员用户。

#### 0.1 配置环境变量

在 `.env` 文件中设置管理员账户信息：

```bash
# 管理员账户配置（初始化时创建）
ADMIN_EMAIL=admin@yourcompany.com      # 管理员邮箱
ADMIN_PASSWORD=your-secure-password    # 管理员密码（建议使用强密码）
ADMIN_NAME=系统管理员                   # 管理员显示名称
```

#### 0.2 安全建议

⚠️ **生产环境安全提醒**：
- 使用强密码（至少包含大小写字母、数字和特殊字符）
- 避免使用默认密码 `admin123456`
- 部署后立即通过 API 修改管理员密码
- 考虑启用双因子认证（如果系统支持）

示例强密码：
```bash
ADMIN_PASSWORD=Adm1n@2024!SecureP@ssw0rd
```

### 1. 清理现有数据库状态

#### 1.1 删除现有迁移记录
```bash
# 删除现有数据库文件（开发环境）
rm -f db.dev.sqlite

# 删除迁移历史
rm -rf src/db/migrations/*
```

#### 1.2 重置迁移配置
```bash
# 清理 drizzle-kit 缓存
rm -rf .drizzle
```

### 2. 修改表结构

#### 2.1 编辑 `src/db/schema.ts`

根据业务需求修改现有表结构或添加新表：

```typescript
// 示例：扩展用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).default('user').notNull(),
  
  // 新增字段示例
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatar: text('avatar'),
  phone: text('phone'),
  department: text('department'),
  status: text('status', { enum: ['active', 'inactive', 'suspended'] }).default('active').notNull(),
  
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// 新增业务表示例
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  status: text('status', { enum: ['active', 'completed', 'archived'] }).default('active').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// 多对多关系表示例
export const projectMembers = sqliteTable('project_members', {
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).default('member').notNull(),
  joinedAt: text('joined_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.projectId, table.userId] }),
}));
```

#### 2.2 更新类型定义

```typescript
// 导出新的类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
```

### 3. 生成新的迁移文件

#### 3.1 生成迁移
```bash
# 基于新的 schema 生成初始迁移
bun run db:generate

# 这会在 src/db/migrations/ 目录下生成新的迁移文件
```

#### 3.2 验证迁移文件
检查生成的 SQL 文件是否符合预期：
```bash
# 查看生成的迁移文件
cat src/db/migrations/0000_*.sql
```

### 4. 运行迁移

#### 4.1 开发环境迁移
```bash
# 应用迁移到开发数据库
bun run db:migrate
```

#### 4.2 验证数据库结构
```bash
# 使用 Drizzle Studio 查看数据库结构
bun run db:studio

# 或使用 SQLite 命令行
sqlite3 db.dev.sqlite ".schema"
```

### 5. 创建初始数据

#### 5.1 修改管理员创建脚本

编辑 `src/scripts/create-admin.ts`：

```typescript
// 根据新的用户表结构调整
const adminUser = {
  id: nanoid(),
  username: 'admin',
  email: 'admin@example.com',
  password: await hash('admin123'),
  role: 'admin' as const,
  
  // 新增字段
  firstName: 'System',
  lastName: 'Administrator',
  status: 'active' as const,
};
```

#### 5.2 创建数据种子脚本

创建 `src/scripts/seed.ts`：

```typescript
import { db } from '../db';
import { users, projects, projectMembers } from '../db/schema';
import { nanoid } from 'nanoid';
import { hash } from '../utils/hash';

async function seed() {
  console.log('开始数据初始化...');
  
  // 创建测试用户
  const testUsers = [
    {
      id: nanoid(),
      username: 'testuser1',
      email: 'test1@example.com',
      password: await hash('password123'),
      role: 'user' as const,
      firstName: 'Test',
      lastName: 'User 1',
      status: 'active' as const,
    },
    // 更多测试数据...
  ];
  
  await db.insert(users).values(testUsers);
  
  // 创建测试项目
  const testProjects = [
    {
      id: nanoid(),
      name: '示例项目',
      description: '这是一个示例项目',
      ownerId: testUsers[0].id,
      status: 'active' as const,
    },
  ];
  
  await db.insert(projects).values(testProjects);
  
  console.log('数据初始化完成！');
}

seed().catch(console.error);
```

#### 5.3 运行初始化
```bash
# 创建管理员账户
bun run script:admin

# 运行数据种子
bun run src/scripts/seed.ts
```

### 6. 更新 API 路由

#### 6.1 修改现有路由

根据新的表结构更新 `src/routes/users.ts`：

```typescript
// 更新用户列表查询
app.get('/users', authMiddleware, async (c) => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    email: usersTable.email,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    role: usersTable.role,
    status: usersTable.status,
    createdAt: usersTable.createdAt,
  }).from(usersTable);
  
  return c.json(users);
});

// 更新用户创建接口
app.post('/users', authMiddleware, async (c) => {
  const { username, email, password, firstName, lastName, department } = await c.req.json();
  
  // 验证和创建逻辑...
});
```

#### 6.2 创建新的业务路由

创建 `src/routes/projects.ts`：

```typescript
import { Hono } from 'hono';
import { db } from '../db';
import { projects, projectMembers, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// 项目列表
app.get('/', authMiddleware, async (c) => {
  const projectList = await db.select({
    id: projects.id,
    name: projects.name,
    description: projects.description,
    status: projects.status,
    owner: {
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    },
    createdAt: projects.createdAt,
  })
  .from(projects)
  .leftJoin(users, eq(projects.ownerId, users.id));
  
  return c.json(projectList);
});

// 创建项目
app.post('/', authMiddleware, async (c) => {
  // 实现逻辑...
});

export default app;
```

### 7. 更新路由注册

在 `src/routes/index.ts` 中注册新路由：

```typescript
import projects from './projects';

// 注册路由
app.route('/api/projects', projects);
```

### 8. 更新中间件和类型

#### 8.1 更新认证中间件

如果用户表结构变化，更新 `src/middleware/auth.ts`：

```typescript
// 根据新的用户字段更新 JWT payload 或查询逻辑
```

#### 8.2 更新 API 类型定义

在 `src/types/api.ts` 中添加新的 API 类型：

```typescript
// 项目相关类型
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner: UserResponse;
  createdAt: string;
}
```

## 🧪 测试和验证

### 1. API 测试
```bash
# 启动开发服务器
bun run dev

# 测试新的 API 端点
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer <your_token>"
```

### 2. 数据库一致性检查
```bash
# 检查表结构
bun run db:studio

# 验证外键约束
sqlite3 db.dev.sqlite "PRAGMA foreign_key_check;"
```

## 📝 最佳实践

### 1. 版本控制
- 每次 schema 变更都要生成新的迁移文件
- 不要手动编辑已生成的迁移文件
- 保持迁移文件的原子性

### 2. 数据安全
- 在生产环境执行迁移前先备份数据库
- 测试所有迁移在开发环境中的正确性
- 考虑数据迁移的回滚策略

### 3. 性能优化
- 为常用查询字段添加索引
- 考虑表分区策略（如果数据量大）
- 定期分析查询性能

### 4. 代码组织
- 保持 schema 文件的清晰结构
- 使用有意义的表名和字段名
- 添加适当的注释说明业务逻辑

## 🔧 常用命令

```bash
# 生成新迁移
bun run db:generate

# 应用迁移
bun run db:migrate

# 启动 Drizzle Studio
bun run db:studio

# 创建管理员账户
bun run script:admin

# 重置数据库（开发环境）
rm -f db.dev.sqlite && bun run db:migrate

# 查看数据库结构
sqlite3 db.dev.sqlite ".schema"
```

## ⚠️ 注意事项

1. **生产环境迁移**：在生产环境执行数据库迁移时要格外小心，建议先在测试环境验证
2. **数据备份**：重要数据修改前务必备份
3. **依赖更新**：如果修改了核心表结构，检查所有相关的 API 和业务逻辑
4. **权限管理**：确保新的表和字段有适当的访问控制
5. **性能影响**：大表结构变更可能影响性能，考虑在低峰期执行

通过以上步骤，你可以基于现有的认证和权限系统，定制出符合业务需求的数据库结构和 API 接口。
