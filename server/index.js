import app from './app.js'
import { env } from './config/env.js'
import { connectDatabase, getDriver } from './utils/store.js'
import { seedDemoData } from './services/seedService.js'

// 启动流程：连接数据源 -> 初始化演示数据 -> 启动 HTTP 服务
const driver = await connectDatabase()

try {
  await seedDemoData()
} catch (error) {
  console.warn('[seed] 演示数据初始化失败：', error.message)
}

app.listen(env.port, () => {
  console.log('')
  console.log('  CampusPilot 服务已启动')
  console.log(`  接口地址：http://localhost:${env.port}/api`)
  console.log(`  数据来源：${getDriver() === 'mongo' ? 'MongoDB' : '本地文件（server/data/db.json）'}`)
  console.log(`  AI 模式：${env.ai.apiKey ? `已接入 ${env.ai.model}` : '本地规则引擎（未配置 AI_API_KEY）'}`)
  console.log('')
})