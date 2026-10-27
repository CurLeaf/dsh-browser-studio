import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserBody } from '../../src/client/tab'
import { ZH } from '../../src/client/i18n'
import { PRESET_BY_ID } from '../../src/client/presets'
import { CSS } from '../../src/client/styles'

const t = (key: string): string => ZH[key] ?? key
const params = new URLSearchParams(location.search)
const url = params.get('url') ?? 'http://127.0.0.1:4199/demo.html'

if (localStorage.getItem('dsh.browser-studio.v1.recent') === null) {
  const title = 'shuangyuan-weapp'
  localStorage.setItem(
    'dsh.browser-studio.v1.recent',
    JSON.stringify([
      { url: 'http://localhost:9000/#/pages/consumer/home/index', title, at: 1 },
      { url: 'http://localhost:9000/#/pages/consumer/product-search/index', title, at: 2 },
      { url: 'http://localhost:9000/#/pages/consumer/profile/index', title, at: 3 },
      { url: 'http://localhost:9000/#/', title, at: 4 },
      { url: 'http://localhost:9000', title, at: 5 },
    ]),
  )
}

const presetId = params.get('preset')
const preset = presetId === null ? undefined : PRESET_BY_ID.get(presetId)
if (preset !== undefined) {
  localStorage.setItem(
    'dsh.browser-studio.v1.device',
    JSON.stringify({
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      zoom: 'fit',
      uaMobile: preset.mobile,
      frame: params.get('frame') === '1',
      portrait: true,
    }),
  )
}

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

function Preview(): React.ReactElement {
  return (
    <div className="preview">
      <BrowserBody
        sessionId="preview"
        t={t}
        locale="zh"
        sendPrompt={async () => {}}
        useTabInfo={() => ({ tab: { id: 'preview', navigation: { params: { url } } } })}
      />
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<Preview />)
