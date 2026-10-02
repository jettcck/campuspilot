/**
 * 冒烟测试（自包含，不依赖外部数据库）
 * 使用本地文件存储驱动 + 临时数据目录启动真实应用，覆盖产品关键路径：
 * 注册鉴权、输入校验、越权防护、引导流程、分页、限流、健康检查。
 * 运行：npm run smoke
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campuspilot-smoke-'))

// 必须在加载应用之前固定运行环境，避免读取到本机 .env 中的真实数据库配置
process.env.NODE_ENV = 'development'
process.env.MONGODB_URI = ''
process.env.DATA_DIR = tmpDir
process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads')
process.env.JWT_SECRET = 'smoke-test-secret-smoke-test-secret'
process.env.LOG_LEVEL = 'error'

const { default: app } = await import('../server/app.js')
const { connectDatabase, closeDatabase } = await import('../server/utils/store.js')
const { seedBootstrapData } = await import('../server/services/seedService.js')

const EMAIL = `smoke-${Date.now()}@campuspilot.test`
const PASSWORD = 'SmokePass123'

let pass = 0
let fail = 0
const lines = []

const check = (name, condition, extra = '') => {
  if (condition) {
    pass += 1
    lines.push(`PASS  ${name}${extra ? `  ${extra}` : ''}`)
  } else {
    fail += 1
    lines.push(`FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

await connectDatabase()
// 与真实启动流程一致：初始化公共校园公告
await seedBootstrapData()

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance))
})
const BASE = `http://127.0.0.1:${server.address().port}/api`

const api = async (routePath, { method = 'GET', body, token } = {}) => {
  const response = await fetch(`${BASE}${routePath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, json, headers: response.headers }
}

try {
  /* ------------------------------ 健康检查 ------------------------------ */
  const live = await api('/health')
  check('存活探针返回 200', live.status === 200, `status=${live.status}`)

  const ready = await api('/health/ready')
  check('就绪探针返回 200', ready.status === 200, `status=${ready.status}`)
  check('就绪探针报告数据源', ready.json?.data?.checks?.[0]?.status === 'up', ready.json?.data?.checks?.[0]?.detail)
  check('响应头带 requestId', Boolean(live.headers.get('x-request-id')))
  check('安全响应头已启用', Boolean(live.headers.get('content-security-policy') && live.headers.get('x-content-type-options')))

  /* ------------------------------ 输入校验 ------------------------------ */
  const weak = await api('/auth/register', { method: 'POST', body: { username: '弱密码', email: `weak-${Date.now()}@campuspilot.test`, password: '123' } })
  check('弱密码被拒绝', weak.status === 400 && weak.json?.error?.code === 'VALIDATION_FAILED', `status=${weak.status}`)

  const badEmail = await api('/auth/register', { method: 'POST', body: { username: '坏邮箱', email: 'not-an-email', password: PASSWORD } })
  check('非法邮箱被拒绝', badEmail.status === 400, `status=${badEmail.status}`)

  /* ------------------------------ 注册与鉴权 ---------------------------- */
  const reg = await api('/auth/register', {
    method: 'POST',
    body: { username: '冒烟用户', email: EMAIL, password: PASSWORD, role: 'admin' }
  })
  check('注册成功', reg.status === 201, `status=${reg.status}`)
  check('未声明字段被丢弃（无法提权）', reg.json?.data?.user?.role === 'student', `role=${reg.json?.data?.user?.role}`)
  check('响应中不含密码哈希', !JSON.stringify(reg.json).includes('passwordHash'))

  const token = reg.json?.data?.token
  const userId = reg.json?.data?.user?.id
  check('注册即签发 Token', Boolean(token))

  const noToken = await api('/tasks')
  check('未登录访问被拒', noToken.status === 401, `status=${noToken.status}`)

  const duplicated = await api('/auth/register', { method: 'POST', body: { username: '重复', email: EMAIL, password: PASSWORD } })
  check('邮箱唯一约束生效', duplicated.status === 409, `status=${duplicated.status}`)

  /* ------------------------------ 新用户引导 ---------------------------- */
  const emptyStatus = await api('/onboarding/status', { token })
  check('新账号为空工作台', emptyStatus.json?.data?.isEmpty === true)

  const seeded = await api('/onboarding/sample-data', { method: 'POST', token })
  check('示例数据导入成功', seeded.status === 201 && seeded.json?.data?.counts?.courses === 3, `status=${seeded.status}`)

  const seededAgain = await api('/onboarding/sample-data', { method: 'POST', token })
  check('重复导入被拒绝', seededAgain.status === 409, `status=${seededAgain.status}`)

  /* ------------------------------- 业务链路 ----------------------------- */
  const course = await api('/courses', { method: 'POST', token, body: { name: '冒烟课程' } })
  check('创建课程成功', course.status === 201, `status=${course.status}`)
  const courseId = course.json?.data?.course?.id

  const task = await api('/tasks', { method: 'POST', token, body: { title: '冒烟任务', courseId, estimatedMinutes: 45 } })
  check('创建任务成功', task.status === 201, `status=${task.status}`)
  const taskId = task.json?.data?.task?.id

  const noTitle = await api('/tasks', { method: 'POST', token, body: {} })
  check('缺标题的任务被拒绝', noTitle.status === 400, `status=${noTitle.status}`)

  const badStatus = await api(`/tasks/${taskId}/status`, { method: 'PATCH', token, body: { status: 'done' } })
  check('状态更新拒绝非布尔值', badStatus.status === 400, `status=${badStatus.status}`)

  const doneStatus = await api(`/tasks/${taskId}/status`, { method: 'PATCH', token, body: { done: true } })
  check('布尔值状态更新成功', doneStatus.status === 200 && doneStatus.json?.data?.task?.done === true)

  const stats = await api('/stats/overview', { token })
  check('统计接口可用', stats.status === 200 && stats.json?.data?.stats?.totalCount >= 4, `total=${stats.json?.data?.stats?.totalCount}`)

  /* ------------------------------- 分页行为 ----------------------------- */
  const page = await api('/tasks?page=1&pageSize=2', { token })
  check('分页首页返回 2 条', page.json?.data?.tasks?.length === 2, `len=${page.json?.data?.tasks?.length}`)
  check('分页返回全量 total', page.json?.data?.total >= 4, `total=${page.json?.data?.total}`)
  check('分页 hasMore 标记正确', page.json?.data?.hasMore === true)

  const oversize = await api('/tasks?pageSize=9999', { token })
  check('pageSize 超限被拒绝', oversize.status === 400, `status=${oversize.status}`)

  const regexSafe = await api(`/tasks?keyword=${encodeURIComponent('.*')}`, { token })
  check('关键词正则元字符已转义', regexSafe.status === 200 && regexSafe.json?.data?.total === 0, `total=${regexSafe.json?.data?.total}`)

  /* ------------------------------- 越权防护 ----------------------------- */
  const other = await api('/auth/register', { method: 'POST', body: { username: '他人', email: `other-${Date.now()}@campuspilot.test`, password: PASSWORD } })
  const otherToken = other.json?.data?.token
  const crossAccess = await api(`/tasks/${taskId}`, { token: otherToken })
  check('无法读取他人任务', crossAccess.status === 404, `status=${crossAccess.status}`)
  check('两个账号看到不同数据', other.json?.data?.user?.id !== userId)

  const studentNotice = await api('/notices', { method: 'POST', token, body: { title: '学生越权广播' } })
  check('学生无权发布全校公告', studentNotice.status === 403, `status=${studentNotice.status}`)

  const notices = await api('/notices')
  check('公共公告可匿名读取', notices.status === 200 && notices.json?.data?.notices?.length > 0)

  /* --------------------------------- 限流 -------------------------------- */
  let limited = 0
  for (let i = 0; i < 12; i += 1) {
    const attempt = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: 'WrongPass9999' } })
    if (attempt.status === 429) limited += 1
  }
  check('连续失败登录触发限流', limited > 0, `429 次数=${limited}`)
} finally {
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

console.log(lines.join('\n'))
console.log(`\n冒烟测试结果：通过 ${pass} 项，失败 ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)