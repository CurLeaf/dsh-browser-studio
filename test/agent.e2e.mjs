#!/usr/bin/env node
/**
 * Page-agent E2E: runs the built agent bundle in a real Chromium and checks
 * picking, the payload and the capture-phase guard.
 *
 *   node scripts/build-agent.mjs && node test/agent.e2e.mjs
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const agentSource = readFileSync('src/generated/agent-bundle.ts', 'utf8')
const AGENT_BOOT = JSON.parse(agentSource.slice(agentSource.indexOf('=') + 1, agentSource.lastIndexOf('\n')))

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(readFileSync('test/fixture/index.html'))
    return
  }
  res.writeHead(404)
  res.end('nope')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
await page.goto(`http://127.0.0.1:${port}/`)

await page.evaluate(AGENT_BOOT)
const ping = await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('ping')`)
if (!ping || ping.ok !== true) throw new Error(`agent ping failed: ${JSON.stringify(ping)}`)

await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('pick', true)`)
await page.hover('#submit')
await page.click('#submit')

const drained = await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('drain')`)
const pick = drained.events.find((event) => event.kind === 'pick')
if (!pick) throw new Error(`no pick event: ${JSON.stringify(drained)}`)
const ref = pick.ref
const checks = [
  ['tag', ref.tag === 'button'],
  ['text', ref.text.includes('提交订单')],
  ['selector', typeof ref.selector === 'string' && ref.selector.length > 0],
  ['domPath', ref.domPath.includes('button#submit')],
  ['attrs', ref.attrs['data-testid'] === 'submit-order'],
  ['styles', typeof ref.styles['border-radius'] === 'string'],
  ['rect', ref.rect.w > 10 && ref.rect.h > 10],
  ['untrusted page url', ref.pageUrl.includes(`127.0.0.1:${port}`)],
]
for (const [name, ok] of checks) if (!ok) throw new Error(`check failed: ${name} ${JSON.stringify(ref)}`)

const pageClicks = await page.evaluate('window.__pageClicks')
if (pageClicks !== 0) throw new Error(`the page received the picking click (${pageClicks})`)

const rect = await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('rect', ${JSON.stringify(ref.selector)})`)
if (rect === null || rect.w < 10 || rect.h < 10) throw new Error(`rect failed: ${JSON.stringify(rect)}`)

const highlightOn = await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('highlight', ${JSON.stringify(ref.selector)})`)
const boxShown = await page.evaluate(`document.querySelector('[data-dsh-studio-host]').shadowRoot.querySelector('[data-dbs-box]').style.display`)
if (!highlightOn.ok || boxShown !== 'block') throw new Error(`highlight failed: ${JSON.stringify({ highlightOn, boxShown })}`)
await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('highlight', null)`)
const boxHidden = await page.evaluate(`document.querySelector('[data-dsh-studio-host]').shadowRoot.querySelector('[data-dbs-box]').style.display`)
if (boxHidden !== 'none') throw new Error(`highlight did not clear: ${boxHidden}`)

await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('pins', ${JSON.stringify([{ n: 1, selector: ref.selector }])})`)
const pins = await page.evaluate(`document.querySelector('[data-dsh-studio-host]').shadowRoot.querySelectorAll('div').length`)
if (pins < 3) throw new Error(`pins were not painted (${pins})`)

await page.keyboard.press('Escape')
const afterEsc = await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('drain')`)
if (!afterEsc.events.some((event) => event.kind === 'esc')) throw new Error('escape was not reported')

// Picking must be off after Escape: a plain click reaches the page again.
await page.click('#submit')
const clicksAfterEscape = await page.evaluate('window.__pageClicks')
if (clicksAfterEscape !== 1) throw new Error(`picking did not stop (${clicksAfterEscape})`)

if (errors.length > 0) throw new Error(`page errors: ${errors.join(' | ')}`)

await browser.close()
server.close()
console.log('agent e2e: ok')
