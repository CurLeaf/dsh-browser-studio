#!/usr/bin/env node
/**
 * M0 spike: proves the three assumptions the plugin's device toolbar rests on,
 * against the same Electron major DSH Desktop ships (44.7):
 *   1. <webview> can be sized and CSS-transformed (fit scaling),
 *   2. transformed input still lands on the intended guest element,
 *   3. executeJavaScript / setUserAgent work on the guest.
 */
import { _electron as electron } from 'playwright-core'

// The harness shell may export ELECTRON_RUN_AS_NODE=1, which turns Electron into
// plain Node and hides the app module.
delete process.env.ELECTRON_RUN_AS_NODE

const app = await electron.launch({ args: ['test/electron/main.cjs'] })
const host = await app.firstWindow()
await host.waitForLoadState('domcontentloaded')

await host.waitForFunction(() => {
  const view = document.querySelector('#guest')
  return view && typeof view.getURL === 'function' && view.getURL().includes('guest.html')
}, null, { timeout: 15000 })
await host.waitForTimeout(400)

const hostState = await host.evaluate(() => window.__hostState())
const viewport = await host.evaluate(`document.getElementById('guest').executeJavaScript('window.__probeState()', false)`)
if (viewport.w !== 400 || viewport.h !== 300) throw new Error(`guest viewport is not its CSS box: ${JSON.stringify(viewport)}`)

// Visible box of the transformed webview: 200x150 at (100,100).
const expected = { x: 100, y: 100, w: 200, h: 150 }
for (const key of ['x', 'y', 'w', 'h']) {
  const actual = hostState.rect[key]
  if (Math.abs(actual - expected[key]) > 2) {
    throw new Error(`transform was not applied: rect ${JSON.stringify(hostState.rect)}`)
  }
}

// The probe sits at guest (300,200) => host (250,200). Click its transformed centre.
await host.mouse.click(270, 220)
await host.waitForTimeout(300)
const afterClick = await host.evaluate(`document.getElementById('guest').executeJavaScript('window.__probeState()', false)`)
if (afterClick.clicks !== 1) throw new Error(`transformed input missed the probe: ${JSON.stringify(afterClick)}`)

// A point that would only hit the probe without scaling must not click it.
await host.mouse.click(420, 320)
await host.waitForTimeout(200)
const afterMiss = await host.evaluate(`document.getElementById('guest').executeJavaScript('window.__probeState()', false)`)
if (afterMiss.clicks !== 1) throw new Error(`unscaled coordinates hit the probe: ${JSON.stringify(afterMiss)}`)

await host.evaluate(`document.getElementById('guest').setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1')`)
await host.evaluate(`document.getElementById('guest').reload()`)
await host.waitForTimeout(800)
await host.waitForFunction(() => {
  const view = document.querySelector('#guest')
  return view && typeof view.getURL === 'function' && view.getURL().includes('guest.html')
}, null, { timeout: 15000 })
const uaState = await host.evaluate(`document.getElementById('guest').executeJavaScript('window.__probeState()', false)`)
if (!uaState.ua.includes('iPhone')) throw new Error(`UA override failed: ${JSON.stringify(uaState)}`)

await host.screenshot({ path: 'test/electron/spike.png' })
await app.close()
console.log('electron spike: ok', JSON.stringify({ rect: hostState.rect, viewport, ua: uaState.ua.slice(0, 40) }))
