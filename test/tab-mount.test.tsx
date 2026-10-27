// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { BrowserBody } from '../src/client/tab'
import { resetHistory } from '../src/client/history'

const SNAPSHOT = { phase: 'ready', items: [{ path: '/repo', sessionIds: ['s1'] }] }

/** jsdom in this runner has no usable localStorage; the component only needs get/set/clear. */
function createStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value))
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => {
      map.clear()
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length(): number {
      return map.size
    },
  }
}

function props(overrides: Record<string, unknown> = {}): any {
  return {
    sessionId: 's1',
    t: (key: string) => key,
    locale: 'zh',
    sendPrompt: async () => {},
    useTabInfo: () => ({ tab: { id: 't1' } }),
    useWorkspaces: (selector: (snapshot: unknown) => unknown) => selector(SNAPSHOT),
    ...overrides,
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: createStorage() })
  resetHistory()
  ;(globalThis as any).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(window as any).requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0)
  ;(window as any).cancelAnimationFrame = (id: number) => window.clearTimeout(id)
})

afterEach(() => {
  cleanup()
  globalThis.localStorage.clear()
  delete (globalThis as any).dshDesktop
})

describe('browser tab mounting', () => {
  it('acquires the guest on first mount, before any address is entered', async () => {
    const acquire = vi.fn(async () => ({ lease: 'lease-1', partition: 'persist:test' }))
    const release = vi.fn(async () => {})
    ;(globalThis as any).dshDesktop = { browser: { acquire, release } }

    const { container } = render(React.createElement(BrowserBody, props()))

    // The start screen must not unmount the guest host: the lease is taken
    // immediately, otherwise a later navigation has nothing to render into.
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(1))
    expect(acquire).toHaveBeenCalledWith('cwd:/repo')
    expect(container.querySelector('webview')).not.toBeNull()

    cleanup()
    await waitFor(() => expect(release).toHaveBeenCalledWith('lease-1'))
  })

  it('falls back to a session-scoped key after the workspace fallback window', async () => {
    vi.useFakeTimers()
    const acquire = vi.fn(async () => ({ lease: 'lease-2', partition: 'persist:test' }))
    ;(globalThis as any).dshDesktop = { browser: { acquire, release: vi.fn(async () => {}) } }

    render(React.createElement(BrowserBody, props({ useWorkspaces: undefined })))
    expect(acquire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(4000)
    vi.useRealTimers()
    await waitFor(() => expect(acquire).toHaveBeenCalledWith('session:s1'))
  })

  it('renders the centered start page with global recents', async () => {
    localStorage.setItem(
      'dsh.browser-studio.v1.recent',
      JSON.stringify(['http://localhost:9000#/pages/consumer/home/index', 'http://localhost:5173/']),
    )
    const { container } = render(React.createElement(BrowserBody, props()))

    await waitFor(() => expect(container.querySelector('.dbs-start')).not.toBeNull())
    expect(container.querySelector('.dbs-startInput')).not.toBeNull()
    expect(container.querySelectorAll('.dbs-recentRow')).toHaveLength(2)
    expect(container.querySelector('.dbs-recentUrl')?.textContent).toBe(
      'localhost:9000#/pages/consumer/home/index',
    )
  })

  it('opens the address menu and clears browsing history', async () => {
    localStorage.setItem(
      'dsh.browser-studio.v1.recent',
      JSON.stringify(['http://localhost:9000#/pages/consumer/home/index']),
    )
    const { container } = render(React.createElement(BrowserBody, props()))
    await waitFor(() => expect(container.querySelector('.dbs-start')).not.toBeNull())

    fireEvent.click(container.querySelector('.dbs-moreBtn') as HTMLButtonElement)
    const rows = Array.from(container.querySelectorAll('.dbs-moreRow'))
    expect(rows.map((row) => row.textContent)).toEqual([
      'menu.screenshot',
      'menu.hardReload',
      'menu.copyUrl',
      'menu.clearHistory',
    ])
    // Empty tab: capture and copy need a page; reload and clear history do not.
    expect((rows[0] as HTMLButtonElement).disabled).toBe(true)
    expect((rows[2] as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(rows[3] as HTMLButtonElement)
    expect(container.querySelectorAll('.dbs-recentRow')).toHaveLength(0)
    expect(localStorage.getItem('dsh.browser-studio.v1.recent')).toBe('[]')
  })

  it('shows page titles and highlights matches in address suggestions', async () => {
    localStorage.setItem(
      'dsh.browser-studio.v1.recent',
      JSON.stringify([
        {
          url: 'http://localhost:9000/#/pages/consumer/home/index',
          title: 'shuangyuan-weapp',
          at: 1,
        },
      ]),
    )
    const { container } = render(React.createElement(BrowserBody, props()))
    const input = container.querySelector('.dbs-addr') as HTMLInputElement

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'local' } })

    await waitFor(() => expect(container.querySelectorAll('.dbs-suggestRow')).toHaveLength(1))
    expect(container.querySelector('.dbs-suggestTitle')?.textContent).toBe('shuangyuan-weapp')
    expect(container.querySelector('.dbs-suggestUrl')?.textContent).toBe(
      'http://localhost:9000/#/pages/consumer/home/index',
    )
    expect(container.querySelector('.dbs-suggestMatch')?.textContent).toBe('local')
  })

  it('moves through history suggestions with arrow keys and opens with Enter', async () => {
    localStorage.setItem(
      'dsh.browser-studio.v1.recent',
      JSON.stringify([
        { url: 'http://localhost:9000/one', title: 'One', at: 1 },
        { url: 'http://localhost:9000/two', title: 'Two', at: 2 },
        { url: 'http://localhost:9000/three', title: 'Three', at: 3 },
      ]),
    )
    const { container } = render(React.createElement(BrowserBody, props()))
    const input = container.querySelector('.dbs-addr') as HTMLInputElement

    fireEvent.focus(input)
    await waitFor(() => expect(container.querySelectorAll('.dbs-suggestRow')).toHaveLength(3))
    const active = (): number =>
      Array.from(container.querySelectorAll('.dbs-suggestRow')).findIndex(
        (row) => row.getAttribute('data-active') === 'true',
      )

    expect(active()).toBe(-1)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(active()).toBe(0)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(active()).toBe(1)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(active()).toBe(0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(active()).toBe(2)
    expect(container.querySelector('.dbs-go')).toBeNull()

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(container.querySelector('.dbs-start')).toBeNull())
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('http://localhost:9000/three')
  })

  it('edits the viewport size, zoom and rulers from the toolbar', async () => {
    const { container } = render(React.createElement(BrowserBody, props()))
    const form = container.querySelector('.dbs-addrWrap') as HTMLFormElement
    const address = container.querySelector('.dbs-addr') as HTMLInputElement
    fireEvent.change(address, { target: { value: 'localhost:9000/phone' } })
    fireEvent.submit(form)

    // The phone icon toggles device emulation; it comes up as an iPhone 15.
    fireEvent.click(container.querySelector('.dbs-deviceBtn') as HTMLButtonElement)
    await waitFor(() => expect(container.querySelector('.dbs-sizeBar')).not.toBeNull())
    const inputs = Array.from(container.querySelectorAll('.dbs-sizeBar .dbs-num')) as HTMLInputElement[]
    expect(inputs).toHaveLength(2)
    expect(inputs.map((input) => input.value)).toEqual(['393', '852'])

    fireEvent.focus(inputs[0])
    fireEvent.change(inputs[0], { target: { value: '412' } })
    fireEvent.focus(inputs[1])
    fireEvent.change(inputs[1], { target: { value: '915' } })
    // The pair commits together when focus leaves the row, not per keystroke.
    fireEvent.focusOut(inputs[1], { relatedTarget: null })

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('dsh.browser-studio.v1.device') as string)).toMatchObject({
        presetId: 'custom',
        width: 412,
        height: 915,
      }),
    )
    expect((container.querySelectorAll('.dbs-sizeBar .dbs-num')[0] as HTMLInputElement).value).toBe('412')

    // Arrow keys nudge the draft, Escape throws it away without touching the device.
    fireEvent.focus(inputs[0])
    fireEvent.keyDown(inputs[0], { key: 'ArrowUp', shiftKey: true })
    expect((container.querySelectorAll('.dbs-sizeBar .dbs-num')[0] as HTMLInputElement).value).toBe('422')
    fireEvent.keyDown(inputs[0], { key: 'Escape' })
    expect((container.querySelectorAll('.dbs-sizeBar .dbs-num')[0] as HTMLInputElement).value).toBe('412')

    fireEvent.click(container.querySelector('.dbs-zoomBtn') as HTMLButtonElement)
    await waitFor(() => expect(container.querySelector('.dbs-zoomMenu')).not.toBeNull())
    const zoomRow = Array.from(container.querySelectorAll('.dbs-zoomRow')).find((row) =>
      row.textContent?.includes('125%'),
    ) as HTMLButtonElement
    fireEvent.click(zoomRow)
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('dsh.browser-studio.v1.device') as string).zoom).toBe(1.25),
    )

    fireEvent.click(container.querySelector('.dbs-rulerBtn') as HTMLButtonElement)
    await waitFor(() => expect(container.querySelector('.dbs-rulers')).not.toBeNull())
    expect(container.querySelectorAll('.dbs-rulerLabel').length).toBeGreaterThan(0)

    // The top ruler pulls out a horizontal guide, the left ruler a vertical one.
    fireEvent.pointerDown(container.querySelector('.dbs-rulerX') as HTMLElement, {
      button: 0,
      pointerId: 7,
      clientX: 40,
      clientY: 120,
    })
    fireEvent.pointerUp(window, { pointerId: 7 })
    await waitFor(() => expect(container.querySelectorAll('.dbs-guideY')).toHaveLength(1))
    fireEvent.pointerDown(container.querySelector('.dbs-rulerY') as HTMLElement, {
      button: 0,
      pointerId: 8,
      clientX: 80,
      clientY: 20,
    })
    fireEvent.pointerUp(window, { pointerId: 8 })
    await waitFor(() => expect(container.querySelectorAll('.dbs-guideX')).toHaveLength(1))

    fireEvent.doubleClick(container.querySelector('.dbs-guideX') as HTMLElement)
    await waitFor(() => expect(container.querySelectorAll('.dbs-guideX')).toHaveLength(0))
  })

  it('switches devices from the size bar dropdown', async () => {
    const { container } = render(React.createElement(BrowserBody, props()))
    const form = container.querySelector('.dbs-addrWrap') as HTMLFormElement
    const address = container.querySelector('.dbs-addr') as HTMLInputElement
    fireEvent.change(address, { target: { value: 'localhost:9000/phone' } })
    fireEvent.submit(form)

    fireEvent.click(container.querySelector('.dbs-deviceBtn') as HTMLButtonElement)
    await waitFor(() => expect(container.querySelector('.dbs-sizeBar')).not.toBeNull())

    // The device name in the size bar is the switcher.
    fireEvent.click(container.querySelector('.dbs-sizeDevice') as HTMLButtonElement)
    await waitFor(() => expect(container.querySelectorAll('.dbs-sizeBar .dbs-menu')).toHaveLength(1))
    const pixel = Array.from(container.querySelectorAll('.dbs-menu .dbs-row')).find((row) =>
      row.textContent?.includes('Pixel 9'),
    ) as HTMLButtonElement
    fireEvent.click(pixel)

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('dsh.browser-studio.v1.device') as string)).toMatchObject({
        presetId: 'pixel-9',
        width: 412,
        height: 924,
      }),
    )
    expect(container.querySelector('.dbs-sizeDevice')?.textContent).toContain('Pixel 9')

    fireEvent.click(container.querySelector('.dbs-deviceBtn') as HTMLButtonElement)
    await waitFor(() => expect(container.querySelector('.dbs-sizeBar')).toBeNull())
  })

  it('keeps picking disabled until a page agent handshakes', async () => {
    const { container } = render(React.createElement(BrowserBody, props()))
    const form = container.querySelector('.dbs-addrWrap') as HTMLFormElement
    const address = container.querySelector('.dbs-addr') as HTMLInputElement
    fireEvent.change(address, { target: { value: 'localhost:9000/plain' } })
    fireEvent.submit(form)

    await waitFor(() => expect(container.querySelector('.dbs-toolBtn')).not.toBeNull())
    const pick = container.querySelector('.dbs-toolBtn') as HTMLButtonElement
    expect(pick.getAttribute('aria-disabled')).toBe('true')
    expect(pick.getAttribute('title')).toContain('pick.needAgent')
  })

  it('forgets the shared entry only when the tab is really closed', () => {
    const forget = vi.fn()
    const storeActions = { replace: vi.fn(), forget }
    const open = render(
      React.createElement(BrowserBody, props({ storeActions, isTabOpen: () => true })),
    )
    open.unmount()
    expect(forget).not.toHaveBeenCalled()

    const closed = render(
      React.createElement(BrowserBody, props({ storeActions, isTabOpen: () => false })),
    )
    closed.unmount()
    expect(forget).toHaveBeenCalledWith('t1')
  })

  it('opens the URL another session put in the shared Browser store', async () => {
    const shared = {
      byTab: {
        t1: { entries: [{ url: 'http://localhost:9000/shared', title: 'Shared' }], index: 0 },
      },
    }
    const useStore = (selector: (state: typeof shared) => unknown): unknown => selector(shared)
    const { container } = render(React.createElement(BrowserBody, props({ useStore })))

    await waitFor(() =>
      expect(container.querySelector('iframe')?.getAttribute('src')).toBe('http://localhost:9000/shared'),
    )
  })

  it('publishes a typed address into the shared Browser store', async () => {
    const replace = vi.fn()
    const { container } = render(
      React.createElement(
        BrowserBody,
        props({ storeActions: { replace, forget: vi.fn() } }),
      ),
    )
    const form = container.querySelector('.dbs-addrWrap') as HTMLFormElement
    const input = container.querySelector('.dbs-addr') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'localhost:9000/new' } })
    fireEvent.submit(form)

    expect(replace).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        entries: [{ url: 'http://localhost:9000/new', title: '' }],
        index: 0,
      }),
    )
  })

  it('mirrors new history across mounted browser tabs', async () => {
    localStorage.setItem(
      'dsh.browser-studio.v1.recent',
      JSON.stringify([{ url: 'http://localhost:9000/old', title: 'Old', at: 1 }]),
    )
    const { container } = render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(BrowserBody, props()),
        React.createElement(
          BrowserBody,
          props({ sessionId: 's2', useTabInfo: () => ({ tab: { id: 't2' } }) }),
        ),
      ),
    )

    await waitFor(() => expect(container.querySelectorAll('.dbs-recentRow')).toHaveLength(2))

    const forms = container.querySelectorAll('.dbs-addrWrap')
    const inputs = container.querySelectorAll('.dbs-addr')
    fireEvent.change(inputs[0], { target: { value: 'localhost:9000/new' } })
    fireEvent.submit(forms[0])

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('.dbs-recentUrl')).map((node) => node.textContent)
      expect(labels).toEqual(['localhost:9000/new', 'localhost:9000/old'])
    })
  })
})
