import { collection } from '../utils/store.js'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** 计算本周（周一为起点）的日期数组 */
function weekDays() {
  const today = startOfDay(new Date())
  const weekday = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - weekday)
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return { date: day, label: DAY_LABELS[index], isFuture: day > today }
  })
}

/**
 * 统计服务：把原始任务/课程数据聚合成仪表盘需要的指标
 */
export const statsService = {
  async overview(userId) {
    const [tasks, courses, plans] = await Promise.all([
      collection('tasks').find({ userId }),
      collection('courses').find({ userId }),
      collection('studyplans').find({ userId })
    ])

    const done = tasks.filter((task) => task.done)
    const completionRate = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0
    const totalMinutes = done.reduce((sum, task) => sum + (Number(task.estimatedMinutes) || 0), 0)

    // 连续学习天数：从今天往前回溯，遇到没有完成任务的一天即中断
    const doneDays = new Set(done.map((task) => String(task.updatedAt || task.createdAt || '').slice(0, 10)))
    let streak = 0
    for (let offset = 0; offset < 365; offset += 1) {
      const day = startOfDay(new Date())
      day.setDate(day.getDate() - offset)
      if (doneDays.has(day.toISOString().slice(0, 10))) streak += 1
      else if (offset > 0) break
    }

    const courseRanking = courses
      .map((course) => ({
        name: course.name,
        count: tasks.filter((task) => String(task.courseId) === String(course.id || course._id)).length
      }))
      .sort((a, b) => b.count - a.count)

    return {
      weeklyMinutes: totalMinutes,
      weeklyHours: Number((totalMinutes / 60).toFixed(1)),
      completionRate,
      doneCount: done.length,
      totalCount: tasks.length,
      streak,
      activePlans: plans.filter((plan) => plan.status === 'active').length,
      courseCount: courses.length,
      topCourse: courseRanking[0]?.name || '暂无数据',
      courseRanking
    }
  },

  /** 近 7 天学习时长（分钟），用于柱状图 */
  async weekly(userId) {
    const tasks = await collection('tasks').find({ userId, done: true })
    return weekDays().map((day) => {
      const key = day.date.toISOString().slice(0, 10)
      const minutes = tasks
        .filter((task) => String(task.updatedAt || task.createdAt || '').slice(0, 10) === key)
        .reduce((sum, task) => sum + (Number(task.estimatedMinutes) || 0), 0)
      return { label: day.label, date: key, minutes }
    })
  }
}