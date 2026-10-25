import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright-core'
const root = 'test/preview'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const file = path === '/' ? 'pop.html' : path.slice(1)
  try { const body = readFileSync(join(root, file)); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body) }
  catch { res.writeHead(404); res.end('nope') }
})
await new Promise((r) => server.listen(4197, '127.0.0.1', r))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 640, height: 460 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4197/')
await page.waitForTimeout(400)
await page.screenshot({ path: 'test/preview/shot-pop.png' })
await browser.close(); server.close(); console.log('pop shot ok')
