import { collection } from '../utils/store.js'

/**
 * 基础数据初始化
 * 只负责公共校园信息（公告）这类与用户无关的内容，不创建任何账号。
 * 用户数据一律由用户本人注册、录入后产生，共享账号在产品中不复存在。
 */
const CAMPUS_NOTICES = [
  {
    title: '第十六届大学生软件创新大赛开始报名',
    category: '比赛',
    content: '报名截止时间 11 月 20 日，团队人数 2-5 人，主题为 AI 应用创新。',
    source: '创新创业学院'
  },
  {
    title: '图书馆延长开放时间通知',
    category: '通知',
    content: '即日起自习区开放时间延长至 23:00，考试周期间提供 24 小时自习区。',
    source: '图书馆'
  },
  {
    title: '周三学术讲座：从零构建一个全栈应用',
    category: '讲座',
    content: '时间：周三 19:00，地点：计科楼 A301，主讲人：陈教授。',
    source: '计算机学院'
  }
]

/** 幂等初始化：集合非空时不重复写入 */
export async function seedBootstrapData() {
  const notices = collection('notices')
  const existing = await notices.count()
  if (existing > 0) return { created: false, count: existing }

  for (const notice of CAMPUS_NOTICES) {
    await notices.insert({ ...notice, publishAt: new Date().toISOString() })
  }
  return { created: true, count: CAMPUS_NOTICES.length }
}