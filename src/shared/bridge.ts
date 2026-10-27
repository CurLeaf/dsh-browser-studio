/**
 * The message contract between the studio (parent window) and the injected
 * page agent (child frame).
 *
 * Desktop injection does not use this channel; it exists so a cross-origin
 * iframe can still host the picker: the page loads `/browser-studio/agent.js`,
 * the parent `postMessage`s commands, and the agent answers with results.
 */

export const BRIDGE_FLAG = '__dbs'
export const BRIDGE_VERSION = 1

export interface BridgeHello {
  __dbs: true
  type: 'hello'
  token: string
  version?: number
}

export interface BridgeReady {
  __dbs: true
  type: 'ready'
  version: number
  token: string | null
}

export interface BridgeRequest {
  __dbs: true
  id: string
  token: string | null
  cmd: string
  arg?: unknown
}

export interface BridgeResponse {
  __dbs: true
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

export type BridgeMessage = BridgeHello | BridgeReady | BridgeRequest | BridgeResponse

export function isBridgeMessage(data: unknown): data is { __dbs: true } {
  return typeof data === 'object' && data !== null && (data as { __dbs?: unknown }).__dbs === true
}
