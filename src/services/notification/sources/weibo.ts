/**
 * 示例数据源：微博热搜
 */

import { registerDataSource } from '../dataSources'

export async function fetchWeiboHotSearch() {
  // TODO: 实际项目中这里应该调用你的爬虫 API 或第三方接口
  // 示例：const response = await fetch('http://localhost:3001/api/weibo/hot')
  // 示例：return response.json()
  
  // 模拟数据
  return {
    source: 'weibo',
    updateTime: new Date().toISOString(),
    data: [
      { rank: 1, title: '热搜标题1', hotValue: 1234567, url: 'https://weibo.com/1' },
      { rank: 2, title: '热搜标题2', hotValue: 987654, url: 'https://weibo.com/2' },
      { rank: 3, title: '热搜标题3', hotValue: 654321, url: 'https://weibo.com/3' }
    ]
  }
}

// 注册数据源
registerDataSource('fetchWeiboHotSearch', fetchWeiboHotSearch)
