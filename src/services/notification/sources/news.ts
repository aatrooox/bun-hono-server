/**
 * 示例数据源：新闻头条
 */

import { registerDataSource } from '../dataSources'

export async function fetchNewsHeadlines() {
  // TODO: 实际项目中调用新闻 API
  // 示例：const response = await fetch('https://newsapi.org/v2/top-headlines?country=cn&apiKey=xxx')
  // 示例：return response.json()
  
  // 模拟数据
  return {
    source: 'news',
    updateTime: new Date().toISOString(),
    data: [
      { title: '新闻标题1', summary: '摘要1', url: 'https://news.com/1', publishTime: new Date().toISOString() },
      { title: '新闻标题2', summary: '摘要2', url: 'https://news.com/2', publishTime: new Date().toISOString() },
      { title: '新闻标题3', summary: '摘要3', url: 'https://news.com/3', publishTime: new Date().toISOString() }
    ]
  }
}

// 注册数据源
registerDataSource('fetchNewsHeadlines', fetchNewsHeadlines)
