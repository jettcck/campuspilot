import { isProd } from '../config/env.js'
import { logger } from './observability.js'

/** 404 处理 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
    data: null,
    error: { code: 'NOT_FOUND', message: 'NOT_FOUND', requestId: req.id }
  })
}

/**
 * 把第三方库抛出的异常翻译成稳定的业务语义，
 * 避免唯一约束冲突、文件体积超限这类可预期错误以 500 形式暴露。
 */
const normalizeError = (error) => {
  if (error && error.code === 11000) {
    return { status: 409, code: 'DUPLICATE_KEY', message: '数据已存在，请检查后重试' }
  }
  if (error && error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? '文件体积超出限制' : '文件上传失败'
    return { status: 400, code: error.code || 'UPLOAD_FAILED', message }
  }
  if (error && error.name === 'ValidationError') {
    return { status: 400, code: 'VALIDATION_FAILED', message: error.message }
  }
  if (error && error.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' }
  }
  return null
}

/** 全局错误处理：所有异常统一转为 JSON 结构，并在日志中保留追踪 ID */
export const errorHandler = (error, req, res, _next) => {
  const normalized = normalizeError(error)
  const status = normalized ? normalized.status : error.status || 500
  const code = normalized ? normalized.code : error.code || 'INTERNAL_ERROR'
  const rawMessage = normalized ? normalized.message : error.message || '服务器内部错误'
  // 5xx 不向调用方泄露内部细节，排查依据留在服务端日志中
  const message = status >= 500 && isProd ? '服务器内部错误，请稍后重试' : rawMessage

  if (status >= 500) {
    logger.error({ err: error, requestId: req.id, status, code }, '请求处理失败')
  } else {
    logger.warn({ requestId: req.id, status, code, message }, '请求被拒绝')
  }

  res.status(status).json({
    success: false,
    message,
    data: null,
    error: {
      code,
      message,
      requestId: req.id,
      ...(isProd ? {} : { stack: error.stack })
    }
  })
}