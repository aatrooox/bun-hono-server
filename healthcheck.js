// Docker 容器健康检查脚本
const healthCheck = async () => {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const response = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
      headers: {
        'User-Agent': 'Docker-HealthCheck/1.0'
      },
      signal: controller.signal
    })

  clearTimeout(timer)
  if (response.ok) {
      const data = await response.json()
      if (data.code === 200 && data.data?.status === 'healthy') {
        console.log('Health check passed')
        process.exit(0)
      } else {
        console.error('Health check failed: service degraded')
        process.exit(1)
      }
    } else {
      console.error(`Health check failed: HTTP ${response.status}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('Health check failed:', error.message)
    process.exit(1)
  }
}

healthCheck()