import mongoose from 'mongoose'
import { asyncHandler } from '../utils/http.js'
import { env } from '../config/env.js'
import { getDriver, isMongoReady } from '../utils/store.js'

/**
 * 健康检查
 * /api/health       存活探针：进程能响应即返回 200，用于容器重启判定
 * /api/health/ready 就绪探针：校验数据源与关键依赖是否可用，用于流量接入判定
 */

const storageProbe = async () => {
  if (getDriver() !== 'mongo') {
    return {
      name: 'storage',
      status: env.allowFileStorage || env.nodeEnv !== 'production' ? 'up' : 'degraded',
      detail: 'local-file'
    }
  }
  if (!isMongoReady() || mongoose.connection.readyState !== 1) {
    return { name: 'storage', status: 'down', detail: 'mongo-disconnected' }
  }
  try {
    await mongoose.connection.db.admin().command({ ping: 1 })
    return { name: 'storage', status: 'up', detail: 'mongo' }
  } catch (error) {
    return { name: 'storage', status: 'down', detail: error.message }
  }
}

export const healthController = {
  live: (_req, res) =>
    res.json({
      success: true,
      message: 'CampusPilot API is running',
      data: { status: 'live', uptimeSeconds: Math.round(process.uptime()), time: new Date().toISOString() }
    }),

  ready: asyncHandler(async (_req, res) => {
    const checks = [
      await storageProbe(),
      {
        name: 'ai',
        // 就绪探针不做外部网络调用，只反映当前生效的运行模式
        status: 'up',
        detail: env.ai.apiKey ? `remote:${env.ai.provider}/${env.ai.model}` : 'rule-engine'
      }
    ]

    const ready = checks.every((check) => check.status !== 'down')
    res.status(ready ? 200 : 503).json({
      success: ready,
      message: ready ? '服务已就绪' : '服务尚未就绪',
      data: {
        status: ready ? 'ready' : 'not-ready',
        driver: getDriver(),
        nodeEnv: env.nodeEnv,
        version: process.env.npm_package_version || '1.0.0',
        uptimeSeconds: Math.round(process.uptime()),
        time: new Date().toISOString(),
        checks
      },
      error: ready ? null : { code: 'NOT_READY', message: '依赖检查未通过' }
    })
  })
}