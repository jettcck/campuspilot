import React, { useCallback, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { Sidebar, Topbar } from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import PlanPage from './pages/PlanPage.jsx'
import CoursesPage from './pages/CoursesPage.jsx'
import AiPage from './pages/AiPage.jsx'
import GroupsPage from './pages/GroupsPage.jsx'
import CampusPage from './pages/CampusPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'

const VALID_ROUTES = ['dashboard', 'plan', 'courses', 'ai', 'groups', 'campus', 'profile']

/** 极简哈希路由：无需额外依赖即可支持刷新与前进后退 */
function useHashRoute() {
  const read = () => {
    const key = window.location.hash.replace('#/', '').split('?')[0]
    return VALID_ROUTES.includes(key) ? key : 'dashboard'
  }
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const handler = () => setRoute(read())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((key) => { window.location.hash = `/${key}` }, [])
  return [route, navigate]
}

function Workspace() {
  const { user, loading, logout } = useAuth()
  const [route, navigate] = useHashRoute()

  if (loading) return <div className="boot-screen"><div className="boot-logo">C</div><p>正在启动 CampusPilot…</p></div>
  if (!user) return <LoginPage />

  return (
    <div className="app-shell">
      <Sidebar active={route} onNavigate={navigate} user={user} onLogout={logout} />
      <main className="main-content">
        <Topbar active={route} driver={`已登录 ${user.username}`} />
        {route === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {route === 'plan' && <PlanPage />}
        {route === 'courses' && <CoursesPage />}
        {route === 'ai' && <AiPage />}
        {route === 'groups' && <GroupsPage />}
        {route === 'campus' && <CampusPage />}
        {route === 'profile' && <ProfilePage />}
        <footer className="app-footer">
          <span>CampusPilot · React + Express + MongoDB + JWT + AI</span>
          <button onClick={() => navigate('profile')}>个人中心</button>
        </footer>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Workspace />
      </AuthProvider>
    </ToastProvider>
  )
}