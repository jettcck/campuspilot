import fs from 'node:fs'
import path from 'node:path'
import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { serialize } from '../utils/serialize.js'
import { UPLOAD_ROOT } from '../middleware/upload.js'

export const courseController = {
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

  remove: asyncHandler(async (req, res) => {
    const courses = collection('courses')
    const course = await courses.findById(req.params.id)
    if (!course || course.userId !== req.user.id) throw new ApiError(404, '课程不存在', 'COURSE_NOT_FOUND')
    await courses.deleteById(req.params.id)
    ok(res, null, '课程已删除')
  })
}

export const fileController = {
  /** 课程资料列表 */
  list: asyncHandler(async (req, res) => {
    const filter = { userId: req.user.id }
    if (req.query.courseId) filter.courseId = req.query.courseId
    const files = await collection('files').find(filter, { sort: { createdAt: -1 } })
    ok(res, { files: files.map(serialize) })
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