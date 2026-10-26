import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright-core'

const root = 'test/preview'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const file = path === '/' ? 'index.html' : path.slice(1)
  try {
    const body = readFileSync(join(root, file))
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('nope')
  }
})
await new Promise((r) => server.listen(4199, '127.0.0.1', r))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const shots = [
  { name: 'responsive-380', width: 380, query: '', menu: false },
  { name: 'frame-380', width: 380, query: '?preset=iphone-15&frame=1', menu: false },
  { name: 'menu-380', width: 380, query: '?preset=iphone-15&frame=1', menu: true },
  { name: 'frame-320', width: 320, query: '?preset=iphone-15&frame=1', menu: false },
  { name: 'start-380', width: 380, query: '?url=', menu: false },
  { name: 'start-320', width: 320, query: '?url=', menu: false },
  { name: 'start-620', width: 620, query: '?url=', menu: false },
]
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width + 40, height: 820 }, deviceScaleFactor: 2 })
  await page.goto(`http://127.0.0.1:4199/${shot.query}`)
  await page.waitForTimeout(900)
  if (shot.menu) {
    await page.click('.dbs-deviceChip')
    await page.waitForTimeout(250)
  }
  await page.screenshot({ path: `${root}/shot-${shot.name}.png` })
  await page.close()
}
await browser.close()
server.close()
console.log('shots ok')
