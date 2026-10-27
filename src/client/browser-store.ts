/**
 * The persisted Browser tab store that the rest of DSH knows about.
 *
 * The shipped browser declares a session-scoped store with
 * `persist: "dsh.sidebar-browser.v1"`. `dsh-sidebar-share` mirrors that store
 * between sessions, so the takeover must use the same shape instead of keeping
 * the current URL only in its own localStorage keys.
 *
 * The store factory lives in the client runtime and is reached through the
 * module-loader `require` that wraps every plugin bundle. If an older host does
 * not expose it, the plugin still runs without URL sharing.
 */

declare const require: ((id: string) => unknown) | undefined

export interface SharedBrowserEntry {
  url: string
  title?: string
}

export interface SharedBrowserTab {
  entries: SharedBrowserEntry[]
  index: number
  [key: string]: unknown
}

export interface SharedBrowserState {
  byTab: Record<string, SharedBrowserTab>
}

export interface BrowserStoreActions {
  replace(tabId: string, state: SharedBrowserTab): void
  forget(tabId: string): void
}

const STORE_MODULE = '@deepseek-ai/dsh-client-store'
const PERSIST_KEY = 'dsh.sidebar-browser.v1'

function loadDefineStore(): unknown {
  try {
    if (typeof require !== 'function') return undefined
    const module = require(STORE_MODULE) as { defineStore?: unknown } | undefined
    return module?.defineStore
  } catch {
    return undefined
  }
}

function createBrowserStore(): unknown {
  const defineStore = loadDefineStore()
  if (typeof defineStore !== 'function') return undefined
  return (defineStore as (options: unknown) => unknown)({
    init: () => ({ byTab: {} }),
    persist: PERSIST_KEY,
    actions: {
      replace: (draft: SharedBrowserState, tabId: string, state: SharedBrowserTab) => {
        draft.byTab[tabId] = state
      },
      forget: (draft: SharedBrowserState, tabId: string) => {
        const byTab: Record<string, SharedBrowserTab> = {}
        for (const [id, state] of Object.entries(draft.byTab)) if (id !== tabId) byTab[id] = state
        draft.byTab = byTab
      },
    },
  })
}

/** `undefined` when the host does not expose the client store factory. */
export const browserStore = createBrowserStore()

/** Current address of one shared tab, if the store has one. */
export function sharedTabUrl(tab: SharedBrowserTab | undefined): string {
  if (tab === undefined || !Array.isArray(tab.entries)) return ''
  const index = typeof tab.index === 'number' ? tab.index : 0
  const entry = tab.entries[index]
  return entry !== undefined && typeof entry.url === 'string' ? entry.url : ''
}

/** Current title of one shared tab, if known. */
export function sharedTabTitle(tab: SharedBrowserTab | undefined): string {
  if (tab === undefined || !Array.isArray(tab.entries)) return ''
  const index = typeof tab.index === 'number' ? tab.index : 0
  const entry = tab.entries[index]
  return entry !== undefined && typeof entry.title === 'string' ? entry.title : ''
}
