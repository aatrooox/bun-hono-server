/*
  Static analyzer to generate OpenAPI 3.0 JSON from Hono routes.
  Scope: local dev only. It scans src/routes/*.ts, extracts HTTP methods & paths,
  and builds schemas from known Zod schemas in src/types/* when referenced by name.

  Limitations:
  - Heuristic-based: it won't catch dynamic runtime conditions.
  - Only covers basic zValidator('json'|'query'|'param'|'form', schemaVar).
  - Response schema is wrapped by the project's ApiResponse envelope.

  Output: docs/openapi.json
*/

import { Project, SyntaxKind, ts } from 'ts-morph'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { pathToFileURL } from 'url'

// ---------- Config ----------
const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const ROUTES_DIR = path.join(SRC_DIR, 'routes')
const TYPES_DIR = path.join(SRC_DIR, 'types')
const OUTPUT = path.join(ROOT, 'docs', 'openapi.json')

// Base path prefix used in src/routes/index.ts
const API_PREFIX = '/api'

// Common ApiResponse envelope
function wrapApiResponse(schema: any) {
  return {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: schema ?? { type: 'object', nullable: true },
      timestamp: { type: 'number' },
    },
    required: ['code', 'message', 'data', 'timestamp'],
  }
}

// Convert Hono path params like ":id" or ":path{.+}" to OpenAPI style "{id}"/"{path}"
function honoPathToOpenAPI(p: string) {
  // 1) :name{regex} -> {name}
  let out = p.replace(/:([A-Za-z_][A-Za-z0-9_]*)\{[^}]*\}/g, '{$1}')
  // 2) :name -> {name}
  out = out.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}')
  // 3) Cleanup in case any {name}{regex} remains -> {name}
  out = out.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}\{[^}]*\}/g, '{$1}')
  return out
}

// Attempt to map route file to mounted prefix using routes/index.ts via AST
function readMountTableWithAst(project: Project): Record<string, string> {
  const indexPath = path.join(ROUTES_DIR, 'index.ts')
  if (!fs.existsSync(indexPath)) return {}
  const sf = project.addSourceFileAtPath(indexPath)

  // Build import var -> file path map
  const varToFile: Record<string, string> = {}
  sf.getImportDeclarations().forEach((imp) => {
    const moduleSpec = imp.getModuleSpecifierValue() // like './auth'
    const defaultImport = imp.getDefaultImport()
    if (defaultImport) {
      const varName = defaultImport.getText()
      const resolved = path.parse(moduleSpec).name // 'auth'
      varToFile[varName] = resolved
    }
  })

  const table: Record<string, string> = {}
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const call = node.asKind(SyntaxKind.CallExpression)!
      const expr = call.getExpression()
      const prop = expr.asKind(SyntaxKind.PropertyAccessExpression)
      if (!prop) return
      if (prop.getName() !== 'route') return
      const baseExpr = prop.getExpression().getText()
      if (baseExpr !== 'api') return
      const args = call.getArguments()
      if (args.length < 2) return
      const mountArg = args[0].asKind(SyntaxKind.StringLiteral)
      const routerId = args[1].asKind(SyntaxKind.Identifier)
      if (!mountArg || !routerId) return
      const mount = mountArg.getLiteralText()
      const varName = routerId.getText()
      const fileKey = varToFile[varName]
      if (fileKey) table[fileKey] = mount
    }
  })

  return table
}

// Load Zod schemas by simple name from src/types/*.ts
async function collectZodSchemas(): Promise<Record<string, z.ZodTypeAny>> {
  const map: Record<string, z.ZodTypeAny> = {}
  const files = fs.readdirSync(TYPES_DIR).filter(f => f.endsWith('.ts'))
  for (const f of files) {
    const full = path.join(TYPES_DIR, f)
    try {
      const mod = await import(pathToFileURL(full).toString())
      for (const [name, value] of Object.entries(mod)) {
        // Heuristic: a Zod schema has safeParse function and _def
        if (value && typeof value === 'object' && 'safeParse' in value && '_def' in value) {
          map[name] = value as z.ZodTypeAny
        }
      }
    } catch (e) {
      // Skip files that cannot be imported
    }
  }
  return map
}

