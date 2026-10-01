import React, { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../hooks/useApi.js'

const CATEGORIES = ['全部', '讲座', '比赛', '通知', '活动']

/** 校园信息页 */
export default function CampusPage() {
  const [category, setCategory] = useState('全部')
  const { data, loading } = useApi(() => api.notices(), [])
  const notices = data?.notices || []
  const filtered = category === '全部' ? notices : notices.filter((item) => item.category === category)

  return (
    <div className="content-wrap">
      <section className="panel">
        <div className="panel-head">
          <div><h2>校园信息栏</h2><p>讲座、比赛、通知与活动，按分类快速筛选</p></div>
          <div className="scene-tabs compact">
            {CATEGORIES.map((item) => (
              <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
        </div>

        {loading && <p className="empty">加载中…</p>}
        {!loading && filtered.length === 0 && <p className="empty">该分类下暂时没有信息。</p>}

        <div className="notice-list">
          {filtered.map((notice) => (
            <div className="notice-item" key={notice.id}>
              <div className="notice-meta">
                <span className="notice-category">{notice.category}</span>
                <small>{String(notice.publishAt || '').slice(0, 10)}</small>
              </div>
              <div className="notice-body">
                <b>{notice.title}</b>
                <p>{notice.content}</p>
                <span className="notice-source">来源：{notice.source}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}