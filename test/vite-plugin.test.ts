import { describe, expect, it } from 'vitest'
import dshStudioAgent from '../src/vite/index'

const html = '<!doctype html><html><head></head><body></body></html>'
const run = (plugin: ReturnType<typeof dshStudioAgent>, page = html): unknown =>
  (plugin.transformIndexHtml as unknown as (markup: string, ctx: object) => unknown)(page, {})

describe('vite agent plugin', () => {
  it('is serve-only', () => {
    expect(dshStudioAgent().apply).toBe('serve')
  })

  it('injects a deferred script into head', () => {
    expect(run(dshStudioAgent({ origin: 'http://127.0.0.1:3080/' }))).toEqual([
      {
        tag: 'script',
        attrs: { src: 'http://127.0.0.1:3080/browser-studio/agent.js', defer: true },
        injectTo: 'head',
      },
    ])
  })

  it('skips a page that already carries the agent', () => {
    const plugin = dshStudioAgent({ origin: 'http://127.0.0.1:3080' })
    const page = html.replace(
      '</head>',
      '<script src="http://127.0.0.1:3080/browser-studio/agent.js"></script></head>',
    )
    expect(run(plugin, page)).toBe(page)
  })

  it('honours DSH_STUDIO_URL and a custom path', () => {
    process.env.DSH_STUDIO_URL = 'http://127.0.0.1:3999/'
    try {
      const tags = run(dshStudioAgent({ path: 'custom/agent.js' })) as Array<{ attrs: { src: string } }>
      expect(tags[0].attrs.src).toBe('http://127.0.0.1:3999/custom/agent.js')
    } finally {
      delete process.env.DSH_STUDIO_URL
    }
  })
})
