/**
 * Parent-side half of the cross-origin bridge.
 *
 * The previewed page loads `/browser-studio/agent.js`; this channel talks to it
 * over `postMessage`. Every message is filtered by source window, and a command
 * only runs after the agent answered the hello handshake.
 */
import { BRIDGE_VERSION, type BridgeReady, type BridgeResponse } from '../shared/bridge'

export interface WebAgentOptions {
  getFrame: () => HTMLIFrameElement | null
  token: string
  timeoutMs?: number
  onReady?: () => void
  onReset?: () => void
}

export interface WebAgent {
  /** Send the hello handshake; the agent answers with ready. */
  greet(): void
  /** Drop readiness after the frame navigates; the next greet re-handshakes. */
  reset(): void
  call<T>(cmd: string, arg?: unknown): Promise<T | null>
  dispose(): void
}

export function createWebAgent(options: WebAgentOptions): WebAgent {
  const timeoutMs = options.timeoutMs ?? 1500
  const pending = new Map<string, (value: unknown) => void>()
  let ready = false
  let seq = 0

  const target = (): Window | null => options.getFrame()?.contentWindow ?? null

  const post = (message: Record<string, unknown>): boolean => {
    const frame = target()
    if (frame === null) return false
    try {
      frame.postMessage({ __dbs: true, ...message }, '*')
      return true
    } catch {
      return false
    }
  }

  const settle = (id: string, value: unknown): void => {
    const resolve = pending.get(id)
    if (resolve === undefined) return
    pending.delete(id)
    resolve(value)
  }

  const onMessage = (event: MessageEvent): void => {
    const frame = target()
    if (frame === null || event.source !== frame) return
    const data = event.data as (Partial<BridgeReady & BridgeResponse> & { __dbs?: unknown }) | null
    if (typeof data !== 'object' || data === null || data.__dbs !== true) return

    if (data.type === 'ready') {
      if (typeof data.version === 'number' && data.version !== BRIDGE_VERSION) return
      ready = true
      options.onReady?.()
      return
    }
    if (typeof data.id === 'string') {
      settle(data.id, data.ok === true ? (data.result ?? null) : null)
    }
  }

  window.addEventListener('message', onMessage)

  return {
    greet(): void {
      post({ type: 'hello', token: options.token, version: BRIDGE_VERSION })
    },
    reset(): void {
      ready = false
      options.onReset?.()
    },
    call<T>(cmd: string, arg?: unknown): Promise<T | null> {
      if (!ready) return Promise.resolve(null)
      const id = `r${(seq += 1)}`
      return new Promise<T | null>((resolve) => {
        pending.set(id, (value) => resolve(value as T | null))
        if (!post({ id, token: options.token, cmd, arg })) {
          pending.delete(id)
          resolve(null)
          return
        }
        window.setTimeout(() => settle(id, null), timeoutMs)
      })
    },
    dispose(): void {
      window.removeEventListener('message', onMessage)
      for (const resolve of pending.values()) resolve(null)
      pending.clear()
    },
  }
}
