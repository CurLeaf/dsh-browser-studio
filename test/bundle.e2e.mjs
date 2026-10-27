#!/usr/bin/env node
/**
 * Loads the built client bundle in Chromium with a stub module loader and a
 * minimal React, then runs apply() against a mocked Cordis context.
 * Catches build/wrapper/runtime mistakes that unit tests cannot see.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const client = readFileSync('lib/client.js', 'utf8')
const server = createServer((req, res) => {
  if (req.url === '/client.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
    res.end(client)
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end('<!doctype html><html><body><script src="/client.js"></script></body></html>')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
await page.addInitScript(() => {
  const React = {
    createElement: () => null,
    Fragment: {},
    memo: (value) => value,
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn,
  }
  const defineStore = (options) => ({
    spec: { persist: options.persist },
    create: () => ({}),
  })
  window.__ModuleLoader__ = {
    load: (entry) => {
      window.__PLUGIN__ = entry.factory((name) =>
        name === 'react'
          ? React
          : name === '@deepseek-ai/dsh-client-store'
            ? { defineStore }
            : {},
      )
    },
  }
})

await page.goto(`http://127.0.0.1:${port}/`)
const loaded = await page.evaluate(() => ({
  hasApply: typeof window.__PLUGIN__?.apply === 'function',
  inject: window.__PLUGIN__?.inject,
}))
if (!loaded.hasApply) throw new Error(`bundle did not export apply: ${JSON.stringify(loaded)}`)
if (JSON.stringify(loaded.inject) !== JSON.stringify(['slots', 'sessions', 'locale'])) {
  throw new Error(`unexpected inject list: ${JSON.stringify(loaded.inject)}`)
}

const registrations = await page.evaluate(() => {
  const registrations = []
  const effect = (fn) => {
    const disposer = fn()
    return typeof disposer === 'function' ? disposer : () => {}
  }
  const slots = {
    register: (options) => {
      registrations.push(options)
      return () => {}
    },
    inject: (_name, cb) => cb(),
  }
  const conversation = { effect, slots }
  const sidebar = {
    effect,
    slots,
    sidebarRightTabs: {
      register: (options) => {
        registrations.push(options)
        return () => {}
      },
    },
  }
  const ctx = {
    effect,
    locale: { bind: () => (key) => key, register: () => () => {}, getLocale: () => ({ active: 'zh' }) },
    get: () => undefined,
    inject: (names, cb) => cb(names.includes('uiConversation') ? conversation : sidebar),
  }
  window.dshDesktop = { browser: { acquire: () => {}, release: () => {} } }
  window.__PLUGIN__.apply(ctx)
  delete window.dshDesktop
  return registrations.map((entry) => ({
    name: entry.name,
    kind: entry.kind,
    key: entry.key,
    id: entry.id,
    store: entry.store !== undefined,
  }))
})
if (!registrations.some((entry) => entry.kind === 'browser')) {
  throw new Error(`takeover was not registered: ${JSON.stringify(registrations)}`)
}
const body = registrations.find((entry) => entry.key === 'dsh-browser-studio/browser')
if (body?.store !== true) throw new Error(`browser body did not register the shared store: ${JSON.stringify(body)}`)
if (errors.length > 0) throw new Error(`page errors: ${errors.join(' | ')}`)

await browser.close()
server.close()
console.log('bundle e2e: ok', JSON.stringify(registrations.map((r) => r.kind ?? r.name)))
