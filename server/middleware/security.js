import helmet from 'helmet'
import compression from 'compression'
import { rateLimit } from 'express-rate-limit'
import { ApiError } from '../utils/http.js'
import { env, isProd } from '../config/env.js'

/* ------------------------------ 安全响应头 ------------------------------ */

/**
 * CSP 与仓库内的实际资源来源保持一致：
 * 字体来自 Google Fonts，样式由 Vite 打包为静态文件，连接仅限同源。
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  // 上传的课件需要被同源页面内联展示，关闭跨源嵌入隔离
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProd ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false
})

/* ------------------------------ 强制 HTTPS ------------------------------ */

/** 探针路径不参与跳转：反向代理与容器编排的健康检查走明文 HTTP，重定向会被判定为异常 */
const HTTPS_EXEMPT_PATHS = new Set(['/api/health', '/api/health/ready'])

/**
 * 只认反向代理注入的 X-Forwarded-Proto：
 * - 代理声明原始协议为 https（或未声明）时放行，不做二次跳转，避免重定向死循环
 * - 仅当代理明确声明原始协议为 http 时才跳转，因此本地直连与 CI 的明文请求不受影响
 */
export const enforceHttps = (req, res, next) => {
  if (!isProd || !env.enforceHttps) return next()
  if (HTTPS_EXEMPT_PATHS.has(req.path)) return next()

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  if (forwardedProto !== 'http') return next()

  const host = req.headers.host
  if (!host) return next()

  return res.redirect(301, `https://${host}${req.originalUrl}`)
}

/* -------------------------------- 跨域策略 -------------------------------- */

const isSameOrigin = (origin, host) => {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * 生产环境只放行「显式配置的来源」与「自身域名」（同源部署时浏览器会带上 Origin），
 * 开发环境放行全部来源以便本地联调与内网穿透调试。
 */
export const corsPolicy = (req, res, next) => {
  // 无论本次请求是否携带 Origin 都要声明 Vary：
  // 若只在携带 Origin 时才声明，同一个 URL 就会因请求头不同而产生两种 Vary 值，
  // 共享缓存可能把「无 Origin」的那份响应（不含 ACAO）命中给跨域请求，导致 CORS 失败。
  // 这里用 setHeader，后续 compression 会以追加方式补上 Accept-Encoding，二者不会互相覆盖。
  res.setHeader('Vary', 'Origin')

  const origin = req.headers.origin
  if (!origin) return next()

  const allowed = !isProd || env.corsOrigins.includes(origin) || isSameOrigin(origin, req.headers.host)
  if (!allowed) return next(new ApiError(403, '该来源未被允许访问', 'CORS_FORBIDDEN'))

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  return next()
}

/* --------------------------------- 压缩 ---------------------------------- */

export const compressionMiddleware = compression({ threshold: 1024 })

/* -------------------------------- 限流策略 -------------------------------- */

const rateLimitedResponse = (_req, res) => {
  res.status(429).json({
    success: false,
    message: '操作过于频繁，请稍后再试',
    data: null,
    error: { code: 'RATE_LIMITED', message: 'RATE_LIMITED' }
  })
}

const createLimiter = (limit, options = {}) =>
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitedResponse,
    ...options
  })

/** 全局接口限流：兜底防止单一来源打满服务（探针请求不计入） */
export const apiLimiter = createLimiter(env.rateLimit.apiMax, {
  skip: (req) => req.path === '/health' || req.path === '/health/ready'
})

/** 认证接口限流：只统计失败请求，正常登录不会被误伤，暴力破解会被快速阻断 */
export const authLimiter = createLimiter(env.rateLimit.authMax, { skipSuccessfulRequests: true })

/** AI 接口限流：大模型调用有真实成本，单独收紧配额 */
export const aiLimiter = createLimiter(env.rateLimit.aiMax)