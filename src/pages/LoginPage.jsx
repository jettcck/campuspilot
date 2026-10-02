import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

/** 登录 / 注册页面 */
export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', username: '', school: '', major: '', grade: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register({ username: form.username, email: form.email, password: form.password, school: form.school, major: form.major, grade: form.grade })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand"><div className="brand-mark">C</div><b>CampusPilot</b></div>
        <h2>把大学生活<br />装进一个<span>学习航站</span></h2>
        <p>学习计划 · 课程资料 · AI 助手 · 小组协作 · 校园信息，全部集中在一处。</p>
        <ul className="auth-points">
          <li><b>AI 学习伙伴</b><span>一句话生成七天学习计划</span></li>
          <li><b>数据可视</b><span>学习时长、完成率、连续天数</span></li>
          <li><b>小组协作</b><span>邀请码一键组队推进项目</span></li>
        </ul>
        <span className="auth-badge">全栈项目 · React + Express + MongoDB + JWT + AI</span>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>注册</button>
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <label className="field"><span>用户名</span>
                <input value={form.username} onChange={update('username')} placeholder="请输入昵称" required />
              </label>
            )}
            <label className="field"><span>邮箱</span>
              <input type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required />
            </label>
            <label className="field"><span>密码</span>
              <input type="password" value={form.password} onChange={update('password')} placeholder="至少 8 位" required />
            </label>

            {mode === 'register' && (
              <div className="field-row">
                <label className="field"><span>学校</span><input value={form.school} onChange={update('school')} placeholder="示例大学" /></label>
                <label className="field"><span>专业</span><input value={form.major} onChange={update('major')} placeholder="软件工程" /></label>
                <label className="field"><span>年级</span><input value={form.grade} onChange={update('grade')} placeholder="大二" /></label>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <button className="primary-button block" type="submit" disabled={loading}>
              {loading ? '处理中…' : mode === 'login' ? '登录 CampusPilot' : '创建账号'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}