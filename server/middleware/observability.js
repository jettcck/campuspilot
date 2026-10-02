import crypto from 'node:crypto'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { env } from '../config/env.js'

/**
 * 结构化日志
 * 生产环境输出单行 JSON，便于被日志采集系统（Render / ELK / Loki）直接消费；
 * 敏感字段在序列化阶段移除，杜绝密码与令牌进入日志。
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: 'campuspilot', env: env.nodeEnv },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'newPassword',
      'oldPassword',
      'passwordHash'
    ],
    remove: true
  }
})

/** 为每个请求分配追踪 ID，并通过响应头回传，便于串联前后端问题定位 */
export const requestContext = (req, res, next) => {
  const incoming = req.headers['x-request-id']
  req.id = typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64 ? incoming : crypto.randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: {
    // 健康检查由探针高频调用，不写入访问日志以免淹没业务日志
    ignore: (req) => req.url === '/api/health' || req.url === '/api/health/ready'
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: pino.stdSerializers.err
  }
})