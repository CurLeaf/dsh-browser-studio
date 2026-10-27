/**
 * Cross-origin web-bridge acceptance test.
 *
 * The page is served from 127.0.0.1:4211 (the "dev server") and loads the
 * agent bundle from 127.0.0.1:4212 (the "studio host"). The harness on 4212
 * does the hello handshake, enables picking, clicks the page element and
 * drains the event — the same path the Web browser tab uses.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const AGENT = readFileSync('lib/agent.js', 'utf8')

const demoHtml = `<!doctype html><html><head><meta charset="utf-8"><title>demo</title>
<style>body{margin:0;font:16px system-ui;padding:40px}button{padding:12px 18px;font:inherit}</style>
</head><body>
<h1>Target page</h1>
<button id="pick-me" class="cta">Add to cart</button>
<script src="http://127.0.0.1:4212/browser-studio/agent.js"></script>
</body></html>`

const parentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>parent</title></head><body>
<iframe id="frame" src="http://127.0.0.1:4211/demo.html" style="width:420px;height:640px"></iframe>
<script>
  const TOKEN = 'e2e-token'
  const frame = document.getElementById('frame')
  const pending = new Map()
  let seq = 0
  window.__EVENTS__ = []
  window.__BRIDGE_READY__ = false
  window.__ERRORS__ = []

  function post(message) {
    try { frame.contentWindow.postMessage({ __dbs: true, ...message }, '*') } catch (error) { window.__ERRORS__.push(String(error)) }
  }
  function greet() { post({ type: 'hello', token: TOKEN, version: 1 }) }
  function call(cmd, arg) {
    return new Promise((resolve) => {
      const id = 'r' + (++seq)
      pending.set(id, resolve)
      post({ id, token: TOKEN, cmd, arg })
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null) } }, 1500)
    })
  }

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return
    const data = event.data
    if (!data || data.__dbs !== true) return
    if (data.type === 'ready') { window.__BRIDGE_READY__ = true; return }
    if (typeof data.id === 'string' && pending.has(data.id)) {
      pending.get(data.id)(data)
      pending.delete(data.id)
    }
  })
  frame.addEventListener('load', greet)
  setInterval(greet, 400)

  let polling = false
  async function poll() {
    if (!window.__BRIDGE_READY__ || polling) return
    polling = true
    const result = await call('drain')
    const events = result && result.result && result.result.events ? result.result.events : []
    if (events.length > 0) window.__EVENTS__.push(...events)
    polling = false
  }
  setInterval(poll, 150)
  window.__startPicking__ = () => call('pick', true)
</script></body></html>`

function serve(port, routes) {
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0]
    const route = routes[path]
    if (route === undefined) {
      response.writeHead(404)
      response.end('not found')
      return
    }
    response.writeHead(200, { 'content-type': route.type, 'cache-control': 'no-store' })
    response.end(route.body)
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

const demo = await serve(4211, {
  '/demo.html': { type: 'text/html; charset=utf-8', body: demoHtml },
})
const studio = await serve(4212, {
  '/parent.html': { type: 'text/html; charset=utf-8', body: parentHtml },
  '/browser-studio/agent.js': { type: 'text/javascript; charset=utf-8', body: AGENT },
})

const browser = await chromium.launch({ channel: 'chrome', headless: true })
let failed = false
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } })
  page.on('pageerror', (error) => console.log('pageerror:', error.message))
  await page.goto('http://127.0.0.1:4212/parent.html')
  await page.waitForFunction(() => window.__BRIDGE_READY__ === true, null, { timeout: 8000 })
  console.log('handshake: online')

  await page.evaluate(() => window.__startPicking__())
  const frame = page.frameLocator('#frame')
  await frame.locator('#pick-me').click()
  await page.waitForFunction(
    () => window.__EVENTS__.some((event) => event.kind === 'pick' && event.ref && event.ref.selector === '#pick-me'),
    null,
    { timeout: 8000 },
  )
  const picked = await page.evaluate(() => window.__EVENTS__.find((event) => event.kind === 'pick'))
  console.log('pick:', JSON.stringify({ selector: picked.ref.selector, text: picked.ref.text, url: picked.ref.pageUrl }))
  if (!String(picked.ref.pageUrl).includes('127.0.0.1:4211')) failed = true

  const errors = await page.evaluate(() => window.__ERRORS__)
  if (errors.length > 0) {
    console.log('errors:', JSON.stringify(errors))
    failed = true
  }
  console.log(failed ? 'web-bridge e2e: FAILED' : 'web-bridge e2e: ok')
} catch (error) {
  failed = true
  console.log('web-bridge e2e: FAILED —', error.message)
} finally {
  await browser.close()
  await new Promise((resolve) => demo.close(resolve))
  await new Promise((resolve) => studio.close(resolve))
}

if (failed) process.exit(1)
