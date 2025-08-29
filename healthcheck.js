// Docker 容器健康检查脚本
const healthCheck = async () => {
  try {
    const response = await fetch('http://localhost:4778/api/health', {
      method: 'GET',
      headers: {
        'User-Agent': 'Docker-HealthCheck/1.0'
      },
      timeout: 3000
    })

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