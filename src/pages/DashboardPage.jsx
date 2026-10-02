import React, { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { MiniBarChart, ProgressRing, Sparkline } from '../components/Charts.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const COURSE_COLORS = { coral: '#ec9d7b', blue: '#78a6c6', mint: '#9ccf64', yellow: '#e9c46a' }

/** 总览页：学习数据 + 今日任务 + 课程 + AI 速览 */
export default function DashboardPage({ onNavigate }) {
  const { user } = useAuth()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [asking, setAsking] = useState(false)
  const [importing, setImporting] = useState(false)

  const { data: statsData, reload: reloadStats } = useApi(() => api.statsOverview(), [])
  const { data: weeklyData } = useApi(() => api.statsWeekly(), [])
  const { data: taskData, reload: reloadTasks } = useApi(() => api.tasks(), [])
  const { data: courseData, reload: reloadCourses } = useApi(() => api.courses(), [])

  const stats = statsData?.stats
  const weekly = weeklyData?.weekly || []
  const tasks = taskData?.tasks || []
  const courses = (courseData?.courses || []).slice(0, 3)

  // 新账号是空工作台，提供一次性示例数据导入，避免首次进入就是空白页
  const emptyWorkspace = Boolean(statsData) && (stats?.totalCount ?? 0) === 0 && (stats?.courseCount ?? 0) === 0

  const importSample = async () => {
    setImporting(true)
    try {
      await api.importSampleData()
      await Promise.all([reloadStats(), reloadTasks(), reloadCourses()])
      toast('示例数据已导入，随时可以删除')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const toggleTask = async (task) => {
    try {
      await api.updateTaskStatus(task.id, !task.done)
      await Promise.all([reloadTasks(), reloadStats()])
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const quickAdd = async () => {
    const title = window.prompt('新任务名称', '复习今天的课程内容')
    if (!title) return
    try {
      await api.createTask({ title, meta: '自定义任务 · 预计 30 分钟', estimatedMinutes: 30 })
      await Promise.all([reloadTasks(), reloadStats()])
      toast('任务已创建')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const askAI = async () => {
    if (!draft.trim() || asking) return
    setAsking(true)
    try {
      const data = await api.aiChat(draft)
      setAiReply(data.reply)
      setDraft('')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="content-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{new Date().toDateString().toUpperCase()}</p>
          <h1>{`${new Date().getHours() < 11 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好'}，${user?.username || '同学'}`} <span>✦</span></h1>
          <p className="subtitle">你已完成 {stats?.doneCount || 0} 个任务，还有 {Math.max((stats?.totalCount || 0) - (stats?.doneCount || 0), 0)} 个待完成。</p>
        </div>
        <button className="primary-button" onClick={quickAdd}><span>＋</span> 新建任务</button>
      </section>

      {emptyWorkspace && (
        <section className="onboarding-banner">
          <div>
            <b>你的工作台还是空的</b>
            <p>先导入一份示例课程与任务，快速体验完整流程；熟悉之后随时删除，再录入自己的内容。</p>
          </div>
          <button className="primary-button" onClick={importSample} disabled={importing}>
            {importing ? '导入中…' : '一键导入示例数据'}
          </button>
        </section>
      )}

      <section className="stats-grid">
        <div className="stat-card dark">
          <div className="stat-top"><span>本周学习时长</span><span className="trend">● 已完成任务累计</span></div>
          <strong>{stats?.weeklyHours ?? 0}<small>小时</small></strong>
          <Sparkline values={weekly.map((item) => item.minutes)} />
          <p>累计 {stats?.weeklyMinutes ?? 0} 分钟专注记录</p>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>任务完成率</span><div className="stat-icon mint-icon">✓</div></div>
          <strong className="light-number">{stats?.completionRate ?? 0}<small>%</small></strong>
          <div className="progress-line"><i style={{ width: `${stats?.completionRate || 0}%` }} /></div>
          <p>已完成 {stats?.doneCount ?? 0} / {stats?.totalCount ?? 0} 个任务</p>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>连续学习</span><div className="stat-icon sun-icon">✦</div></div>
          <strong className="light-number">{stats?.streak ?? 0}<small>天</small></strong>
          <div className="ring-row"><ProgressRing value={stats?.completionRate || 0} size={72} label="完成率" /></div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel tasks-panel">
          <div className="panel-head">
            <div><h2>今日任务</h2><p>合理安排每一步，完成大目标</p></div>
            <button className="text-button" onClick={() => onNavigate('plan')}>查看全部 <span>→</span></button>
          </div>
          <div className="task-list">
            {tasks.length === 0 && <p className="empty">还没有任务，点击下方按钮创建第一个学习任务。</p>}
            {tasks.slice(0, 6).map((task) => (
              <div className={'task-row ' + (task.done ? 'completed' : '')} key={task.id}>
                <button className="check" onClick={() => toggleTask(task)}>{task.done ? '✓' : ''}</button>
                <div className="task-content"><b>{task.title}</b><span>{task.meta} · 预计 {task.estimatedMinutes} 分钟</span></div>
                <span className={'task-tag ' + (task.color || 'mint')}>{task.tag}</span>
              </div>
            ))}
          </div>
          <button className="add-task" onClick={quickAdd}>＋ 添加任务</button>
        </div>

        <div className="panel focus-panel">
          <div className="panel-head">
            <div><h2>专注趋势</h2><p>过去 7 天的学习记录</p></div>
            <span className="select-button">本周</span>
          </div>
          <div className="chart-value">
            <strong>{stats?.weeklyHours ?? 0}</strong>
            <span>小时</span>
          </div>
          <MiniBarChart data={weekly} />
        </div>
      </section>

      <section className="bottom-grid">
        <div className="panel courses-panel">
          <div className="panel-head">
            <div><h2>我的课程</h2><p>本学期共 {stats?.courseCount ?? 0} 门课程</p></div>
            <button className="text-button" onClick={() => onNavigate('courses')}>管理课程 <span>→</span></button>
          </div>
          <div className="course-list">
            {courses.length === 0 && <p className="empty">还没有课程，去课程资料页添加一门。</p>}
            {courses.map((course) => (
              <div className="course-item" key={course.id}>
                <div className="course-art" style={{ background: COURSE_COLORS[course.color] || '#78a6c6' }}>{course.name.slice(0, 2)}</div>
                <div><b>{course.name}</b><span>{course.teacher} · {course.nextClass || '未安排'}</span></div>
                <div className="course-progress">
                  <i style={{ width: `${course.progress || 0}%`, background: COURSE_COLORS[course.color] || '#8cb8d2' }} />
                  <small>{course.progress || 0}%</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ai-card">
          <div className="ai-glow" />
          <div className="ai-head">
            <div className="ai-orb">✦</div>
            <div><b>AI 学习伙伴</b><span>随时为你答疑解惑</span></div>
            <span className="online"><i /> 在线</span>
          </div>
          <div className="ai-body">
            <p>{aiReply || `嗨，${user?.username || '同学'}！今天想学习什么？告诉我你的目标，我来帮你制定计划。`}</p>
          </div>
          <div className="ai-input">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && askAI()} placeholder="问问你的学习伙伴..." />
            <button onClick={askAI} disabled={asking}>{asking ? '…' : '↑'}</button>
          </div>
          <button className="ai-more" onClick={() => onNavigate('ai')}>进入 AI 学习室 →</button>
        </div>
      </section>
    </div>
  )
}