import { ApiError } from '../utils/http.js'
import { isProd } from '../config/env.js'

/** 404 处理 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
    data: null,
    error: { code: 'NOT_FOUND', message: 'NOT_FOUND' }
  })
}

/** 全局错误处理：所有异常统一转为 JSON 结构 */
export const errorHandler = (error, _req, res, _next) => {
  const status = error.status || 500
  const message = error.message || '服务器内部错误'
  if (status >= 500) console.error('[error]', error)
  res.status(status).json({
    success: false,
    message,
    data: null,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message,
      ...(isProd ? {} : { stack: error.stack })
    }
  })
}