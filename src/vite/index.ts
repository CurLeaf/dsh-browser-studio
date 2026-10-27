export interface DshStudioAgentOptions {
  /** Origin of the DSH host. Defaults to DSH_STUDIO_URL, then loopback 3080. */
  origin?: string
  /** Path of the served page agent. Defaults to /browser-studio/agent.js. */
  path?: string
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
    attrs: { src: string; defer: true }
    injectTo: 'head'
  }>
}

const DEFAULT_ORIGIN = 'http://127.0.0.1:3080'
const DEFAULT_PATH = '/browser-studio/agent.js'

/**
 * Injects the dsh-browser-studio page agent into the dev HTML.
 *
 * The Web preview is a cross-origin iframe, so the picker has to run inside the
 * page. The agent is served by the DSH host; this plugin only adds the script in
 * `vite dev` — `apply: 'serve'` keeps production builds untouched.
 *
 * ```ts
 * import dshStudioAgent from 'dsh-browser-studio/vite'
 * export default { plugins: [dshStudioAgent()] }
 * ```
 */
export default function dshStudioAgent(options: DshStudioAgentOptions = {}): DshStudioPlugin {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const origin = (options.origin ?? env?.DSH_STUDIO_URL ?? DEFAULT_ORIGIN).replace(/\/+$/, '')
  const path = options.path ?? DEFAULT_PATH
  const src = `${origin}${path.startsWith('/') ? path : `/${path}`}`

  return {
    name: 'dsh-browser-studio:agent',
    apply: 'serve',
    transformIndexHtml(html: string) {
      if (html.includes(src)) return html
      return [{ tag: 'script', attrs: { src, defer: true }, injectTo: 'head' }]
    },
  }
}
