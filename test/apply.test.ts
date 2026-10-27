import { beforeEach, describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index'

interface Registration {
  name: string
  kind?: string
  key?: string
  id?: string
}

function makeCtx(registrations: Registration[]): any {
  const effect = (fn: () => unknown) => {
    const disposer = fn()
    return typeof disposer === 'function' ? disposer : () => {}
  }
  const slots = {
    register: (options: Registration) => {
      registrations.push(options)
      return () => {}
    },
    inject: (_name: string, cb: () => unknown) => cb(),
  }
  const conversation = { effect, slots }
  const sidebar = {
    effect,
    slots,
    sidebarRightTabs: {
      register: (options: Registration) => {
        registrations.push(options)
        return () => {}
      },
    },
  }
  return {
    effect,
    locale: {
      bind: () => (key: string) => key,
      register: () => () => {},
      getLocale: () => ({ active: 'zh' }),
    },
    get: () => undefined,
    inject: (names: string[], cb: (value: unknown) => void) => {
      cb(names.includes('uiConversation') ? conversation : sidebar)
    },
  }
}

describe('apply wiring', () => {
  beforeEach(() => {
    delete (globalThis as any).dshDesktop
  })

  it('declares the client services it needs', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('takes over the browser kind on Desktop', () => {
    ;(globalThis as any).dshDesktop = { browser: { acquire: () => {}, release: () => {} } }
    const registrations: Registration[] = []
    apply(makeCtx(registrations))
    const takeover = registrations.find((entry) => entry.kind === 'browser')
    expect(takeover).toBeDefined()
    expect(takeover?.id).toBe('dsh-browser-studio/browser')
    const body = registrations.find((entry) => entry.key === 'dsh-browser-studio/browser')
    expect(body?.name).toBe('sidebar.right.pane.tab')
    const dock = registrations.find((entry) => entry.name === 'conversation.input.dock')
    expect(dock?.id).toBe('browser-studio-dock')
  })

  it('leaves the shipped browser alone on Web', () => {
    const registrations: Registration[] = []
    apply(makeCtx(registrations))
    expect(registrations.some((entry) => entry.kind === 'browser')).toBe(false)
    const alias = registrations.find((entry) => entry.kind === 'studio-preview')
    expect(alias).toBeDefined()
  })
})
