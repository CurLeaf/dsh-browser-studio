import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { ComposerDock } from '../../src/client/index'
import { addPendingRef, removePendingRef } from '../../src/client/bridge'
import { ZH } from '../../src/client/i18n'
import { CSS } from '../../src/client/styles'

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

const t = (key: string): string => ZH[key] ?? key

addPendingRef('preview', {
  n: 1,
  tag: '⟦元素1⟧',
  label: 'button#submit.btn.primary',
  detail: '〔网页元素 1〕…',
})
addPendingRef('preview', {
  n: 2,
  tag: '⟦元素2⟧',
  label: 'div.product-card:nth-of-type(2)',
  detail: '〔网页元素 2〕…',
})

function DockPreview(): React.ReactElement {
  React.useEffect(() => {
    void removePendingRef
  }, [])
  return (
    <div className="composer">
      <ComposerDock
        sessionId="preview"
        t={t}
        input={{ draft: '把这两个卡片的圆角改小一点 ' }}
        inputActions={{ setDraft: () => {} }}
      />
      <div className="composerBox">
        <span className="composerText">把这两个卡片的圆角改小一点</span>
        <span className="composerSend">↑</span>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<DockPreview />)
