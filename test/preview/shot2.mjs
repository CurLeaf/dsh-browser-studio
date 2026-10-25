import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright-core'
const root = 'test/preview'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const file = path === '/' ? 'index.html' : path.slice(1)
  try { const body = readFileSync(join(root, file)); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body) }
  catch { res.writeHead(404); res.end('nope') }
})
await new Promise((r) => server.listen(4199, '127.0.0.1', r))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 420, height: 820 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4199/?preset=iphone-15&frame=1')
await page.waitForTimeout(1500)
await page.screenshot({ path: 'test/preview/shot-frame.png' })
await page.click('.dbs-deviceChip')
await page.waitForTimeout(250)
await page.screenshot({ path: 'test/preview/shot-menu.png' })
await browser.close(); server.close(); console.log('ok')