// Parse routes using ts-morph
function collectRoutes() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  })
  const mountTable = readMountTableWithAst(project)

  const routeFilesAll = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts')
  // Only include files that are actually mounted in routes/index.ts
  const mountedKeys = new Set(Object.keys(mountTable))
  const routeFiles = routeFilesAll.filter(f => mountedKeys.has(path.parse(f).name))
  const results: Array<{
    file: string
    base: string
    method: string
    path: string
    validators: Array<{ type: 'json'|'query'|'param'|'form', schemaVar: string }>
    hasAuth: boolean
    summary?: string
    tags?: string[]
  }> = []

  for (const f of routeFiles) {
    const full = path.join(ROUTES_DIR, f)
    const sf = project.addSourceFileAtPath(full)
    const baseMount = (mountTable[path.parse(f).name] || '')

    // Collect router variable names instantiated from new Hono()
    const routerVars = new Set<string>()
    sf.getVariableDeclarations().forEach((vd) => {
      const init = vd.getInitializer()
      const ni = init?.asKind(SyntaxKind.NewExpression)
      if (!ni) return
      const expr = ni.getExpression().getText()
      if (expr === 'Hono') {
        const name = vd.getName()
        routerVars.add(name)
      }
    })

    sf.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const call = node.asKind(SyntaxKind.CallExpression)!
        const prop = call.getExpression().asKind(SyntaxKind.PropertyAccessExpression)
        if (!prop) return
        const methodName = prop.getName()
        if (!['get','post','put','delete','patch','options','head'].includes(methodName)) return
        const targetExpr = prop.getExpression().asKind(SyntaxKind.Identifier)
        if (!targetExpr) return
        const receiver = targetExpr.getText()
        if (!routerVars.has(receiver)) return // only accept routerVar.get(...)
        const method = methodName
        const args = call.getArguments()
        if (!args.length) return
        const firstArg = args[0]
        if (!firstArg || !firstArg.asKind) return
        const strLit = firstArg.asKind(SyntaxKind.StringLiteral)
        if (!strLit) return
        const subPath = strLit.getLiteralText()

        // Collect middlewares for validators and auth
        const validators: Array<{ type: 'json'|'query'|'param'|'form', schemaVar: string } > = []
        let hasAuth = false
        // Extract a single-line comment immediately above as summary (if present)
        const srcText = sf.getFullText()
        const fullStart = (call.compilerNode as any).getFullStart ? (call.compilerNode as any).getFullStart() : call.getStart()
        const ranges = ts.getLeadingCommentRanges(srcText, fullStart) || []
        let summary: string | undefined
        for (let i = ranges.length - 1; i >= 0; i--) {
          const r = ranges[i]
          const raw = srcText.slice(r.pos, r.end)
          if (raw.startsWith('//')) {
            summary = raw.replace(/^\/\/\s?/, '').trim()
            if (summary) break
          }
        }

        for (let i = 1; i < args.length; i++) {
          const a = args[i]
          const text = a.getText()
          if (/\bauthMiddleware\b/.test(text)) hasAuth = true
          // zValidator('json', schemaVar)
          const inner = a.asKind(SyntaxKind.CallExpression)
          if (inner) {
            const innerExpr = inner.getExpression().asKind(SyntaxKind.Identifier)
            if (innerExpr && innerExpr.getText() === 'zValidator') {
              const zArgs = inner.getArguments()
              if (zArgs.length >= 2) {
                const kind = zArgs[0].asKind(SyntaxKind.StringLiteral)?.getLiteralText()
                const schemaId = zArgs[1].asKind(SyntaxKind.Identifier)?.getText()
                if (kind && schemaId && ['json','query','param','form'].includes(kind)) {
                  validators.push({ type: kind as any, schemaVar: schemaId })
                }
              }
            }
          }
        }

        results.push({
          file: f,
          base: baseMount,
          method,
          path: subPath,
          validators,
          hasAuth,
          summary,
        })
      }
    })
  }

  return results
}

