import React from 'react'

export const NAV_ITEMS = [
  { key: 'dashboard', icon: '⌂', label: '总览' },
  { key: 'plan', icon: '◷', label: '学习计划' },
  { key: 'courses', icon: '▤', label: '课程资料' },
  { key: 'ai', icon: '✦', label: 'AI 学习室' },
  { key: 'groups', icon: '⌁', label: '协作小组' },
  { key: 'campus', icon: '⚑', label: '校园信息' }
]

const TITLES = {
  dashboard: ['总览', '今天也要保持专注，向你的目标靠近一点。'],
  plan: ['学习计划', '把大目标拆成今天就能完成的小步骤。'],
  courses: ['课程资料', '集中管理课程与资料，随取随用。'],
  ai: ['AI 学习室', '问答、总结、出题与计划生成一站式完成。'],
  groups: ['协作小组', '和同学一起推进课程项目。'],
  campus: ['校园信息', '讲座、比赛与通知，不错过重要节点。'],
  profile: ['个人中心', '维护你的资料与账号安全。']
}

/** 左侧导航栏 */
export function Sidebar({ active, onNavigate, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <div><b>CampusPilot</b><span>你的学习航站</span></div>
      </div>

      <div className="side-label">工作台</div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <button key={item.key} className={active === item.key ? 'nav-item selected' : 'nav-item'} onClick={() => onNavigate(item.key)}>
            <i>{item.icon}</i>{item.label}
            {item.key === 'ai' && <em>NEW</em>}
          </button>
        ))}
      </nav>

      <div className="side-label lower">快捷入口</div>
      <button className="nav-item" onClick={() => onNavigate('plan')}><i>＋</i>新建学习计划</button>
      <button className="nav-item" onClick={() => onNavigate('groups')}><i>↗</i>邀请小组成员</button>

      <div className="sidebar-bottom">
        <div className="upgrade-card">
          <span>PRO 学习模式</span>
          <p>解锁无限 AI 学习对话与资料分析</p>
          <button onClick={() => onNavigate('ai')}>了解更多 <b>↗</b></button>
        </div>
        <div className="profile">
          <div className="avatar">{user?.avatar || user?.username?.slice(0, 1) || '同'}</div>
          <div><b>{user?.username || '未登录'}</b><span>{user?.grade || '—'} · {user?.major || '—'}</span></div>
          <button className="logout" onClick={onLogout} title="退出登录">⏻</button>
        </div>
      </div>
    </aside>
  )
}

/** 顶部工具栏 */
export function Topbar({ active, driver }) {
  const [title] = TITLES[active] || ['工作台', '']
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>工作台</span><b>/</b><strong>{title}</strong>
        {driver && <small className="api-status">● {driver}</small>}
      </div>
      <div className="top-actions">
        <button className="icon-button">⌕</button>
        <button className="icon-button notification">♧<small></small></button>
        <div className="date-chip">{today} <span>⌄</span></div>
      </div>
    </header>
  )
}

