/**
 * Browser history shared by every sidebar browser tab in this renderer.
 *
 * The start page is not workspace-scoped: visiting a page in one workspace must
 * show up everywhere, including tabs that are already mounted. A module-level
 * external store keeps those React instances in sync; the `storage` event covers
 * other windows of the same app origin.
 */

export interface HistoryEntry {
  url: string
  title: string
  at: number
}

export const HISTORY_KEY = 'dsh.browser-studio.v1.recent'
const HISTORY_LIMIT = 30

let entries: HistoryEntry[] | null = null
let listening = false
const listeners = new Set<() => void>()

function parse(raw: string | null): HistoryEntry[] {
  if (raw === null) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    const out: HistoryEntry[] = []
    for (const item of value) {
      let url = ''
      let title = ''
      let at = 0
      if (typeof item === 'string') {
        url = item
      } else if (item !== null && typeof item === 'object') {
        const record = item as { url?: unknown; title?: unknown; at?: unknown }
        if (typeof record.url === 'string') url = record.url
        if (typeof record.title === 'string') title = record.title
        if (typeof record.at === 'number') at = record.at
      }
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue
      seen.add(url)
      out.push({ url, title, at })
      if (out.length >= HISTORY_LIMIT) break
    }
    return out
  } catch {
    return []
  }
}

function read(): HistoryEntry[] {
  try {
    return parse(globalThis.localStorage?.getItem(HISTORY_KEY) ?? null)
  } catch {
    return []
  }
}

function persist(): void {
  try {
    globalThis.localStorage?.setItem(HISTORY_KEY, JSON.stringify(entries ?? []))
  } catch {
    /* storage is best-effort */
  }
}

function emit(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      /* one subscriber must not break the others */
    }
  }
}

function ensure(): HistoryEntry[] {
  if (entries === null) {
    entries = read()
    if (!listening && typeof window !== 'undefined') {
      listening = true
      window.addEventListener('storage', (event) => {
        if (event.key !== null && event.key !== HISTORY_KEY) return
        entries = read()
        emit()
      })
    }
  }
  return entries
}

/** Stable snapshot for `useSyncExternalStore`. */
export function historySnapshot(): HistoryEntry[] {
  return ensure()
}

export function subscribeHistory(listener: () => void): () => void {
  ensure()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Record a page load. Existing entries move to the front, like a browser
 * history; an already-first entry only updates its title.
 */
export function rememberVisit(url: string, title = ''): void {
  if (!/^https?:\/\//i.test(url)) return
  const current = ensure()
  const cleanTitle = title.trim()
  const index = current.findIndex((entry) => entry.url === url)
  if (index === 0) {
    const first = current[0]
    if (cleanTitle === '' || cleanTitle === first.title) return
    const next = [{ ...first, title: cleanTitle, at: Date.now() }, ...current.slice(1)]
    entries = next
    persist()
    emit()
    return
  }
  const previousTitle = index > 0 ? current[index].title : ''
  const next = [
    { url, title: cleanTitle !== '' ? cleanTitle : previousTitle, at: Date.now() },
    ...current.filter((entry) => entry.url !== url),
  ].slice(0, HISTORY_LIMIT)
  entries = next
  persist()
  emit()
}

/** A late `page-title-updated` must not reorder history. */
export function updateHistoryTitle(url: string, title: string): void {
  const cleanTitle = title.trim()
  if (cleanTitle === '') return
  const current = ensure()
  const index = current.findIndex((entry) => entry.url === url)
  if (index < 0 || current[index].title === cleanTitle) return
  const next = current.slice()
  next[index] = { ...next[index], title: cleanTitle }
  entries = next
  persist()
  emit()
}

export function clearHistory(): void {
  entries = []
  persist()
  emit()
}

/** Test seam: drop the in-memory cache so the next snapshot re-reads storage. */
export function resetHistory(): void {
  entries = null
}
