/**
 * Page-side half of the cross-origin bridge.
 *
 * Installed only when the agent script runs inside a frame (`window.parent !==
 * window`). Everything is scoped to the parent window: a message is accepted
 * only when it came from `window.parent`, and commands are answered only after
 * the parent completed the token handshake.
 */
import type { BridgeHello, BridgeRequest } from '../shared/bridge'

export interface BridgeParent {
  postMessage(message: unknown, targetOrigin: string): void
}

export interface BridgeScope {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  parent: BridgeParent
}

export function installBridge(
  scope: BridgeScope,
  version: number,
  call: (cmd: string, arg?: unknown) => unknown,
): void {
  let token: string | null = null

  const reply = (payload: Record<string, unknown>): void => {
    try {
      scope.parent.postMessage({ __dbs: true, ...payload }, '*')
    } catch {
      /* the frame navigated away */
    }
  }

  scope.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== scope.parent) return
    const data = event.data as ({ __dbs?: unknown } & Partial<BridgeHello & BridgeRequest>) | null
    if (typeof data !== 'object' || data === null || data.__dbs !== true) return

    if (data.type === 'hello') {
      token = typeof data.token === 'string' ? data.token : null
      reply({ type: 'ready', version, token })
      return
    }

    if (token === null) return
    if (typeof data.id !== 'string' || typeof data.cmd !== 'string') return
    if (data.token !== token) return

    Promise.resolve()
      .then(() => call(data.cmd as string, data.arg))
      .then(
        (result) => reply({ id: data.id, ok: true, result }),
        (error: unknown) => reply({ id: data.id, ok: false, error: String(error) }),
      )
  })

  // Tell a listening parent that the agent is alive; the parent answers with hello.
  reply({ type: 'ready', version, token: null })
}
