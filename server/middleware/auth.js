import { ApiError } from '../utils/http.js'
import { verifyToken } from '../utils/security.js'
import { collection } from '../utils/store.js'
import { serialize } from '../utils/serialize.js'

/** 必须登录：校验 Authorization: Bearer <token> */
export const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new ApiError(401, '请先登录后再操作', 'UNAUTHORIZED')

    const payload = verifyToken(token)
    const user = await collection('users').findById(payload.userId)
    if (!user) throw new ApiError(401, '用户不存在或已被删除', 'UNAUTHORIZED')

    req.user = serialize(user)
    next()
  } catch (error) {
    if (error instanceof ApiError) return next(error)
    next(new ApiError(401, '登录状态已失效，请重新登录', 'TOKEN_INVALID'))
  }
}

/** 可选登录：用于公开接口根据登录状态返回更丰富的数据 */
export const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || ''
    if (!header.startsWith('Bearer ')) return next()
    const payload = verifyToken(header.slice(7))
    const user = await collection('users').findById(payload.userId)
    if (user) req.user = serialize(user)
  } catch {
    // 忽略无效 token，按未登录处理
  }
  next()
}

/** 角色校验 */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, '请先登录后再操作', 'UNAUTHORIZED'))
  if (!roles.includes(req.user.role)) return next(new ApiError(403, '没有权限执行该操作', 'FORBIDDEN'))
  next()
}