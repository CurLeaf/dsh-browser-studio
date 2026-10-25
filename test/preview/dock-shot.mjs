import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright-core'
const root = 'test/preview'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const file = path === '/' ? 'dock.html' : path.slice(1)
  try { const body = readFileSync(join(root, file)); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body) }
  catch { res.writeHead(404); res.end('nope') }
})
await new Promise((r) => server.listen(4198, '127.0.0.1', r))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 700, height: 260 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4198/')
await page.waitForTimeout(500)
await page.screenshot({ path: 'test/preview/shot-dock.png' })
await browser.close(); server.close(); console.log('dock shot ok')
