import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { serialize } from '../utils/serialize.js'

export const taskController = {
  /** 任务列表：支持状态、课程、关键词筛选 */
  list: asyncHandler(async (req, res) => {
    const { status, courseId, keyword, limit } = req.query
    const filter = { userId: req.user.id }
    if (status === 'done') filter.done = true
    if (status === 'todo') filter.done = false
    if (courseId) filter.courseId = courseId
    if (keyword) filter.title = { $regex: keyword, $options: 'i' }

    const tasks = await collection('tasks').find(filter, {
      sort: { createdAt: -1 },
      limit: limit ? Number(limit) : undefined
    })
    ok(res, { tasks: tasks.map(serialize), total: tasks.length })
  }),

  detail: asyncHandler(async (req, res) => {
    const task = await collection('tasks').findById(req.params.id)
    if (!task || task.userId !== req.user.id) throw new ApiError(404, '任务不存在', 'TASK_NOT_FOUND')
    ok(res, { task: serialize(task) })
  }),

  create: asyncHandler(async (req, res) => {
    const { title, meta, tag, color, courseId, priority, dueDate, estimatedMinutes } = req.body
    if (!title) throw new ApiError(400, '任务标题不能为空', 'PARAM_MISSING')

    const task = await collection('tasks').insert({
      userId: req.user.id,
      courseId: courseId || '',
      title,
      meta: meta || '自定义任务',
      tag: tag || '今天',
      color: color || 'mint',
      priority: priority || 'medium',
      status: 'todo',
      done: false,
      dueDate: dueDate || '',
      estimatedMinutes: Number(estimatedMinutes) || 30
    })
    ok(res, { task: serialize(task) }, '任务创建成功', 201)
  }),

  update: asyncHandler(async (req, res) => {
    const tasks = collection('tasks')
    const task = await tasks.findById(req.params.id)
    if (!task || task.userId !== req.user.id) throw new ApiError(404, '任务不存在', 'TASK_NOT_FOUND')

    const fields = ['title', 'meta', 'tag', 'color', 'courseId', 'priority', 'dueDate', 'estimatedMinutes']
    const patch = {}
    for (const field of fields) if (req.body[field] !== undefined) patch[field] = req.body[field]

    const updated = await tasks.updateById(req.params.id, patch)
    ok(res, { task: serialize(updated) }, '任务已更新')
  }),

  /** 切换完成状态（看板勾选） */
  updateStatus: asyncHandler(async (req, res) => {
    const tasks = collection('tasks')
    const task = await tasks.findById(req.params.id)
    if (!task || task.userId !== req.user.id) throw new ApiError(404, '任务不存在', 'TASK_NOT_FOUND')

    const done = Boolean(req.body.done)
    const updated = await tasks.updateById(req.params.id, { done, status: done ? 'done' : 'todo' })
    ok(res, { task: serialize(updated) }, done ? '任务已完成' : '任务已标记为待完成')
  }),

  remove: asyncHandler(async (req, res) => {
    const tasks = collection('tasks')
    const task = await tasks.findById(req.params.id)
    if (!task || task.userId !== req.user.id) throw new ApiError(404, '任务不存在', 'TASK_NOT_FOUND')
    await tasks.deleteById(req.params.id)
    ok(res, null, '任务已删除')
  })
}