import React, { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'
import { useToast } from '../components/Toast.jsx'

/** 学习计划页：AI 生成计划 + 步骤勾选 + 任务清单 */
export default function PlanPage() {
  const toast = useToast()
  const [goal, setGoal] = useState('')
  const [days, setDays] = useState(7)
  const [creating, setCreating] = useState(false)

  const { data: planData, loading, reload: reloadPlans } = useApi(() => api.plans(), [])
  const { data: taskData, reload: reloadTasks } = useApi(() => api.tasks(), [])
  const plans = planData?.plans || []
  const tasks = taskData?.tasks || []

  const generate = async () => {
    if (!goal.trim()) return toast('请先填写学习目标', 'error')
    setCreating(true)
    try {
      await api.aiPlan(goal, Number(days))
      setGoal('')
      await reloadPlans()
      toast('AI 学习计划已生成')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const toggleStep = async (plan, index, done) => {
    try {
      await api.updatePlanStep(plan.id, index, done)
      await reloadPlans()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const removePlan = async (plan) => {
    try {
      await api.deletePlan(plan.id)
      await reloadPlans()
      toast('计划已删除')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const toggleTask = async (task) => {
    try {
      await api.updateTaskStatus(task.id, !task.done)
      await reloadTasks()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const removeTask = async (task) => {
    try {
      await api.deleteTask(task.id)
      await reloadTasks()
      toast('任务已删除')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <div className="content-wrap">
      <section className="panel ai-builder">
        <div className="panel-head">
          <div><h2>AI 生成学习计划</h2><p>输入目标与天数，系统自动拆解成每日可执行步骤</p></div>
        </div>
        <div className="builder-row">
          <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="例如：两周内掌握 React 基础并完成一个项目" />
          <select value={days} onChange={(event) => setDays(event.target.value)}>
            {[3, 5, 7, 14, 21].map((value) => <option key={value} value={value}>{value} 天</option>)}
          </select>
          <button className="primary-button" onClick={generate} disabled={creating}>{creating ? '生成中…' : '生成计划'}</button>
        </div>
      </section>

      <section className="plan-grid">
        <div className="panel">
          <div className="panel-head"><div><h2>我的学习计划</h2><p>共 {plans.length} 个计划</p></div></div>
          {loading && <p className="empty">加载中…</p>}
          {!loading && plans.length === 0 && <p className="empty">还没有学习计划，先用上面的输入框生成一个。</p>}
          <div className="plan-list">
            {plans.map((plan) => (
              <div className="plan-card" key={plan.id}>
                <div className="plan-head">
                  <div>
                    <b>{plan.goal}</b>
                    <span>{plan.startDate} 至 {plan.endDate} · {plan.steps?.length || 0} 个步骤</span>
                  </div>
                  <div className="plan-actions">
                    <span className={'status-pill ' + plan.status}>{plan.status === 'completed' ? '已完成' : '进行中'}</span>
                    <button className="link-danger" onClick={() => removePlan(plan)}>删除</button>
                  </div>
                </div>
                <div className="progress-line"><i style={{ width: `${plan.progress || 0}%` }} /></div>
                <div className="step-list">
                  {(plan.steps || []).map((step, index) => (
                    <div className={'step-row ' + (step.done ? 'done' : '')} key={index}>
                      <button className="check" onClick={() => toggleStep(plan, index, !step.done)}>{step.done ? '✓' : ''}</button>
                      <div><b>{step.title}</b><span>{step.point} · 预计 {step.minutes} 分钟</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div><h2>全部任务</h2><p>共 {tasks.length} 条任务记录</p></div></div>
          <div className="task-list">
            {tasks.length === 0 && <p className="empty">暂无任务。</p>}
            {tasks.map((task) => (
              <div className={'task-row ' + (task.done ? 'completed' : '')} key={task.id}>
                <button className="check" onClick={() => toggleTask(task)}>{task.done ? '✓' : ''}</button>
                <div className="task-content"><b>{task.title}</b><span>{task.meta}</span></div>
                <span className={'task-tag ' + (task.color || 'mint')}>{task.tag}</span>
                <button className="link-danger" onClick={() => removeTask(task)}>删除</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}