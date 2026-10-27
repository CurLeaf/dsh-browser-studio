import { describe, expect, it } from 'vitest'
import dshStudioAgent from '../src/vite/index'
import { AGENT_LOADER, AGENT_PATH } from '../src/shared/agent-loader'

const html = '<!doctype html><html><head></head><body></body></html>'
const run = (plugin: ReturnType<typeof dshStudioAgent>, page = html): unknown =>
  (plugin.transformIndexHtml as unknown as (markup: string, ctx: object) => unknown)(page, {})

describe('vite agent plugin', () => {
  it('is serve-only', () => {
    expect(dshStudioAgent().apply).toBe('serve')
  })

  it('injects the referrer loader by default', () => {
    expect(run(dshStudioAgent({ origin: '' }))).toEqual([
      { tag: 'script', children: AGENT_LOADER, injectTo: 'head' },
    ])
    expect(AGENT_LOADER).toContain(AGENT_PATH)
    expect(AGENT_LOADER).toContain('ancestorOrigins')
    expect(AGENT_LOADER).toContain('document.referrer')
  })

  it('injects a direct script when an origin is configured', () => {
    expect(run(dshStudioAgent({ origin: 'http://127.0.0.1:3080/' }))).toEqual([
      {
        tag: 'script',
        attrs: { src: 'http://127.0.0.1:3080/browser-studio/agent.js', defer: true },
        injectTo: 'head',
      },
    ])
  })

  it('skips a page that already carries the agent', () => {
    const plugin = dshStudioAgent()
    const page = html.replace('</head>', '<script src="/browser-studio/agent.js"></script></head>')
    expect(run(plugin, page)).toBe(page)
  })

  it('honours DSH_STUDIO_URL', () => {
    process.env.DSH_STUDIO_URL = 'http://127.0.0.1:3999/'
    try {
      const tags = run(dshStudioAgent()) as Array<{ attrs?: { src: string } }>
      expect(tags[0].attrs?.src).toBe('http://127.0.0.1:3999/browser-studio/agent.js')
    } finally {
      delete process.env.DSH_STUDIO_URL
    }
  })
})
