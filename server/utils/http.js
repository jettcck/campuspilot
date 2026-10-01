// 统一响应格式与错误处理工具

/**
 * 业务异常：抛出后由全局错误中间件统一转成 JSON 响应
 */
export class ApiError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

/** 包裹异步控制器，自动把异常交给错误中间件 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

/** 成功响应 */
export const ok = (res, data = null, message = '操作成功', status = 200) =>
  res.status(status).json({ success: true, message, data, error: null })

/** 失败响应 */
export const fail = (res, message = '请求失败', status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, message, data: null, error: { code, message } })