async function toOpenAPI() {
  const routes = collectRoutes()
  const zodSchemas = await collectZodSchemas()

  const doc: any = {
    openapi: '3.0.3',
    info: {
      title: 'Bun Hono Server API',
      version: '1.0.0',
      description: 'Generated locally via static analyzer',
    },
    servers: [ { url: 'http://localhost:3000' } ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths: {},
  }

  for (const r of routes) {
    // Build path: /api + base mount + sub path
    const joined = `${API_PREFIX}${r.base || ''}${r.path.startsWith('/') ? '' : '/'}${r.path}`
    const fullPath = honoPathToOpenAPI(joined).replace(/\/+/, '/')
    doc.paths[fullPath] = doc.paths[fullPath] || {}

    const operation: any = {
      summary: r.summary || `${r.method.toUpperCase()} ${fullPath}`,
      tags: [r.file.replace('.ts','')],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': { schema: wrapApiResponse({ type: 'object', additionalProperties: true }) },
          },
        },
      },
    }

    if (r.hasAuth) {
      operation.security = [ { bearerAuth: [] } ]
    }

    // Map validators to request sections
    for (const v of r.validators) {
  const schema = zodSchemas[v.schemaVar]
  const jsonSchema = schema ? zodToJsonSchema(schema, v.schemaVar) : undefined
      if (v.type === 'json') {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: (jsonSchema && (jsonSchema as any).definitions && (jsonSchema as any).definitions[v.schemaVar]) || jsonSchema || { type: 'object' },
            }
          }
        }
      } else if (v.type === 'query') {
        // Convert object schema to parameters
        const s: any = (jsonSchema && (jsonSchema as any).definitions && (jsonSchema as any).definitions[v.schemaVar]) || jsonSchema
        if (s?.type === 'object' && s.properties) {
          operation.parameters = operation.parameters || []
          for (const [key, prop] of Object.entries<any>(s.properties)) {
            operation.parameters.push({
              name: key,
              in: 'query',
              required: (s.required || []).includes(key),
              schema: prop,
            })
          }
        }
      } else if (v.type === 'param') {
        const s: any = (jsonSchema && (jsonSchema as any).definitions && (jsonSchema as any).definitions[v.schemaVar]) || jsonSchema
        if (s?.type === 'object' && s.properties) {
          operation.parameters = operation.parameters || []
          for (const [key, prop] of Object.entries<any>(s.properties)) {
            operation.parameters.push({
              name: key,
              in: 'path',
              required: true,
              schema: prop,
            })
          }
        }
      } else if (v.type === 'form') {
        const s: any = (jsonSchema && (jsonSchema as any).definitions && (jsonSchema as any).definitions[v.schemaVar]) || jsonSchema
        operation.requestBody = {
          required: false,
          content: {
            'application/x-www-form-urlencoded': { schema: s || { type: 'object' } },
            'multipart/form-data': { schema: s || { type: 'object' } },
          }
        }
      }
    }

    doc.paths[fullPath][r.method] = operation
  }

  return doc
}

async function main() {
  const generate = async () => {
    const doc = await toOpenAPI()
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
    fs.writeFileSync(OUTPUT, JSON.stringify(doc, null, 2), 'utf8')
    console.log(`OpenAPI spec generated: ${OUTPUT} @ ${new Date().toISOString()}`)
  }

  const watch = process.argv.includes('--watch')
  if (!watch) {
    await generate()
    return
  }

  // Watch mode
  let timer: any
  const trigger = () => {
    clearTimeout(timer)
    timer = setTimeout(() => generate().catch(console.error), 150)
  }
  await generate()
  const watchDirs = [ROUTES_DIR, TYPES_DIR]
  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) continue
    fs.watch(dir, { recursive: true }, trigger)
  }
  console.log('Watching for changes in src/routes and src/types ...')
  // Keep process alive
  await new Promise(() => {})
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
