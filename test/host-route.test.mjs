import { describe, expect, it } from 'vitest'
import { apply, buildContextText, normalizeBlocks } from '../index.js'

function makeContext() {
  const captured = { routes: [], route: null, hook: null }
  const ctx = {
    get: (name) => (name === 'webServer' ? { register: (route) => {
      captured.routes.push(route)
      if (route.path === '/browser-studio/api/refs') captured.route = route
      return () => {}
    } } : undefined),
    effect: (fn) => {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    on: (name, handler) => {
      if (name === 'agent/pre-step') captured.hook = handler
      return () => {}
    },
  }
  apply(ctx)
  return captured
}

function makeRequest(body, origin = 'http://127.0.0.1:5199') {
  return {
    method: 'POST',
    headers: { origin, host: '127.0.0.1:5199', 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body))
    },
  }
}

async function callRoute(route, request) {
  const response = {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status
    },
    end(data) {
      this.body = data ?? ''
    },
  }
  await route.handler(request, response)
  return { status: response.status, body: response.body === '' ? null : JSON.parse(response.body) }
}

describe('host refs route + hidden context', () => {
  it('stores a posted list and injects it once on the next step', async () => {
    const { route, hook } = makeContext()
    expect(route).not.toBeNull()
    const posted = await callRoute(route, makeRequest({ sessionId: 's1', blocks: ['BLOCK A', 'BLOCK B'] }))
    expect(posted.status).toBe(200)
    expect(posted.body).toEqual({ ok: true, count: 2 })

    const next = async () => ({ kind: 'enter', messages: [{ id: 'u1' }] })
    const decision = await hook({ agent: { id: 's1' }, messages: [] }, next)
    expect(decision.kind).toBe('enter')
    expect(decision.messages).toHaveLength(2)
    const injected = decision.messages[1]
    expect(injected.source).toEqual({ kind: 'browser-studio' })
    expect(injected.content[0].text).toContain('BLOCK A')
    expect(injected.content[0].text).toContain('不可信')

    const again = await hook({ agent: { id: 's1' }, messages: [] }, next)
    expect(again.messages).toHaveLength(1)
  })

  it('refuses cross-origin posts', async () => {
    const { route } = makeContext()
    const refused = await callRoute(route, makeRequest({ sessionId: 's1', blocks: ['X'] }, 'https://evil.example'))
    expect(refused.status).toBe(403)
  })

  it('rejects malformed bodies', async () => {
    const { route } = makeContext()
    const bad = await callRoute(route, makeRequest({ sessionId: 's1', blocks: 'nope' }))
    expect(bad.status).toBe(400)
  })

  it('serves the page agent bundle for the web bridge', async () => {
    const { routes } = makeContext()
    const agentRoute = routes.find((entry) => entry.path === '/browser-studio/agent.js')
    expect(agentRoute).toBeTruthy()

    const response = {
      status: 0,
      headers: {},
      body: '',
      writeHead(status, headers = {}) {
        this.status = status
        this.headers = headers
      },
      end(data) {
        this.body = data ?? ''
      },
    }
    await agentRoute.handler({ method: 'GET', headers: {} }, response)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/javascript')
    expect(response.headers['access-control-allow-origin']).toBe('*')
    expect(String(response.body)).toContain('__DSH_STUDIO_AGENT__')
  })

  it('rejects non-GET requests for the agent bundle', async () => {
    const { routes } = makeContext()
    const agentRoute = routes.find((entry) => entry.path === '/browser-studio/agent.js')
    const response = {
      status: 0,
      headers: {},
      body: '',
      writeHead(status, headers = {}) {
        this.status = status
        this.headers = headers
      },
      end(data) {
        this.body = data ?? ''
      },
    }
    await agentRoute.handler({ method: 'POST', headers: {} }, response)
    expect(response.status).toBe(405)
  })

  it('keeps helpers importable for unit use', () => {
    expect(normalizeBlocks({ sessionId: 's1', blocks: ['a'] }).blocks).toEqual(['a'])
    expect(buildContextText(['a'])).toContain('a')
  })
})
