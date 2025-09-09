#!/usr/bin/env bun
/**
 * 构建并发布 Docker 镜像脚本
 * 使用 package.json 的 version 作为镜像标签，同时推 latest
 * 可选：传入额外标签  scripts: `bun run publish:docker --tag beta`
 * 必须设置环境变量：
 *   DOCKERHUB_USER
 *   DOCKERHUB_TOKEN (或 PAT)
 * 可选：IMAGE_NAME (默认与 package.json name 相同)
 */

import { $ } from 'bun'
import { readFileSync } from 'fs'
import path from 'path'

interface PackageJson { name: string; version: string }

function log(step: string, msg: string, extra?: any) {
  console.log(`[publish-docker] ${step}: ${msg}` + (extra ? ` ${JSON.stringify(extra)}` : ''))
}

async function ensureDockerDaemon() {
  try {
    // 快速探测 server 版本 (只要能返回说明 daemon 正常)
    const out = await $`docker version --format {{.Server.Version}}`.quiet()
    if (!String(out.stdout || '').trim()) {
      throw new Error('无法获取 Docker Server 版本')
    }
    return
  } catch (e: any) {
    const dockerHost = process.env.DOCKER_HOST
    console.error('[publish-docker] error: 无法连接 Docker 守护进程\n')
    console.error('可能原因:')
    console.error('  1. Docker Desktop 未启动 (macOS 常见)')
    console.error('  2. 使用 colima / rancher desktop 但未启动: 运行 `colima start`')
    console.error('  3. DOCKER_HOST 配置错误 -> 当前值:', dockerHost || '(未设置)')
    console.error('  4. 没有权限访问 docker.sock (rootless / 权限问题)')
    console.error('\n排查步骤:')
    console.error('  A. 启动 Docker Desktop: open -a Docker')
    console.error('  B. 或启动 colima: colima start')
    console.error('  C. 测试: docker info | head -n5')
    console.error('  D. 若 DOCKER_HOST 指向自定义路径，尝试 unset DOCKER_HOST 再运行')
    console.error('\n原始错误:', e.message)
    throw new Error('Docker 守护进程不可用，已中止发布')
  }
}

async function main() {
  const root = process.cwd()
  const pkgPath = path.join(root, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson
  const version = pkg.version
  if (!version) {
    throw new Error('package.json 缺少 version')
  }

  const user = 'gnakdogg'
  // const token = process.env.DOCKERHUB_TOKEN
  // if (!user || !token) {
  //   throw new Error('缺少 DOCKERHUB_USER / DOCKERHUB_TOKEN 环境变量')
  // }

  const imageBase = process.env.IMAGE_NAME || pkg.name
  if (!imageBase) throw new Error('无法确定镜像名称 (package.json name 或 IMAGE_NAME)')

  // 处理额外自定义标签
  const extraTags: string[] = []
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tag' && argv[i + 1]) {
      extraTags.push(argv[i + 1])
      i++
    }
  }

  const registryImageVersion = `${user}/${imageBase}:${version}`
  const registryImageLatest = `${user}/${imageBase}:latest`
  const extraTagImages = extraTags.map(t => `${user}/${imageBase}:${t}`)

  // 先校验 Docker daemon 是否可用
  await ensureDockerDaemon()

  // log('info', '开始登录 Docker Hub')
  // await $`docker login -u ${user} -p ${token}`

  const buildPlatform = process.env.DOCKER_BUILD_PLATFORM || 'linux/amd64'
  log('build', '构建镜像', { image: registryImageVersion, platform: buildPlatform })
  await $`docker build --platform=${buildPlatform} -t ${registryImageVersion} -t ${registryImageLatest} .`

  for (const tag of extraTagImages) {
    log('tag', '添加额外标签', { tag })
    await $`docker tag ${registryImageVersion} ${tag}`
  }

  log('push', '推送版本标签', { image: registryImageVersion })
  await $`docker push ${registryImageVersion}`
  log('push', '推送 latest', { image: registryImageLatest })
  await $`docker push ${registryImageLatest}`

  for (const tag of extraTagImages) {
    log('push', '推送额外标签', { tag })
    await $`docker push ${tag}`
  }

  log('done', '发布完成', { version, extraTags })
}

main().catch(err => {
  console.error('[publish-docker] error:', err.message)
  process.exit(1)
})
