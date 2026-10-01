import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../api/client.js'

const AuthContext = createContext(null)

/** 全局登录状态：负责登录、注册、退出与用户信息刷新 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const bootstrap = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    try {
      const data = await api.me()
      setUser(data.user)
    } catch {
      tokenStore.clear()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  const login = async (email, password) => {
    const data = await api.login({ email, password })
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user
  }

  const register = async (form) => {
    const data = await api.register(form)
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    tokenStore.clear()
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}