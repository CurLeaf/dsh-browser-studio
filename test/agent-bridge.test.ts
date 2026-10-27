import { describe, expect, it, vi } from 'vitest'
import { installBridge, type BridgeScope } from '../src/agent/bridge'

function makeScope() {
  const listeners: Array<(event: MessageEvent) => void> = []
  const sent: Array<Record<string, unknown>> = []
  const parent = { postMessage: (message: unknown): void => { sent.push(message as Record<string, unknown>) } }
  const scope: BridgeScope = {
    addEventListener: (_type, listener) => { listeners.push(listener) },
    parent,
  }
  const emit = (data: unknown, source: unknown = parent): void => {
    for (const listener of listeners) listener({ data, source } as MessageEvent)
  }
  return { scope, sent, emit, parent }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('page agent bridge', () => {
  it('announces itself and answers a hello with the current version', () => {
    const { scope, sent, emit, parent } = makeScope()
    installBridge(scope, 7, () => null)

    expect(sent[0]).toMatchObject({ __dbs: true, type: 'ready', version: 7, token: null })

    emit({ __dbs: true, type: 'hello', token: 'tab-1', version: 7 }, parent)
    expect(sent[1]).toMatchObject({ __dbs: true, type: 'ready', version: 7, token: 'tab-1' })
  })

  it('ignores messages from anything but the parent window', () => {
    const { scope, sent, emit } = makeScope()
    installBridge(scope, 1, vi.fn())
    emit({ __dbs: true, type: 'hello', token: 'evil' }, { postMessage: () => {} })
    expect(sent).toHaveLength(1)
  })

  it('runs commands only after the handshake and scopes them to the token', async () => {
    const { scope, sent, emit, parent } = makeScope()
    const call = vi.fn((cmd: string, arg?: unknown) => ({ cmd, arg }))
    installBridge(scope, 1, call)

    emit({ __dbs: true, id: 'a', token: null, cmd: 'ping' }, parent)
    await tick()
    expect(call).not.toHaveBeenCalled()

    emit({ __dbs: true, type: 'hello', token: 'tab-1' }, parent)
    emit({ __dbs: true, id: 'b', token: 'wrong-token', cmd: 'ping' }, parent)
    await tick()
    expect(call).not.toHaveBeenCalled()

    emit({ __dbs: true, id: 'c', token: 'tab-1', cmd: 'pick', arg: true }, parent)
    await tick()
    expect(call).toHaveBeenCalledWith('pick', true)
    expect(sent.at(-1)).toEqual({ __dbs: true, id: 'c', ok: true, result: { cmd: 'pick', arg: true } })
  })

  it('reports a throwing command as an error response', async () => {
    const { scope, sent, emit, parent } = makeScope()
    installBridge(scope, 1, () => { throw new Error('boom') })
    emit({ __dbs: true, type: 'hello', token: 't' }, parent)
    emit({ __dbs: true, id: 'x', token: 't', cmd: 'rect', arg: '#x' }, parent)
    await tick()
    expect(sent.at(-1)).toMatchObject({ id: 'x', ok: false, error: 'Error: boom' })
  })
})
