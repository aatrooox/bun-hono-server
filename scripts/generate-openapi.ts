#!/usr/bin/env bun

/**
 * OpenAPI 生成器 CLI 工具
 * 用于在构建时生成 OpenAPI JSON 文件
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { createOpenAPIGenerator } from '../src/utils/openapi-generator'
import { allRoutes } from '../src/config/openapi-routes'

function generateOpenAPIFile() {
  console.log('🚀 开始生成 OpenAPI 规范文件...')

  try {
    // 创建生成器
    const generator = createOpenAPIGenerator()
    
    // 添加所有路由
    console.log(`📡 正在处理 ${allRoutes.length} 个路由...`)
    allRoutes.forEach(route => {
      generator.addRoute(route)
      console.log(`  ✓ ${route.method.toUpperCase()} ${route.path}`)
    })
    
    // 生成 OpenAPI 规范
    const spec = generator.generate()
    const jsonContent = generator.generateJSON(true)
    
    // 确保输出目录存在
    const outputDir = join(process.cwd(), 'docs')
    const outputFile = join(outputDir, 'openapi.json')
    
    mkdirSync(dirname(outputFile), { recursive: true })
    
    // 写入文件
    writeFileSync(outputFile, jsonContent, 'utf8')
    
    console.log('✅ OpenAPI 规范文件生成成功!')
    console.log(`📄 文件位置: ${outputFile}`)
    console.log(`📊 统计信息:`)
    console.log(`   - 路径数量: ${Object.keys(spec.paths).length}`)
    console.log(`   - 操作数量: ${Object.values(spec.paths).reduce((count: number, path: any) => count + Object.keys(path).length, 0)}`)
    console.log(`   - Schema 数量: ${Object.keys(spec.components.schemas).length}`)
    console.log(`   - 标签数量: ${[...new Set(allRoutes.flatMap(route => route.tags || []))].length}`)
    
    // 生成统计信息
    const stats = {
      generatedAt: new Date().toISOString(),
      totalRoutes: allRoutes.length,
      authRequired: allRoutes.filter(route => route.requiresAuth).length,
      tags: [...new Set(allRoutes.flatMap(route => route.tags || []))],
      methods: [...new Set(allRoutes.map(route => route.method.toUpperCase()))],
      rateLimits: {
        auth: allRoutes.filter(route => route.rateLimit === 'auth').length,
        user: allRoutes.filter(route => route.rateLimit === 'user').length,
        upload: allRoutes.filter(route => route.rateLimit === 'upload').length,
        strict: allRoutes.filter(route => route.rateLimit === 'strict').length
      }
    }
    
    // 写入统计文件
    const statsFile = join(outputDir, 'openapi-stats.json')
    writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf8')
    console.log(`📈 统计文件: ${statsFile}`)
    
  } catch (error: any) {
    console.error('❌ 生成 OpenAPI 规范文件失败:')
    console.error(error.message)
    process.exit(1)
  }
}

// 检查命令行参数
const args = process.argv.slice(2)
const showHelp = args.includes('--help') || args.includes('-h')

if (showHelp) {
  console.log(`
OpenAPI 生成器 CLI 工具

用法:
  bun run scripts/generate-openapi.ts [选项]

选项:
  -h, --help     显示帮助信息

输出:
  docs/openapi.json       OpenAPI 规范文件
  docs/openapi-stats.json 生成统计信息

示例:
  bun run scripts/generate-openapi.ts
`)
  process.exit(0)
}

// 执行生成
generateOpenAPIFile()