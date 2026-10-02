import { ApiError } from '../utils/http.js'

/**
 * 请求入参校验中间件
 * 校验通过后把「解析并裁剪过的数据」写回请求对象，未声明的字段会被丢弃，
 * 从而在入口处一次性解决类型错误与批量赋值（mass assignment）风险。
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source])
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue.path.join('.')
    return next(new ApiError(400, path ? `${path}：${issue.message}` : issue.message, 'VALIDATION_FAILED'))
  }

  if (source === 'query') {
    // Express 把 query 定义在原型上的只读 getter，需用 defineProperty 覆盖为已校验的数据
    Object.defineProperty(req, 'query', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true
    })
  } else {
    req[source] = result.data
  }
  next()
}