import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { comparePassword, hashPassword, signToken } from '../utils/security.js'
import { serialize } from '../utils/serialize.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const authController = {
  /** 注册：邮箱唯一，密码使用 bcrypt 加密存储 */
  register: asyncHandler(async (req, res) => {
    const { username, email, password, school, major, grade } = req.body
    if (!username || !email || !password) throw new ApiError(400, '用户名、邮箱和密码为必填项', 'PARAM_MISSING')
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, '邮箱格式不正确', 'EMAIL_INVALID')
    if (String(password).length < 8) throw new ApiError(400, '密码长度至少 8 位', 'PASSWORD_WEAK')

    const users = collection('users')
    const exists = await users.findOne({ email: String(email).toLowerCase() })
    if (exists) throw new ApiError(409, '该邮箱已注册', 'EMAIL_EXISTS')

    const user = await users.insert({
      username,
      email: String(email).toLowerCase(),
      passwordHash: await hashPassword(String(password)),
      avatar: String(username).slice(0, 1),
      school: school || '',
      major: major || '',
      grade: grade || '',
      role: 'student'
    })

    ok(res, { token: signToken(user), user: serialize(user) }, '注册成功', 201)
  }),

  /** 登录：校验密码后签发 JWT */
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) throw new ApiError(400, '请输入邮箱和密码', 'PARAM_MISSING')

    const user = await collection('users').findOne({ email: String(email).toLowerCase() })
    if (!user) throw new ApiError(401, '邮箱或密码错误', 'CREDENTIALS_INVALID')

    const matched = await comparePassword(String(password), user.passwordHash)
    if (!matched) throw new ApiError(401, '邮箱或密码错误', 'CREDENTIALS_INVALID')

    ok(res, { token: signToken(user), user: serialize(user) }, '登录成功')
  }),

  /** 当前用户信息 */
  me: asyncHandler(async (req, res) => ok(res, { user: req.user })),

  /** 修改资料 */
  updateProfile: asyncHandler(async (req, res) => {
    const { username, school, major, grade, avatar } = req.body
    const patch = {}
    if (username) patch.username = username
    if (school !== undefined) patch.school = school
    if (major !== undefined) patch.major = major
    if (grade !== undefined) patch.grade = grade
    if (avatar !== undefined) patch.avatar = avatar

    const updated = await collection('users').updateById(req.user.id, patch)
    ok(res, { user: serialize(updated) }, '资料已更新')
  }),

  /** 修改密码 */
  updatePassword: asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) throw new ApiError(400, '请填写原密码和新密码', 'PARAM_MISSING')
    if (String(newPassword).length < 8) throw new ApiError(400, '新密码长度至少 8 位', 'PASSWORD_WEAK')

    const user = await collection('users').findById(req.user.id)
    const matched = await comparePassword(String(oldPassword), user.passwordHash)
    if (!matched) throw new ApiError(400, '原密码不正确', 'OLD_PASSWORD_INVALID')

    await collection('users').updateById(req.user.id, { passwordHash: await hashPassword(String(newPassword)) })
    ok(res, null, '密码修改成功，请重新登录')
  })
}