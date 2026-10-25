// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { BrowserBody } from '../src/client/tab'

const SNAPSHOT = { phase: 'ready', items: [{ path: '/repo', sessionIds: ['s1'] }] }

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
})
