import { collection } from '../utils/store.js'
import { hashPassword } from '../utils/security.js'

/**
 * 演示数据初始化
 * 首次启动时创建演示账号与示例课程/任务/公告，方便直接体验与答辩演示。
 */
export const DEMO_ACCOUNT = { email: 'demo@campuspilot.dev', password: 'Demo123456' }

const DEMO_COURSES = [
  { name: '前端工程实践', teacher: '王老师', semester: '2024 秋', color: 'coral', tags: ['React', '工程化'], progress: 68, nextClass: '周五 14:00' },
  { name: '数据库原理', teacher: '李老师', semester: '2024 秋', color: 'blue', tags: ['MySQL', '事务'], progress: 45, nextClass: '下周一 09:00' },
  { name: '计算机网络', teacher: '张老师', semester: '2024 秋', color: 'mint', tags: ['TCP/IP', 'HTTP'], progress: 52, nextClass: '周三 10:00' }
]

const DEMO_TASKS = [
  { title: '完成 React Hooks 练习', meta: '前端工程实践 · 预计 45 分钟', tag: '今天', color: 'mint', estimatedMinutes: 45, priority: 'high' },
  { title: '复习数据库索引与事务', meta: '数据库原理 · 预计 30 分钟', tag: '今天', color: 'yellow', estimatedMinutes: 30, priority: 'high' },
  { title: '整理计算机网络笔记', meta: '计算机网络 · 预计 60 分钟', tag: '明天', color: 'pink', estimatedMinutes: 60, priority: 'medium', done: true }
]

const DEMO_NOTICES = [
  { title: '第十六届大学生软件创新大赛开始报名', category: '比赛', content: '报名截止时间 11 月 20 日，团队人数 2-5 人，主题为 AI 应用创新。', source: '创新创业学院' },
  { title: '图书馆延长开放时间通知', category: '通知', content: '即日起自习区开放时间延长至 23:00，考试周期间提供 24 小时自习区。', source: '图书馆' },
  { title: '周三学术讲座：从零构建一个全栈应用', category: '讲座', content: '时间：周三 19:00，地点：计科楼 A301，主讲人：陈教授。', source: '计算机学院' }
]

export async function seedDemoData() {
  const users = collection('users')
  const existing = await users.findOne({ email: DEMO_ACCOUNT.email })
  if (existing) return { created: false, email: DEMO_ACCOUNT.email }

  const user = await users.insert({
    username: '林同学',
    email: DEMO_ACCOUNT.email,
    passwordHash: await hashPassword(DEMO_ACCOUNT.password),
    avatar: '林',
    school: '示例大学',
    major: '软件工程',
    grade: '大二',
    role: 'student'
  })

  const courses = []
  for (const course of DEMO_COURSES) {
    courses.push(await collection('courses').insert({ ...course, userId: user._id }))
  }

  for (const [index, task] of DEMO_TASKS.entries()) {
    await collection('tasks').insert({
      ...task,
      userId: user._id,
      courseId: String(courses[index % courses.length]._id),
      done: Boolean(task.done),
      status: task.done ? 'done' : 'todo'
    })
  }

  for (const notice of DEMO_NOTICES) {
    await collection('notices').insert({ ...notice, publishAt: new Date().toISOString() })
  }

  console.log(`[seed] 已创建演示账号：${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`)
  return { created: true, email: DEMO_ACCOUNT.email }
}