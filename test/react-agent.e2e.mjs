#!/usr/bin/env node
/** Checks the React part of the page agent (component name / source) against a dev React build. */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const agentSource = readFileSync('src/generated/agent-bundle.ts', 'utf8')
const AGENT_BOOT = JSON.parse(agentSource.slice(agentSource.indexOf('=') + 1, agentSource.lastIndexOf('\n')))

const server = createServer((req, res) => {
  const url = req.url ?? '/'
  if (url === '/' || url === '/react.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(readFileSync('test/fixture/react.html'))
    return
  }
  if (url === '/react-app.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
    res.end(readFileSync('test/fixture/react-app.js'))
    return
  }
  res.writeHead(404)
  res.end('nope')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
await page.goto(`http://127.0.0.1:${port}/`)
await page.waitForSelector('#submit')

await page.evaluate(AGENT_BOOT)
await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('pick', true)`)
await page.click('#submit')
await page.waitForTimeout(120)
const drained = await page.evaluate(`window.__DSH_STUDIO_AGENT__.call('drain')`)
const pick = drained.events.find((event) => event.kind === 'pick')
if (!pick) throw new Error(`no pick: ${JSON.stringify(drained)}`)
console.log('react info:', JSON.stringify(pick.ref.react))
if (!pick.ref.react || !pick.ref.react.name) {
  throw new Error('React component name was not detected')
}
await browser.close()
server.close()
console.log('react agent e2e: ok')
