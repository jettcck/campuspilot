import { useCallback, useEffect, useState } from 'react'

/**
 * 通用数据请求 Hook
 * @param {Function} loader 返回 Promise 的加载函数
 * @param {Array} deps 依赖变化时重新加载
 */
export function useApi(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await loader())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => { run() }, [run])

  return { data, loading, error, reload: run, setData }
}