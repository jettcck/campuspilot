import React from 'react'

/** 近 7 天学习时长柱状图 */
export function MiniBarChart({ data = [] }) {
  const max = Math.max(...data.map((item) => item.minutes), 60)
  const peak = data.reduce((best, item) => (item.minutes > (best?.minutes || -1) ? item : best), null)
  return (
    <div className="mini-chart">
      {data.map((item) => (
        <div className="bar-wrap" key={item.date || item.label}>
          <div
            className={item === peak && item.minutes > 0 ? 'bar active' : 'bar'}
            style={{ height: `${Math.max((item.minutes / max) * 100, 4)}%` }}
            title={`${item.label}：${item.minutes} 分钟`}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/** 深色卡片里的迷你趋势条 */
export function Sparkline({ values = [] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="sparkline">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${Math.max((value / max) * 100, 12)}%` }} />
      ))}
    </div>
  )
}

/** 学习进度环形图 */
export function ProgressRing({ value = 0, size = 96, label = '' }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(value, 100) / 100) * circumference
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e8ede7" strokeWidth="7" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="#9ccf64" strokeWidth="7" fill="none" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="47%" textAnchor="middle" fontSize="17" fontWeight="700" fill="#31403a">{value}%</text>
      <text x="50%" y="64%" textAnchor="middle" fontSize="9" fill="#9aa59e">{label}</text>
    </svg>
  )
}