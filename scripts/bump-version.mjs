#!/usr/bin/env bun
/**
 * 版本号升级脚本
 * 用法示例:
 *   node scripts/bump-version.mjs patch
 *   node scripts/bump-version.mjs minor --tag
 *   node scripts/bump-version.mjs prerelease --preid beta --tag
 *   node scripts/bump-version.mjs 1.5.0        # 直接设定具体版本
 * 选项:
 *   --no-git        只改 package.json, 不提交
 *   --tag           创建 git tag vX.Y.Z 并提交 (默认也会 git commit)
 *   --preid <id>    prerelease 时使用的标识 (beta, rc, next ...)
 *   --dry           只显示将要做的事情，不落盘
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const pkgPath = path.join(root, 'package.json')
if (!fs.existsSync(pkgPath)) {
  console.error('package.json 不存在')
  process.exit(1)
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('请提供要升级的类型: patch|minor|major|prerelease 或 直接指定版本号')
    process.exit(1)
  }
  const opts = { type: args[0], noGit: false, makeTag: false, preid: 'beta', dry: false }
  for (let i = 1; i < args.length; i++) {
    const a = args[i]
    if (a === '--no-git') opts.noGit = true
    else if (a === '--tag') opts.makeTag = true
    else if (a === '--dry') opts.dry = true
    else if (a === '--preid' && args[i + 1]) { opts.preid = args[i + 1]; i++ }
  }
  return opts
}

function incVersion(current, type, preid) {
  // 支持直接指定合法 semver
  if (/^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/.test(type)) return type
  const [major, minor, patchWithPre] = current.split('.')
  let patch = patchWithPre
  if (patch.includes('-')) patch = patch.split('-')[0]
  let M = parseInt(major, 10), m = parseInt(minor, 10), p = parseInt(patch, 10)
  switch (type) {
    case 'patch': p++; break
    case 'minor': m++; p = 0; break
    case 'major': M++; m = 0; p = 0; break
    case 'prerelease':
      // 如果当前已经是预发布并且 preid 相同则递增编号，否则从 0 开始
      const prereleaseRegex = new RegExp(`^${M}\\.${m}\\.${p}-(${preid})\\.(\\d+)$`)
      if (prereleaseRegex.test(current)) {
        const num = parseInt(current.match(prereleaseRegex)[2], 10) + 1
        return `${M}.${m}.${p}-${preid}.${num}`
      } else {
        return `${M}.${m}.${p}-${preid}.0`
      }
    default:
      throw new Error('不支持的版本类型: ' + type)
  }
  return `${M}.${m}.${p}`
}

async function run() {
  const { type, noGit, makeTag, preid, dry } = parseArgs()
  const oldVersion = pkg.version
  const newVersion = incVersion(oldVersion, type, preid)
  if (oldVersion === newVersion) {
    console.log('[bump-version] 版本未变化, 跳过')
    return
  }
  console.log(`[bump-version] ${oldVersion} -> ${newVersion}`)

  if (dry) {
    console.log('[bump-version] dry run: 只显示不修改')
    return
  }
  pkg.version = newVersion
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log('[bump-version] package.json 已更新')

  if (!noGit) {
    const { execSync } = await import('child_process')
    try {
      execSync(`git add package.json`, { stdio: 'inherit' })
      execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' })
      console.log('[bump-version] git commit 完成')
      if (makeTag) {
        execSync(`git tag v${newVersion}`, { stdio: 'inherit' })
        execSync(`git push --follow-tags`, { stdio: 'inherit' })
        console.log('[bump-version] 已创建并推送 tag v' + newVersion)
      } else {
        execSync(`git push`, { stdio: 'inherit' })
      }
    } catch (e) {
      console.error('[bump-version] git 操作失败: ' + e.message)
    }
  }

  console.log('[bump-version] 完成')
}

run().catch(e => {
  console.error('[bump-version] error:', e.message)
  process.exit(1)
})
