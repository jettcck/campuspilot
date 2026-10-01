import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

/** 轻量全局提示，替代引入额外 UI 库 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2400)
  }, [])

  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && <div className={`toast ${toast.type}`}>{toast.type === 'error' ? '✕' : '✓'} {toast.message}</div>}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext).show