/**
 * 文档序列化：把数据库文档统一转换成前端友好的结构
 * - _id -> id
 * - 隐藏 passwordHash 等敏感字段
 */
export function serialize(doc) {
  if (!doc) return null
  if (Array.isArray(doc)) return doc.map(serialize)
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc
  const { _id, __v, passwordHash, ...rest } = raw
  return { id: String(_id), ...rest }
}