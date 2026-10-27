import { AGENT_LOADER, AGENT_PATH } from '../shared/agent-loader'

export interface DshStudioAgentOptions {
  /** Direct studio origin; skips the referrer-derived loader when set. */
  origin?: string
}

/**
 * The subset of Vite's Plugin shape this package needs. Declaring it locally
 * keeps the package free of a runtime or type dependency on Vite.
 */
export interface DshStudioPlugin {
  name: string
  apply: 'serve'
  transformIndexHtml(html: string): string | Array<{
    tag: 'script'
    attrs?: Record<string, string | boolean>
    children?: string
    injectTo: 'head'
  }>
}

/**
 * Injects the dsh-browser-studio page agent into the dev HTML.
 *
 * By default it injects a tiny loader that derives the studio origin from
 * `document.referrer`, so the same config works on every machine and port.
 * Pass `origin` (or set DSH_STUDIO_URL) to inject a direct script instead —
 * useful when the page strips its referrer.
 *
 * ```ts
 * import dshStudioAgent from 'dsh-browser-studio/vite'
 * export default { plugins: [dshStudioAgent()] }
 * ```
 */
export default function dshStudioAgent(options: DshStudioAgentOptions = {}): DshStudioPlugin {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const origin = (options.origin ?? env?.DSH_STUDIO_URL ?? '').replace(/\/+$/, '')
  const direct = origin === '' ? '' : `${origin}${AGENT_PATH}`

  return {
    name: 'dsh-browser-studio:agent',
    apply: 'serve',
    transformIndexHtml(html: string) {
      if (html.includes(AGENT_PATH)) return html
      if (direct !== '') {
        return [{ tag: 'script', attrs: { src: direct, defer: true }, injectTo: 'head' }]
      }
      return [{ tag: 'script', children: AGENT_LOADER, injectTo: 'head' }]
    },
  }
}
