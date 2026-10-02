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

/** 转义正则元字符：用户输入的关键词会直接拼进正则，不转义可被构造为 ReDoS */
export const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 解析分页参数
 * 统一入口避免各列表接口各写一套边界处理，同时给 pageSize 封顶防止一次拉全表。
 */
export const resolvePagination = (query = {}, defaultSize = 20) => {
  const pageSize = Math.min(Math.max(Number(query.pageSize) || Number(query.limit) || defaultSize, 1), 100)
  const page = Math.max(Number(query.page) || 1, 1)
  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize, total: 0 }
}

/** 生成分页元信息，与列表数据一起返回 */
export const pageMeta = (total, { page, pageSize }) => ({
  total,
  page,
  pageSize,
  hasMore: page * pageSize < total
})