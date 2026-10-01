import React, { useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/** 个人中心：资料维护与密码修改 */
export default function ProfilePage() {
  const toast = useToast()
  const { user, setUser, logout } = useAuth()
  const [profile, setProfile] = useState({ username: user?.username || '', school: user?.school || '', major: user?.major || '', grade: user?.grade || '' })
  const [password, setPassword] = useState({ oldPassword: '', newPassword: '' })

  const saveProfile = async (event) => {
    event.preventDefault()
    try {
      const data = await api.updateProfile(profile)
      setUser(data.user)
      toast('资料已保存')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    try {
      await api.updatePassword(password)
      toast('密码已修改，请重新登录')
      setTimeout(logout, 1200)
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <div className="content-wrap">
      <section className="two-column">
        <form className="panel inline-form vertical" onSubmit={saveProfile}>
          <div className="panel-head"><div><h2>基本资料</h2><p>这些信息会显示在小组协作中</p></div></div>
          <label className="field"><span>用户名</span><input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} /></label>
          <label className="field"><span>学校</span><input value={profile.school} onChange={(event) => setProfile({ ...profile, school: event.target.value })} /></label>
          <label className="field"><span>专业</span><input value={profile.major} onChange={(event) => setProfile({ ...profile, major: event.target.value })} /></label>
          <label className="field"><span>年级</span><input value={profile.grade} onChange={(event) => setProfile({ ...profile, grade: event.target.value })} /></label>
          <button className="primary-button" type="submit">保存资料</button>
        </form>

        <form className="panel inline-form vertical" onSubmit={savePassword}>
          <div className="panel-head"><div><h2>账号安全</h2><p>密码使用 bcrypt 加密存储</p></div></div>
          <label className="field"><span>邮箱</span><input value={user?.email || ''} readOnly /></label>
          <label className="field"><span>原密码</span><input type="password" value={password.oldPassword} onChange={(event) => setPassword({ ...password, oldPassword: event.target.value })} /></label>
          <label className="field"><span>新密码</span><input type="password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} placeholder="至少 6 位" /></label>
          <button className="primary-button" type="submit">修改密码</button>
        </form>
      </section>
    </div>
  )
}