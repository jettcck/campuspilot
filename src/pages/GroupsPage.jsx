import React, { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/** 协作小组页 */
export default function GroupsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState({ name: '', description: '' })
  const [inviteCode, setInviteCode] = useState('')

  const { data, reload } = useApi(() => api.groups(), [])
  const groups = data?.groups || []

  const create = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return toast('请填写小组名称', 'error')
    try {
      await api.createGroup(form)
      setForm({ name: '', description: '' })
      await reload()
      toast('小组创建成功')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const join = async (event) => {
    event.preventDefault()
    if (!inviteCode.trim()) return toast('请输入邀请码', 'error')
    try {
      await api.joinGroup(inviteCode.trim())
      setInviteCode('')
      await reload()
      toast('已加入小组')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const remove = async (group) => {
    try {
      await api.deleteGroup(group.id)
      await reload()
      toast('小组已解散')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <div className="content-wrap">
      <section className="two-column">
        <form className="panel inline-form vertical" onSubmit={create}>
          <div className="panel-head"><div><h2>创建小组</h2><p>创建后把邀请码发给组员即可加入</p></div></div>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="小组名称，例如：Web 大作业小组" />
          <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="小组目标与分工说明" />
          <button className="primary-button" type="submit">创建小组</button>
        </form>

        <form className="panel inline-form vertical" onSubmit={join}>
          <div className="panel-head"><div><h2>加入小组</h2><p>输入组员分享的 6 位邀请码</p></div></div>
          <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="例如：A1B2C3" maxLength={6} />
          <button className="primary-button" type="submit">加入小组</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>我的小组</h2><p>共参与 {groups.length} 个小组</p></div></div>
        <div className="group-grid">
          {groups.length === 0 && <p className="empty">你还没有加入任何小组。</p>}
          {groups.map((group) => (
            <div className="group-card" key={group.id}>
              <div className="group-head">
                <b>{group.name}</b>
                {group.ownerId === user?.id && <span className="status-pill active">组长</span>}
              </div>
              <p>{group.description || '暂无小组说明'}</p>
              <div className="invite-line">邀请码 <code>{group.inviteCode}</code></div>
              <div className="member-row">
                {(group.members || []).map((member) => <span className="member-chip" key={member.id}>{member.avatar || member.username?.slice(0, 1)}</span>)}
                <small>{group.memberCount} 位成员</small>
              </div>
              {group.ownerId === user?.id && <button className="link-danger" onClick={() => remove(group)}>解散小组</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}