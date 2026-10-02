import fs from 'node:fs'
import path from 'node:path'
import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok, pageMeta, resolvePagination } from '../utils/http.js'
import { serialize } from '../utils/serialize.js'
import { UPLOAD_ROOT } from '../middleware/upload.js'

export const courseController = {
  // 课程同时充当任务/筛选器的下拉数据源，一次性返回全部，不做分页
  list: asyncHandler(async (req, res) => {
    const courses = await collection('courses').find({ userId: req.user.id }, { sort: { createdAt: 1 } })
    ok(res, { courses: courses.map(serialize) })
  }),

  create: asyncHandler(async (req, res) => {
    const { name, teacher, semester, color, description, tags, nextClass } = req.body
    if (!name) throw new ApiError(400, '课程名称不能为空', 'PARAM_MISSING')
    const course = await collection('courses').insert({
      userId: req.user.id,
      name,
      teacher: teacher || '',
      semester: semester || '',
      color: color || 'coral',
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      progress: 0,
      nextClass: nextClass || ''
    })
    ok(res, { course: serialize(course) }, '课程创建成功', 201)
  }),

  update: asyncHandler(async (req, res) => {
    const courses = collection('courses')
    const course = await courses.findById(req.params.id)
    if (!course || course.userId !== req.user.id) throw new ApiError(404, '课程不存在', 'COURSE_NOT_FOUND')

    const fields = ['name', 'teacher', 'semester', 'color', 'description', 'tags', 'progress', 'nextClass']
    const patch = {}
    for (const field of fields) if (req.body[field] !== undefined) patch[field] = req.body[field]

    const updated = await courses.updateById(req.params.id, patch)
    ok(res, { course: serialize(updated) }, '课程已更新')
  }),

  /** 删除课程：同步清理其下任务并解绑资料，避免产生孤儿数据 */
  remove: asyncHandler(async (req, res) => {
    const courses = collection('courses')
    const course = await courses.findById(req.params.id)
    if (!course || course.userId !== req.user.id) throw new ApiError(404, '课程不存在', 'COURSE_NOT_FOUND')

    const courseId = String(course._id)
    const removedTasks = await collection('tasks').deleteMany({ userId: req.user.id, courseId })
    await collection('files').updateMany({ userId: req.user.id, courseId }, { courseId: '' })
    await courses.deleteById(courseId)

    ok(res, { removedTasks }, `课程已删除，同时清理了 ${removedTasks} 个关联任务`)
  })
}

export const fileController = {
  /** 课程资料列表（分页） */
  list: asyncHandler(async (req, res) => {
    const filter = { userId: req.user.id }
    if (req.query.courseId) filter.courseId = req.query.courseId

    const pagination = resolvePagination(req.query)
    const files = collection('files')
    const [list, total] = await Promise.all([
      files.find(filter, { sort: { createdAt: -1 }, skip: pagination.skip, limit: pagination.limit }),
      files.count(filter)
    ])
    ok(res, { files: list.map(serialize), ...pageMeta(total, pagination) })
  }),

  /** 上传资料：multer 已把文件落到 uploads 目录 */
  upload: asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, '请选择要上传的文件', 'FILE_MISSING')
    const file = await collection('files').insert({
      userId: req.user.id,
      courseId: req.body.courseId || '',
      filename: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      fileType: path.extname(req.file.originalname).replace('.', '').toLowerCase(),
      fileSize: req.file.size,
      extractedText: '',
      summary: '',
      tags: []
    })
    ok(res, { file: serialize(file) }, '资料上传成功', 201)
  }),

  /** 资料摘要：交给 AI 服务处理 */
  summarize: asyncHandler(async (req, res) => {
    const { aiService } = await import('../services/aiService.js')
    const files = collection('files')
    const file = await files.findById(req.params.id)
    if (!file || file.userId !== req.user.id) throw new ApiError(404, '资料不存在', 'FILE_NOT_FOUND')

    let content = file.extractedText
    // 文本类文件直接读取内容用于总结，其他类型基于文件名与标签生成
    if (!content && ['txt', 'md'].includes(file.fileType)) {
      try {
        content = fs.readFileSync(path.join(UPLOAD_ROOT, path.basename(file.fileUrl)), 'utf8').slice(0, 4000)
      } catch {
        content = ''
      }
    }
    const { summary } = await aiService.summarize(content || `${file.filename}（${file.fileType}）`)
    const updated = await files.updateById(req.params.id, { summary })
    ok(res, { file: serialize(updated) }, '资料摘要已生成')
  }),

  remove: asyncHandler(async (req, res) => {
    const files = collection('files')
    const file = await files.findById(req.params.id)
    if (!file || file.userId !== req.user.id) throw new ApiError(404, '资料不存在', 'FILE_NOT_FOUND')
    try {
      fs.unlinkSync(path.join(UPLOAD_ROOT, path.basename(file.fileUrl)))
    } catch {
      // 物理文件可能已被清理，忽略
    }
    await files.deleteById(req.params.id)
    ok(res, null, '资料已删除')
  })
}