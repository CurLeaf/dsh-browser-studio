import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { CSS } from '../../src/client/styles'

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

const Link = (): React.ReactElement => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6.6 9.4 9.4 6.6" />
    <path d="M7.4 5.1 8.8 3.7a2.5 2.5 0 0 1 3.5 3.5L10.9 8.6" />
    <path d="M8.6 10.9 7.2 12.3a2.5 2.5 0 0 1-3.5-3.5l1.4-1.4" />
  </svg>
)
const Arrow = (): React.ReactElement => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h9" />
    <path d="M8.5 4.5 12 8l-3.5 3.5" />
  </svg>
)

function Mock(): React.ReactElement {
  return (
    <div className="page">
      <h1>画布与多人协作</h1>
      <p className="lead">在任务里直接构建交互式画布，完成后发链接给团队。</p>
      <div className="outline">画布构建完成后，只需发送链接即可与团队共享。</div>
      <div className="card">
        <b>Your team sees</b>
        <div className="metric">3.4 s <span>p75 page load</span></div>
        <div className="metric">2.9 s <span>p75 largest contentful paint</span></div>
      </div>

      <div className="dbs-pop" style={{ left: 210, top: 150, width: 340 }}>
        <div className="dbs-popHead">
          <span className="dbs-popKicker">批注</span>
          <span className="dbs-popTarget">div.outline</span>
          <button className="dbs-popClose">×</button>
        </div>
        <div className="dbs-popRow">
          <span className="dbs-popLink"><Link /></span>
          <input className="dbs-popInput" placeholder="描述修改…" />
          <button className="dbs-popSend"><Arrow /></button>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<Mock />)
