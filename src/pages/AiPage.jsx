import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../components/Toast.jsx'

const SCENES = [
  { key: 'chat', label: '学习问答', placeholder: '例如：数据结构里哈希冲突怎么处理？', hint: '回答会记录到历史记录中' },
  { key: 'summarize', label: '资料总结', placeholder: '粘贴一段课件或笔记内容', hint: '输出核心概念、关键结论与易错点' },
  { key: 'quiz', label: '生成自测题', placeholder: '例如：操作系统的进程调度', hint: '生成选择题、填空与简答题' }
]

/** AI 学习室：问答 / 总结 / 出题 / 历史 / 学习建议 */
export default function AiPage() {
  const toast = useToast()
  const [scene, setScene] = useState('chat')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [advice, setAdvice] = useState('')
  const listRef = useRef(null)

  const loadHistory = async () => {
    try {
      const data = await api.aiHistory()
      setHistory(data.history || [])
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  useEffect(() => { loadHistory() }, [])

  const run = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    try {
      if (scene === 'chat') {
        const data = await api.aiChat(input)
        setResult(data.reply)
      } else if (scene === 'summarize') {
        const data = await api.aiSummarize(input)
        setResult(data.summary)
      } else {
        const data = await api.aiQuiz(input)
        setResult(data.quiz)
      }
      setInput('')
      await loadHistory()
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAdvice = async () => {
    try {
      const data = await api.aiAdvise()
      setAdvice(data.advice)
      await loadHistory()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const current = SCENES.find((item) => item.key === scene)

  return (
    <div className="content-wrap">
      <section className="ai-workspace">
        <div className="panel ai-console">
          <div className="panel-head">
            <div><h2>AI 学习助手</h2><p>{current.hint}</p></div>
            <button className="ghost-button" onClick={loadAdvice}>生成学习建议</button>
          </div>

          <div className="scene-tabs">
            {SCENES.map((item) => (
              <button key={item.key} className={scene === item.key ? 'active' : ''} onClick={() => { setScene(item.key); setResult('') }}>{item.label}</button>
            ))}
          </div>

          <div className="ai-scroll">
            {advice && <div className="ai-answer advice"><b>本周学习建议</b><pre>{advice}</pre></div>}
            {result && <div className="ai-answer"><b>AI 输出</b><pre>{result}</pre></div>}
            {!result && !advice && <p className="empty">选择场景，输入内容后点击发送，结果会显示在这里。</p>}
          </div>

          <div className="ai-composer">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={current.placeholder} rows={3}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) run() }} />
            <button className="primary-button" onClick={run} disabled={loading}>{loading ? '生成中…' : '发送 ⌘+Enter'}</button>
          </div>
        </div>

        <div className="panel" ref={listRef}>
          <div className="panel-head"><div><h2>对话历史</h2><p>最近 {history.length} 条记录</p></div></div>
          <div className="history-list">
            {history.length === 0 && <p className="empty">暂无历史记录。</p>}
            {history.map((item) => (
              <div className="history-item" key={item.id}>
                <span className="history-scene">{{ chat: '问答', summarize: '总结', quiz: '出题' }[item.scene] || item.scene}</span>
                <b>{item.prompt?.slice(0, 40)}</b>
                <p>{item.reply?.slice(0, 70)}…</p>
                <small>{String(item.createdAt || '').slice(0, 16).replace('T', ' ')}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}