import app from './app.js'
import { assertRuntimeConfig, env } from './config/env.js'
import { closeDatabase, connectDatabase, getDriver } from './utils/store.js'
import { seedBootstrapData } from './services/seedService.js'
import { logger } from './middleware/observability.js'

let server = null

/** 启动流程：校验配置 -> 连接数据源 -> 初始化基础数据 -> 启动 HTTP 服务 */
async function bootstrap() {
  assertRuntimeConfig()
  await connectDatabase()

  try {
    const result = await seedBootstrapData()
    logger.info({ seed: result }, '基础数据初始化完成')
  } catch (error) {
    logger.warn({ err: error }, '基础数据初始化失败，不影响服务启动')
  }

  server = app.listen(env.port, () => {
    logger.info(
      {
        port: env.port,
        nodeEnv: env.nodeEnv,
        driver: getDriver(),
        ai: env.ai.apiKey ? `${env.ai.provider}/${env.ai.model}` : 'rule-engine',
        rateLimit: env.rateLimit
      },
      `CampusPilot 服务已启动：http://localhost:${env.port}`
    )
  })
}

/** 优雅关闭：先停止接收新请求，再释放数据库连接，超时则强制退出 */
async function shutdown(signal) {
  logger.info({ signal }, '收到退出信号，开始优雅关闭')
  const forceExit = setTimeout(() => {
    logger.error('优雅关闭超时，强制退出')
    process.exit(1)
  }, 10000)
  forceExit.unref()

  try {
    if (server) await new Promise((resolve) => server.close(resolve))
    await closeDatabase()
    logger.info('已安全退出')
    process.exit(0)
  } catch (error) {
    logger.error({ err: error }, '关闭过程出现异常')
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// 未捕获异常意味着进程状态已不可信，记录后退出由平台拉起重启
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, '未捕获异常，进程即将退出')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '未处理的 Promise 拒绝')
  if (env.nodeEnv === 'production') process.exit(1)
})

bootstrap().catch((error) => {
  console.error(`启动失败：${error.message}`)
  process.exit(1)
})