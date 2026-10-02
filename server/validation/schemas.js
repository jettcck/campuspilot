import { z } from 'zod'

/**
 * 接口入参契约
 * 所有写入类接口的字段长度、类型、取值范围都在这里集中声明，
 * 控制器只保留业务规则（如邮箱唯一、权限校验）。
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, '邮箱长度不能超过 120 位')
  .regex(EMAIL_PATTERN, '邮箱格式不正确')

const password = z.string().min(8, '密码长度至少 8 位').max(72, '密码长度不能超过 72 位')

/** 可选文本：允许 null（前端清空字段时常见），统一归一为 undefined */
const optionalText = (max) =>
  z
    .union([z.string().trim().max(max, `内容长度不能超过 ${max} 个字符`), z.null()])
    .optional()
    .transform((value) => (value === null ? undefined : value))

const minutes = z.coerce.number().int('预计时长必须为整数').min(0).max(1440)

/* --------------------------------- 认证 --------------------------------- */

export const registerSchema = z.object({
  username: z.string().trim().min(1, '用户名不能为空').max(40, '用户名长度不能超过 40 位'),
  email,
  password,
  school: optionalText(80),
  major: optionalText(80),
  grade: optionalText(40)
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, '请输入密码').max(72)
})

export const updateProfileSchema = z.object({
  username: z.string().trim().min(1, '用户名不能为空').max(40).optional(),
  school: optionalText(80),
  major: optionalText(80),
  grade: optionalText(40),
  avatar: optionalText(8)
})

export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请填写原密码').max(72),
  newPassword: password
})

/* --------------------------------- 任务 --------------------------------- */

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, '任务标题不能为空').max(120, '任务标题不能超过 120 字'),
  meta: optionalText(200),
  tag: optionalText(20),
  color: optionalText(20),
  courseId: optionalText(64),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  dueDate: optionalText(40),
  estimatedMinutes: minutes.optional()
})

export const taskUpdateSchema = taskCreateSchema.partial()

export const taskStatusSchema = z.object({ done: z.boolean() })

/* --------------------------------- 课程 --------------------------------- */

export const courseCreateSchema = z.object({
  name: z.string().trim().min(1, '课程名称不能为空').max(80, '课程名称不能超过 80 字'),
  teacher: optionalText(40),
  semester: optionalText(40),
  color: optionalText(20),
  description: optionalText(500),
  tags: z.array(z.string().trim().min(1).max(20)).max(10, '标签最多 10 个').optional(),
  nextClass: optionalText(40)
})

export const courseUpdateSchema = courseCreateSchema.partial().extend({
  progress: z.coerce.number().min(0, '进度不能小于 0').max(100, '进度不能大于 100').optional()
})

/* --------------------------------- 小组 --------------------------------- */

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1, '小组名称不能为空').max(60, '小组名称不能超过 60 字'),
  description: optionalText(300)
})

export const groupJoinSchema = z.object({
  inviteCode: z.string().trim().min(4, '邀请码格式不正确').max(16, '邀请码格式不正确')
})

/* ------------------------------- 校园信息 ------------------------------- */

export const noticeCreateSchema = z.object({
  title: z.string().trim().min(1, '公告标题不能为空').max(120, '公告标题不能超过 120 字'),
  category: optionalText(20),
  content: optionalText(2000),
  source: optionalText(60)
})

/* ---------------------------------- AI ---------------------------------- */

export const aiChatSchema = z.object({ prompt: optionalText(2000) })
export const aiPlanSchema = z.object({
  goal: optionalText(500),
  days: z.coerce.number().int('天数必须为整数').min(1).max(30).optional()
})
export const aiSummarizeSchema = z.object({ text: optionalText(8000), prompt: optionalText(8000) })
export const aiQuizSchema = z.object({ topic: optionalText(200), prompt: optionalText(200) })

/* --------------------------------- 查询 --------------------------------- */

/** 列表接口通用查询契约：分页 + 各模块常用筛选维度 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: optionalText(20),
  courseId: optionalText(64),
  keyword: z.string().trim().max(100, '关键词长度不能超过 100 字').optional(),
  category: optionalText(20)
})

export const planStepSchema = z.object({
  index: z.coerce.number().int('步骤序号必须为整数').min(0).max(200),
  done: z.boolean()
})