import { collection } from '../utils/store.js'
import { ApiError, asyncHandler, ok } from '../utils/http.js'
import { serialize } from '../utils/serialize.js'

/**
 * 新用户引导
 * 注册后工作台是空的，直接面对空白页会显著提高流失。
 * 这里提供「一键导入示例数据」，数据写入当前用户自己的空间，
 * 与账号体系完全隔离，可随时删除，不影响任何其他用户。
 */

const SAMPLE_COURSES = [
  { name: '前端工程实践', teacher: '王老师', semester: '2024 秋', color: 'coral', tags: ['React', '工程化'], progress: 68, nextClass: '周五 14:00' },
  { name: '数据库原理', teacher: '李老师', semester: '2024 秋', color: 'blue', tags: ['MySQL', '事务'], progress: 45, nextClass: '下周一 09:00' },
  { name: '计算机网络', teacher: '张老师', semester: '2024 秋', color: 'mint', tags: ['TCP/IP', 'HTTP'], progress: 52, nextClass: '周三 10:00' }
]

const SAMPLE_TASKS = [
  { title: '完成 React Hooks 练习', meta: '前端工程实践 · 预计 45 分钟', tag: '今天', color: 'mint', estimatedMinutes: 45, priority: 'high', done: false },
  { title: '复习数据库索引与事务', meta: '数据库原理 · 预计 30 分钟', tag: '今天', color: 'yellow', estimatedMinutes: 30, priority: 'high', done: false },
  { title: '整理计算机网络笔记', meta: '计算机网络 · 预计 60 分钟', tag: '明天', color: 'pink', estimatedMinutes: 60, priority: 'medium', done: true }
]

async function countOwned(userId) {
  const [courses, tasks, plans] = await Promise.all([
    collection('courses').count({ userId }),
    collection('tasks').count({ userId }),
    collection('studyplans').count({ userId })
  ])
  return { courses, tasks, plans }
}

export const onboardingController = {
  /** 引导状态：判断当前账号是否仍是空工作台 */
  status: asyncHandler(async (req, res) => {
    const counts = await countOwned(req.user.id)
    ok(res, { isEmpty: counts.courses + counts.tasks + counts.plans === 0, counts })
  }),

  /** 一键导入示例课程与任务，避免新用户面对空白页面 */
  importSampleData: asyncHandler(async (req, res) => {
    const counts = await countOwned(req.user.id)
    if (counts.courses + counts.tasks + counts.plans > 0) {
      throw new ApiError(409, '当前账号已有数据，无需导入示例数据', 'SAMPLE_ALREADY_IMPORTED')
    }

    const courses = collection('courses')
    const created = []
    for (const course of SAMPLE_COURSES) {
      created.push(await courses.insert({ ...course, userId: req.user.id }))
    }

    const tasks = collection('tasks')
    const createdTasks = []
    for (const [index, task] of SAMPLE_TASKS.entries()) {
      createdTasks.push(
        await tasks.insert({
          ...task,
          userId: req.user.id,
          courseId: String(created[index % created.length]._id),
          status: task.done ? 'done' : 'todo'
        })
      )
    }

    ok(
      res,
      {
        courses: created.map(serialize),
        tasks: createdTasks.map(serialize),
        counts: { courses: created.length, tasks: createdTasks.length }
      },
      '示例数据已导入',
      201
    )
  })
}