import * as React from 'react'
import { AGENT_BOOT } from '../generated/agent-bundle'
import { PRESETS, PRESET_BY_ID } from './presets'
import {
  applyPreset, clamp, computeScale, DEFAULT_DEVICE, formatSize, isLandscape, normalizeUrl, presetFor,
  viewportSize, ZOOM_STEPS, type DeviceState,
} from './device'
import { addPendingRef, appendComposerLine, buildBlock, elementLabel, focusComposer } from './bridge'
import { createWebAgent, type WebAgent } from './web-agent'
import { agentSnippet } from '../shared/agent-loader'
import {
  clearHistory, historySnapshot, rememberVisit, subscribeHistory, updateHistoryTitle,
  type HistoryEntry,
} from './history'
import {
  sharedTabTitle, sharedTabUrl, type BrowserStoreActions, type SharedBrowserState,
  type SharedBrowserTab,
} from './browser-store'
import type { AgentEvent, ElementRef } from '../shared/types'

interface GuestElement extends HTMLElement {
  loadURL(url: string): Promise<void> | void
  getURL(): string
  getTitle(): string
  reload(): void
  reloadIgnoringCache?(): void
  clearHistory?(): void
  capturePage?(): Promise<unknown>
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  setUserAgent(ua: string): void
  isLoading(): boolean
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>
}

export interface BodyProps {
  sessionId: string
  t: (key: string) => string
  locale: 'zh' | 'en'
  sendPrompt: (sessionId: string, text: string) => Promise<void>
  useTabInfo: () => { tab?: { id?: string; navigation?: { params?: { url?: string } } } }
  useWorkspaces?: (selector: (snapshot: unknown) => unknown) => unknown
  /** Slot standard prop when the body slot declares the session Browser store. */
  useStore?: <T>(selector: (state: SharedBrowserState) => T) => T
  /** Injected bound store actions (`replace` / `forget`) for the same store. */
  storeActions?: BrowserStoreActions
  /** Older slot runtimes pass the store actions as the standard `actions` prop. */
  actions?: BrowserStoreActions
  /** Authoritative layout membership; a tab that still exists must keep its entry. */
  isTabOpen?: (tabId: string) => boolean
}

const STORE = 'dsh.browser-studio.v1'
const DESKTOP_UA = typeof navigator === 'undefined' ? '' : navigator.userAgent
const FALLBACK_MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORE}.${key}`)
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(`${STORE}.${key}`, JSON.stringify(value))
  } catch {
    /* storage is best-effort */
  }
}

function callCode(cmd: string, arg?: unknown): string {
  return `window.__DSH_STUDIO_AGENT__ && window.__DSH_STUDIO_AGENT__.call(${JSON.stringify(cmd)}, ${arg === undefined ? 'undefined' : JSON.stringify(arg)})`
}

function workspaceKeyOf(snapshot: unknown, sessionId: string): string | undefined {
  if (snapshot === null || typeof snapshot !== 'object') return undefined
  const s = snapshot as { phase?: string; items?: Array<{ path?: string; sessionIds?: string[] }> }
  if (s.phase !== 'ready') return undefined
  const items = Array.isArray(s.items) ? s.items : []
  const match = items.find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId))
  return match === undefined ? `session:${sessionId}` : `cwd:${String(match.path)}`
}

interface Suggestion {
  kind: 'open' | 'history'
  value: string
  title: string
  url: string
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, '')
}

function Highlight(props: { text: string; query: string }): React.ReactElement {
  const query = props.query.trim()
  if (query === '') return <>{props.text}</>
  const index = props.text.toLowerCase().indexOf(query.toLowerCase())
  if (index < 0) return <>{props.text}</>
  return (
    <>
      {props.text.slice(0, index)}
      <mark className="dbs-suggestMatch">{props.text.slice(index, index + query.length)}</mark>
      {props.text.slice(index + query.length)}
    </>
  )
}

function entryTitle(entry: HistoryEntry): string {
  if (entry.title !== '') return entry.title
  try {
    return new URL(entry.url).host
  } catch {
    return stripScheme(entry.url)
  }
}

/** A bare word is a search term, not a host; only offer to open URL-shaped input. */
function looksLikeUrl(input: string): boolean {
  const raw = input.trim()
  if (raw === '') return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return true
  if (/[./:]/.test(raw) && !/\s/.test(raw)) return true
  return /^localhost$/i.test(raw)
}


/* ------------------------------------------------------------------ icons */

function Svg(props: { children: React.ReactNode; size?: number }): React.ReactElement {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

const IconBack = (): React.ReactElement => (
  <Svg><path d="M10 3.5 5.5 8 10 12.5" /></Svg>
)
const IconForward = (): React.ReactElement => (
  <Svg><path d="M6 3.5 10.5 8 6 12.5" /></Svg>
)
const IconReload = (): React.ReactElement => (
  <Svg><path d="M12.8 8a4.8 4.8 0 1 1-1.4-3.4" /><path d="M12.8 3.4V6h-2.6" /></Svg>
)
const IconMore = (): React.ReactElement => (
  <Svg>
    <circle cx="3.2" cy="8" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="12.8" cy="8" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
)
const IconSearch = (props: { size?: number }): React.ReactElement => (
  <Svg size={props.size}>
    <circle cx="7.2" cy="7.2" r="4.5" />
    <path d="M10.6 10.6 13.6 13.6" />
  </Svg>
)
const IconGlobe = (props: { size?: number }): React.ReactElement => (
  <Svg size={props.size}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11" />
    <path d="M8 2.5c1.7 1.6 1.7 9.4 0 11" />
    <path d="M8 2.5c-1.7 1.6-1.7 9.4 0 11" />
  </Svg>
)
const IconLink = (): React.ReactElement => (
  <Svg>
    <path d="M6.6 9.4 9.4 6.6" />
    <path d="M7.4 5.1 8.8 3.7a2.5 2.5 0 0 1 3.5 3.5L10.9 8.6" />
    <path d="M8.6 10.9 7.2 12.3a2.5 2.5 0 0 1-3.5-3.5l1.4-1.4" />
  </Svg>
)
const IconChevron = (): React.ReactElement => (
  <Svg size={12}><path d="M4 6.5 8 10 12 6.5" /></Svg>
)
const IconPick = (): React.ReactElement => (
  <Svg><path d="M3.5 2.5 12 7.2l-3.8 1-1.1 3.9z" /></Svg>
)
const IconResponsive = (): React.ReactElement => (
  <Svg>
    <rect x="1.5" y="2.4" width="9.4" height="6.8" rx="1.2" />
    <path d="M1.8 11.2h8.8" />
    <rect x="9.6" y="7.6" width="4.9" height="6.4" rx="1.3" />
    <path d="M11.3 12.4h1.5" />
  </Svg>
)
const IconRuler = (): React.ReactElement => (
  <Svg>
    <rect x="1.4" y="4.7" width="13.2" height="6.6" rx="1.3" />
    <path d="M4.4 4.7v2.3M6.6 4.7v3.5M8.8 4.7v2.3M11 4.7v3.5" />
  </Svg>
)
const IconCheck = (): React.ReactElement => (
  <Svg size={12}><path d="M3 8.4 6.3 11.6 13 4.6" /></Svg>
)
const IconArrowRight = (): React.ReactElement => (
  <Svg size={12}><path d="M3 8h9" /><path d="M8.5 4.5 12 8l-3.5 3.5" /></Svg>
)
function Switch(props: { on: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      data-on={props.on}
      disabled={props.disabled}
      className="dbs-switch"
      onClick={() => props.onChange(!props.on)}
    />
  )
}

const RULER_SIZE = 18

/** Labelled every N device pixels; keep labels at least ~44 panel px apart. */
function rulerStep(scale: number): number {
  for (const step of [25, 50, 100, 200, 500]) if (step * scale >= 44) return step
  return 1000
}

function RulerMarks(props: { length: number; scale: number; offset?: number; vertical?: boolean }): React.ReactElement {
  const step = rulerStep(props.scale)
  const offset = props.offset ?? 0
  const marks: number[] = []
  for (let value = step; value <= props.length; value += step) {
    if (props.length - value < step * 0.4) continue
    marks.push(value)
  }
  return (
    <>
      {marks.map((value) => (
        <span
          key={value}
          className={props.vertical === true ? 'dbs-rulerLabel dbs-rulerLabelY' : 'dbs-rulerLabel'}
          style={
            props.vertical === true
              ? { top: offset + value * props.scale }
              : { left: offset + value * props.scale }
          }
        >
          {value}
        </span>
      ))}
    </>
  )
}

interface RulerBox {
  left: number
  top: number
  w: number
  h: number
  /** Device-frame border between the stage edge and the page. */
  inset: number
}

interface GuideDrag {
  axis: 'x' | 'y'
  index: number
}

interface RulerOverlayProps {
  box: RulerBox
  width: number
  height: number
  scale: number
  guides: { x: number[]; y: number[] }
  dragging: GuideDrag | null
  hint: string
  onStartGuide: (event: React.PointerEvent, axis: 'x' | 'y', index: number | null) => void
  onRemoveGuide: (axis: 'x' | 'y', index: number) => void
}

function RulerOverlay(props: RulerOverlayProps): React.ReactElement {
  const { box, width, height, scale } = props
  const step = rulerStep(scale)
  const stageLeft = box.left - box.inset
  const stageTop = box.top - box.inset
  const stageW = box.w + box.inset * 2
  const stageH = box.h + box.inset * 2
  const top = Math.max(stageTop - RULER_SIZE, 0)
  const left = Math.max(stageLeft - RULER_SIZE, 0)
  const style = (element: 'x' | 'y'): React.CSSProperties =>
    ({
      ...(element === 'x'
        ? { left: stageLeft, top, width: stageW }
        : { left, top: stageTop, height: stageH }),
      '--dbs-tick': `${(step / 10) * scale}px`,
      '--dbs-half': `${(step / 2) * scale}px`,
      '--dbs-major': `${step * scale}px`,
      '--dbs-origin': `${box.inset}px`,
    }) as unknown as React.CSSProperties
  return (
    <div className="dbs-rulers">
      <div
        className="dbs-rulerX"
        style={style('x')}
        title={props.hint}
        onPointerDown={(event) => props.onStartGuide(event, 'y', null)}
      >
        <RulerMarks length={width} scale={scale} offset={box.inset} />
      </div>
      <div
        className="dbs-rulerY"
        style={style('y')}
        title={props.hint}
        onPointerDown={(event) => props.onStartGuide(event, 'x', null)}
      >
        <RulerMarks length={height} scale={scale} offset={box.inset} vertical />
      </div>
      <div className="dbs-rulerCorner" style={{ left, top }} />
      {props.guides.x.map((value, index) => (
        <div
          key={`x-${index}`}
          className="dbs-guide dbs-guideX"
          data-dragging={props.dragging !== null && props.dragging.axis === 'x' && props.dragging.index === index}
          style={{ left: box.left + value * scale, top: box.top, height: box.h }}
          onPointerDown={(event) => props.onStartGuide(event, 'x', index)}
          onDoubleClick={() => props.onRemoveGuide('x', index)}
        >
          <span className="dbs-guideTag">{Math.round(value)}</span>
        </div>
      ))}
      {props.guides.y.map((value, index) => (
        <div
          key={`y-${index}`}
          className="dbs-guide dbs-guideY"
          data-dragging={props.dragging !== null && props.dragging.axis === 'y' && props.dragging.index === index}
          style={{ left: box.left, top: box.top + value * scale, width: box.w }}
          onPointerDown={(event) => props.onStartGuide(event, 'y', index)}
          onDoubleClick={() => props.onRemoveGuide('y', index)}
        >
          <span className="dbs-guideTag">{Math.round(value)}</span>
        </div>
      ))}
    </div>
  )
}

export function BrowserBody(props: BodyProps): React.ReactElement {
  const { t, locale, sessionId, sendPrompt } = props
  const tab = typeof props.useTabInfo === 'function' ? props.useTabInfo().tab : undefined
  const tabId = tab?.id ?? 'default'
  const useSharedStore: <T>(selector: (state: SharedBrowserState) => T) => T =
    props.useStore ?? ((selector) => selector({ byTab: {} }))
  const sharedTab = useSharedStore((state) => state.byTab[tabId])
  const sharedTabRef = React.useRef<SharedBrowserTab | undefined>(sharedTab)
  sharedTabRef.current = sharedTab
  const desktop = (globalThis as any).dshDesktop?.browser
  const isDesktop = typeof desktop?.acquire === 'function'

  const useWorkspaces = props.useWorkspaces
  const workspaceSnapshot: unknown = typeof useWorkspaces === 'function' ? useWorkspaces((s) => s) : undefined
  const workspaceKey = workspaceKeyOf(workspaceSnapshot, sessionId)

  const [device, setDevice] = React.useState<DeviceState>(() => ({
    ...DEFAULT_DEVICE,
    ...readJson<Partial<DeviceState>>('device', {}),
  }))
  const [address, setAddress] = React.useState('')
  const [currentUrl, setCurrentUrl] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [canBack, setCanBack] = React.useState(false)
  const [canForward, setCanForward] = React.useState(false)
  const [guest, setGuest] = React.useState<'idle' | 'acquiring' | 'ready' | 'failed' | 'unsupported'>(
    isDesktop ? 'idle' : 'unsupported',
  )
  const [guestError, setGuestError] = React.useState('')
  const [retry, setRetry] = React.useState(0)
  const [picking, setPicking] = React.useState(false)
  const [count, setCount] = React.useState(0)
  const [toast, setToast] = React.useState('')
  const [loadError, setLoadError] = React.useState('')
  const [avail, setAvail] = React.useState({ w: 0, h: 0 })
  const [sizeDraft, setSizeDraft] = React.useState<{ w: string; h: string } | null>(null)
  const [rulerBox, setRulerBox] = React.useState<RulerBox | null>(null)
  const [guides, setGuides] = React.useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [guideDrag, setGuideDrag] = React.useState<GuideDrag | null>(null)
  const [menuLeft, setMenuLeft] = React.useState(8)
  const [zoomOpen, setZoomOpen] = React.useState(false)
  const [setupOpen, setSetupOpen] = React.useState(false)
  const [iframeUrl, setIframeUrl] = React.useState('')
  const [iframeKey, setIframeKey] = React.useState(0)
  const [agentReady, setAgentReady] = React.useState(false)
  const canPick = isDesktop || agentReady
  const [workspaceFallback, setWorkspaceFallback] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [hostReady, setHostReady] = React.useState(false)
  const [pendingPick, setPendingPick] = React.useState<ElementRef | null>(null)
  const [note, setNote] = React.useState('')
  const recentHistory = React.useSyncExternalStore(subscribeHistory, historySnapshot, historySnapshot)
  const [suggestOpen, setSuggestOpen] = React.useState(false)
  const [suggestIndex, setSuggestIndex] = React.useState(-1)
  const [startAddress, setStartAddress] = React.useState('')
  const addressRef = React.useRef<HTMLInputElement | null>(null)
  const startRef = React.useRef<HTMLInputElement | null>(null)
  const [anchor, setAnchor] = React.useState<{ left: number; top: number; w: number; h: number } | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const moreMenuRef = React.useRef<HTMLDivElement | null>(null)
  const moreBtnRef = React.useRef<HTMLButtonElement | null>(null)
  const suggestRef = React.useRef<HTMLDivElement | null>(null)
  const sizeBtnRef = React.useRef<HTMLButtonElement | null>(null)
  const zoomBtnRef = React.useRef<HTMLButtonElement | null>(null)
  const zoomMenuRef = React.useRef<HTMLDivElement | null>(null)
  const setupRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (workspaceKey !== undefined || workspaceFallback) return undefined
    const timer = window.setTimeout(() => setWorkspaceFallback(true), 4000)
    return () => window.clearTimeout(timer)
  }, [workspaceKey, workspaceFallback])

  const effectiveWorkspaceKey = workspaceKey ?? (workspaceFallback ? `session:${sessionId}` : undefined)

  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const cancelSizeRef = React.useRef(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const pendingRef = React.useRef<ElementRef | null>(null)
  const noteRef = React.useRef('')
  const scaleRef = React.useRef(1)
  const setHostNode = React.useCallback((node: HTMLDivElement | null): void => {
    hostRef.current = node
    setHostReady(node !== null)
  }, [])
  const webviewRef = React.useRef<GuestElement | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const webAgentRef = React.useRef<WebAgent | null>(null)
  const bridgeToken = React.useMemo(() => `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`, [tabId])
  const readyRef = React.useRef(false)
  const pendingUrlRef = React.useRef('')
  const pickingRef = React.useRef(false)
  const deviceRef = React.useRef(device)
  const lastDeviceRef = React.useRef<DeviceState | null>(null)
  const localeRef = React.useRef(locale)
  const toastTimer = React.useRef(0)
  const lastUARef = React.useRef<string | null>(null)
  const countRef = React.useRef(0)
  const pinsRef = React.useRef<Array<{ n: number; selector: string }>>([])
  const tabSignalRef = React.useRef<AbortSignal | undefined>(undefined)

  deviceRef.current = device
  pendingRef.current = pendingPick
  noteRef.current = note
  localeRef.current = locale
  pickingRef.current = picking

  const preset = presetFor(device.presetId)
  const ua = device.uaMobile ? preset?.ua ?? FALLBACK_MOBILE_UA : DESKTOP_UA
  const size = viewportSize(device, avail)
  const scale = computeScale(device, avail, 0)
  scaleRef.current = scale
  const responsive = device.presetId === 'responsive'

  const showToast = React.useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current !== 0) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  const storeActions = props.storeActions ?? props.actions

  /** Publish the current page into the store that sidebar sharing mirrors. */
  const publishShared = React.useCallback((url: string, title = '') => {
    if (storeActions === undefined || typeof storeActions.replace !== 'function') return
    if (!/^https?:\/\//i.test(url)) return
    const current = sharedTabRef.current
    if (sharedTabUrl(current) === url && sharedTabTitle(current) === title) return
    try {
      storeActions.replace(tabId, {
        entries: [{ url, title }],
        index: 0,
        navigation: { status: 'known', revision: 0 },
      })
    } catch {
      /* store not ready */
    }
  }, [storeActions, tabId])

  React.useEffect(() => () => {
    if (toastTimer.current !== 0) window.clearTimeout(toastTimer.current)
  }, [])

  // A closed tab must not leave a URL behind in the shared Browser store.
  // Unmounting because the session is switched is not a close: keep the entry
  // while the layout still lists the tab, matching the shipped controller.
  React.useEffect(() => () => {
    if (storeActions === undefined || typeof storeActions.forget !== 'function') return
    if (typeof props.isTabOpen === 'function' && props.isTabOpen(tabId)) return
    try {
      storeActions.forget(tabId)
    } catch {
      /* store already released */
    }
  }, [storeActions, tabId, props.isTabOpen])

  React.useEffect(() => {
    writeJson('device', device)
  }, [device])

  // Remember the last real device so the toolbar toggle can come back to it.
  React.useEffect(() => {
    if (device.presetId !== 'responsive') lastDeviceRef.current = device
  }, [device])

  // Measure the viewport's content box (padding excluded) so a fitted device
  // never spills over and toggles scrollbars, which would feed back into the
  // scale while the chat panel animates open.
  React.useLayoutEffect(() => {
    const node = viewportRef.current
    if (node === null) return undefined
    const measure = (): void => {
      const style = window.getComputedStyle(node)
      const padX = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
      const padY = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)
      setAvail({
        w: Math.max(0, Math.floor(node.clientWidth - padX)),
        h: Math.max(0, Math.floor(node.clientHeight - padY)),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Rulers hug the simulated viewport, so re-measure whenever it moves or scales.
  React.useLayoutEffect(() => {
    if (!device.rulers) return undefined
    const measure = (): void => {
      const canvas = canvasRef.current
      const stage = stageRef.current
      const viewport = viewportRef.current
      if (canvas === null || stage === null || viewport === null) return
      const page = canvas.getBoundingClientRect()
      const frame = stage.getBoundingClientRect()
      const area = viewport.getBoundingClientRect()
      const left = page.left - area.left + viewport.scrollLeft
      const top = page.top - area.top + viewport.scrollTop
      setRulerBox({
        left,
        top,
        w: page.width,
        h: page.height,
        inset: Math.max(0, Math.round(left - (frame.left - area.left + viewport.scrollLeft))),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (canvasRef.current !== null) observer.observe(canvasRef.current)
    if (viewportRef.current !== null) observer.observe(viewportRef.current)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [device.rulers, device.width, device.height, device.zoom, device.frame, device.presetId, avail.w, avail.h, scale])

  // Initial URL: the shared Browser store wins over tab params and the remembered one.
  React.useEffect(() => {
    const fromParams = typeof tab?.navigation?.params?.url === 'string' ? tab.navigation.params.url : ''
    const stored = readJson<string>('url.' + sessionId + '.' + tabId, '')
    const initial =
      normalizeUrl(sharedTabUrl(sharedTab)) || normalizeUrl(fromParams) || normalizeUrl(stored)
    if (initial === '') return
    setAddress(initial)
    setCurrentUrl(initial)
    pendingUrlRef.current = initial
    rememberVisit(initial)
    publishShared(initial)
    if (!isDesktop) setIframeUrl(initial)
  }, [])

  // The start page owns the keyboard while the tab has no page.
  React.useEffect(() => {
    if (currentUrl !== '' || guest === 'acquiring') return undefined
    const timer = window.setTimeout(() => startRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [currentUrl, guest])

  const suggestQuery = currentUrl !== '' && address.trim() === currentUrl ? '' : address.trim()

  const suggestions = React.useMemo(() => {
    const query = suggestQuery
    const items: Suggestion[] = []
    const normalized = looksLikeUrl(query) ? normalizeUrl(query) : ''
    if (normalized !== '' && !recentHistory.some((entry) => entry.url === normalized)) {
      items.push({ kind: 'open', value: normalized, title: stripScheme(normalized), url: normalized })
    }
    const needle = query.toLowerCase()
    for (const entry of recentHistory) {
      const title = entryTitle(entry)
      if (
        needle !== '' &&
        !entry.url.toLowerCase().includes(needle) &&
        !title.toLowerCase().includes(needle)
      ) {
        continue
      }
      items.push({ kind: 'history', value: entry.url, title, url: entry.url })
      if (items.length >= 6) break
    }
    return items.slice(0, 6)
  }, [suggestQuery, recentHistory])

  const chooseSuggestion = (value: string): void => {
    setSuggestOpen(false)
    setSuggestIndex(-1)
    navigate(value)
  }

  React.useEffect(() => {
    if (!suggestOpen || suggestIndex < 0) return
    const active = suggestRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    if (active !== undefined && active !== null && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [suggestOpen, suggestIndex])

  /** One command surface for both transports: webview injection and the iframe bridge. */
  const callAgent = React.useCallback(
    <T,>(cmd: string, arg?: unknown): Promise<T | null> => {
      if (isDesktop) {
        const el = webviewRef.current
        if (el === null || !readyRef.current) return Promise.resolve(null)
        return el.executeJavaScript(callCode(cmd, arg), false).then(
          (value) => (value ?? null) as T | null,
          () => null,
        )
      }
      return webAgentRef.current?.call<T>(cmd, arg) ?? Promise.resolve(null)
    },
    [isDesktop],
  )

  React.useEffect(() => {
    if (isDesktop) return undefined
    const agent = createWebAgent({
      getFrame: () => iframeRef.current,
      token: bridgeToken,
      onReady: () => setAgentReady(true),
      onReset: () => setAgentReady(false),
    })
    webAgentRef.current = agent
    return () => {
      agent.dispose()
      webAgentRef.current = null
      setAgentReady(false)
    }
  }, [isDesktop, bridgeToken])

  // The page may load after us and vice versa; keep greeting until it answers.
  React.useEffect(() => {
    if (isDesktop || iframeUrl === '') return undefined
    const greet = (): void => webAgentRef.current?.greet()
    greet()
    const timer = window.setInterval(greet, 500)
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [isDesktop, iframeUrl, iframeKey])

  const syncPins = React.useCallback(() => {
    void callAgent('pins', pinsRef.current)
  }, [callAgent])

  const beginPick = React.useCallback((ref: ElementRef) => {
    if (pendingRef.current !== null) return
    pendingRef.current = ref
    setPendingPick(ref)
    setNote('')
    window.setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  const resumePagePicking = React.useCallback(() => {
    if (!pickingRef.current) return
    void callAgent('pick', true)
  }, [callAgent])

  const closePickPopover = React.useCallback(() => {
    pendingRef.current = null
    noteRef.current = ''
    setPendingPick(null)
    setAnchor(null)
    setNote('')
    resumePagePicking()
  }, [resumePagePicking])

  const confirmPick = React.useCallback(() => {
    const ref = pendingRef.current
    if (ref === null) return
    const text = noteRef.current.trim()
    const n = countRef.current + 1
    countRef.current = n
    setCount(n)
    const d = deviceRef.current
    const p = presetFor(d.presetId)
    const label = p?.title ?? (d.presetId === 'responsive' ? 'Responsive' : 'Custom')
    const meta = { deviceLabel: label, uaMobile: d.uaMobile, locale: localeRef.current }
    const detail = buildBlock(ref, n, meta, text)
    addPendingRef(sessionId, { n, label: elementLabel(ref), note: text, detail })
    // The dock publishes the chip list to the host; the visible reference keeps
    // the sent message honest about what travels with it.
    focusComposer(true)
    appendComposerLine(`〔引用 ${n} · ${elementLabel(ref)}${text !== '' ? ` · ${text}` : ''}〕`)
    showToast(t('toast.added'))
    pinsRef.current = [...pinsRef.current, { n, selector: ref.selector }]
    syncPins()
    closePickPopover()
  }, [closePickPopover, sendPrompt, sessionId, showToast, syncPins, t])

  // Keep the popover anchored to the picked element while the page scrolls.
  React.useEffect(() => {
    if (pendingPick === null) return undefined
    let cancelled = false
    const update = (): void => {
      const stage = stageRef.current
      const viewport = viewportRef.current
      if (stage === null || viewport === null) return
      void callAgent<{ x: number; y: number; w: number; h: number }>('rect', pendingPick.selector).then(
        (r) => {
          if (cancelled || r === null) return
          const stageRect = stage.getBoundingClientRect()
          const viewportRect = viewport.getBoundingClientRect()
          const s = scaleRef.current
          setAnchor({
            left: stageRect.left - viewportRect.left + r.x * s + viewport.scrollLeft,
            top: stageRect.top - viewportRect.top + r.y * s + viewport.scrollTop,
            w: r.w * s,
            h: r.h * s,
          })
        },
      )
    }
    update()
    const timer = window.setInterval(update, 180)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pendingPick, callAgent])

  React.useEffect(() => {
    const selector = pendingPick === null ? null : pendingPick.selector
    void callAgent('highlight', selector)
  }, [pendingPick, callAgent])

  // Guest lifecycle: one lease, one webview, events wired to React state.
  React.useLayoutEffect(() => {
    if (!isDesktop) return undefined
    if (!hostReady) return undefined
    const host = hostRef.current
    if (host === null) return undefined
    if (effectiveWorkspaceKey === undefined) return undefined

    let cancelled = false
    let element: GuestElement | null = null
    let lease: string | undefined
    let unsubscribeOpen: (() => void) | undefined

    setGuest('acquiring')
    setGuestError('')

    const sync = (): void => {
      if (element === null) return
      try {
        const url = element.getURL()
        if (typeof url === 'string' && url !== '' && !url.startsWith('about:')) {
          const title = typeof element.getTitle === 'function' ? element.getTitle() : ''
          setCurrentUrl(url)
          setAddress((value) => (value === url ? value : url))
          writeJson('url.' + sessionId + '.' + tabId, url)
          rememberVisit(url, title)
          publishShared(url, title)
        }
        setLoading(typeof element.isLoading === 'function' ? (element as any).isLoading() : false)
        setCanBack(element.canGoBack())
        setCanForward(element.canGoForward())
      } catch {
        /* the guest is gone; its events report it */
      }
    }

    const inject = (): void => {
      if (element === null) return
      element.executeJavaScript(AGENT_BOOT, false).then(
        () => {
          if (cancelled || element === null) return
          readyRef.current = true
          const copy = { pick: t('hint.pick'), added: t('hint.added') }
          element.executeJavaScript(callCode('copy', copy), false).catch(() => {})
          if (pickingRef.current) element.executeJavaScript(callCode('pick', true), false).catch(() => {})
          syncPins()
          const queued = pendingUrlRef.current
          if (queued !== '') {
            pendingUrlRef.current = ''
            Promise.resolve(element.loadURL(queued)).catch(() => {})
          }
        },
        () => {
          /* a navigation interrupted the injection; dom-ready injects again */
        },
      )
    }

    const dispose = (): void => {
      if (element !== null) {
        try {
          element.remove()
        } catch {
          /* already detached */
        }
        element = null
      }
      webviewRef.current = null
      readyRef.current = false
      if (unsubscribeOpen !== undefined) {
        unsubscribeOpen()
        unsubscribeOpen = undefined
      }
      const held = lease
      lease = undefined
      if (held !== undefined) {
        try {
          Promise.resolve(desktop.release(held)).catch(() => {})
        } catch {
          /* window closing */
        }
      }
    }

    const create = async (): Promise<void> => {
      let reservation: { lease: string; partition: string }
      try {
        reservation = await desktop.acquire(effectiveWorkspaceKey)
      } catch (error) {
        if (!cancelled) {
          setGuest('failed')
          setGuestError(error instanceof Error ? error.message : String(error))
        }
        return
      }
      if (cancelled) {
        Promise.resolve(desktop.release(reservation.lease)).catch(() => {})
        return
      }
      lease = reservation.lease
      const view = document.createElement('webview') as unknown as GuestElement
      view.className = 'dbs-guest'
      view.setAttribute('name', reservation.lease)
      view.setAttribute('partition', reservation.partition)
      view.setAttribute('allowpopups', '')
      view.setAttribute('src', `about:blank#${reservation.lease}`)

      view.addEventListener('dom-ready', () => {
        if (cancelled) return
        inject()
        sync()
      })
      view.addEventListener('did-navigate', () => {
        if (cancelled) return
        setLoadError('')
        sync()
        inject()
      })
      view.addEventListener('did-navigate-in-page', () => {
        if (cancelled) return
        sync()
        inject()
      })
      view.addEventListener('page-title-updated', () => {
        if (cancelled) return
        try {
          const url = view.getURL()
          const title = view.getTitle()
          if (typeof url === 'string' && url !== '' && !url.startsWith('about:')) {
            updateHistoryTitle(url, title)
            publishShared(url, title)
          }
        } catch {
          /* guest gone */
        }
      })
      view.addEventListener('did-start-loading', () => {
        if (!cancelled) setLoading(true)
      })
      view.addEventListener('did-stop-loading', () => {
        if (cancelled) return
        setLoading(false)
        sync()
      })
      view.addEventListener('did-fail-load', (event: any) => {
        if (cancelled) return
        if (event?.isMainFrame === true && event?.errorCode !== -3) {
          setLoadError(`${t('error.load')} (${String(event?.errorCode ?? '')})`)
          setLoading(false)
        }
      })
      const lost = (): void => {
        if (cancelled) return
        readyRef.current = false
        setGuest('failed')
        setGuestError(t('guest.failed'))
        setLoading(false)
      }
      view.addEventListener('render-process-gone', lost)
      view.addEventListener('destroyed', lost)

      host.appendChild(view)
      element = view
      webviewRef.current = view
      setGuest('ready')

      try {
        unsubscribeOpen = desktop.onOpenRequested?.(reservation.lease, (url: string) => {
          try {
            (tab as any)?.actions?.openTab?.('browser', { params: { url }, revealIfOpened: false })
          } catch {
            /* the tab moved on */
          }
        })
      } catch {
        /* older shells */
      }
      sync()
    }

    create().catch((error: unknown) => {
      if (cancelled) return
      setGuest('failed')
      setGuestError(error instanceof Error ? error.message : String(error))
    })

    return () => {
      cancelled = true
      dispose()
    }
  }, [isDesktop, hostReady, effectiveWorkspaceKey, retry, sessionId, tabId, desktop, t, publishShared])

  // Apply the user agent; reload only when it actually changes after first use.
  React.useEffect(() => {
    const el = webviewRef.current
    if (el === null || guest !== 'ready') return
    try {
      el.setUserAgent(ua)
    } catch {
      /* older shells */
    }
    if (lastUARef.current !== null && lastUARef.current !== ua) {
      try {
        el.reload()
      } catch {
        /* guest gone */
      }
    }
    lastUARef.current = ua
  }, [ua, guest])

  // Poll the page agent while picking.
  React.useEffect(() => {
    if (!picking) return undefined
    const timer = window.setInterval(() => {
      void callAgent<{ events?: AgentEvent[] }>('drain').then((result) => {
        const events = result?.events ?? []
        for (const event of events) {
          if (event.kind === 'pick') {
            beginPick(event.ref)
            void callAgent('pick', false)
          }
          if (event.kind === 'esc') setPicking(false)
        }
      })
    }, 170)
    return () => window.clearInterval(timer)
  }, [picking, beginPick, callAgent])

  React.useEffect(() => {
    if (!menuOpen) return undefined
    const raf = window.requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector('[data-active="true"]')
      if (active instanceof HTMLElement && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' })
      }
    })
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (menuRef.current?.contains(target) === true) return
      if (sizeBtnRef.current?.contains(target) === true) return
      setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [menuOpen])

  React.useEffect(() => {
    if (!setupOpen) return undefined
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (setupRef.current?.contains(target) === true) return
      setSetupOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSetupOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [setupOpen])

  // The zoom menu follows the same rules as the other popovers.
  React.useEffect(() => {
    if (!zoomOpen) return undefined
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (zoomMenuRef.current?.contains(target) === true) return
      if (zoomBtnRef.current?.contains(target) === true) return
      setZoomOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setZoomOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [zoomOpen])

  // Closing the device panel discards an unfinished size edit.
  React.useEffect(() => {
    if (menuOpen) return
    cancelSizeRef.current = false
    setSizeDraft(null)
  }, [menuOpen])

  React.useEffect(() => {
    if (!moreOpen) return undefined
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (moreMenuRef.current?.contains(target) === true) return
      if (moreBtnRef.current?.contains(target) === true) return
      setMoreOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [moreOpen])

  const navigate = (input: string): void => {
    const url = normalizeUrl(input)
    if (url === '') {
      showToast(t('address.invalid'))
      return
    }
    setAddress(url)
    setCurrentUrl(url)
    setLoadError('')
    setMoreOpen(false)
    setSuggestOpen(false)
    setSuggestIndex(-1)
    setStartAddress('')
    writeJson('url.' + sessionId + '.' + tabId, url)
    rememberVisit(url)
    publishShared(url)
    if (!isDesktop) {
      setIframeUrl(url)
      return
    }
    if (pendingUrlRef.current === '' && (!readyRef.current || webviewRef.current === null)) {
      pendingUrlRef.current = url
    }
    const el = webviewRef.current
    if (el !== null && readyRef.current) {
      Promise.resolve(el.loadURL(url)).catch(() => {})
    } else {
      pendingUrlRef.current = url
    }
  }

  // Another session opened (or navigated to) the page this tab mirrors.
  React.useEffect(() => {
    const url = sharedTabUrl(sharedTab)
    if (url === '' || url === currentUrl) return
    navigate(url)
  }, [sharedTab, currentUrl])

  const reload = (): void => {
    if (!isDesktop) {
      setIframeKey((value) => value + 1)
      return
    }
    const el = webviewRef.current
    if (el === null) return
    try {
      el.reload()
    } catch {
      /* guest gone */
    }
  }

  const closeMore = (): void => setMoreOpen(false)

  const copyCurrentUrl = async (): Promise<void> => {
    closeMore()
    if (currentUrl === '') return
    try {
      await navigator.clipboard.writeText(currentUrl)
      showToast(t('toast.copied'))
      return
    } catch {
      /* clipboard API may be unavailable on this origin */
    }
    const helper = document.createElement('textarea')
    helper.value = currentUrl
    helper.setAttribute('readonly', '')
    helper.style.position = 'fixed'
    helper.style.opacity = '0'
    document.body.appendChild(helper)
    helper.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    helper.remove()
    showToast(t(copied ? 'toast.copied' : 'toast.copyFailed'))
  }

  const hardReload = (): void => {
    closeMore()
    if (!isDesktop) {
      setIframeKey((value) => value + 1)
      showToast(t('toast.reloaded'))
      return
    }
    const el = webviewRef.current
    if (el === null) {
      showToast(t('toast.actionUnavailable'))
      return
    }
    try {
      if (typeof el.reloadIgnoringCache === 'function') el.reloadIgnoringCache()
      else el.reload()
      showToast(t('toast.reloaded'))
    } catch {
      showToast(t('toast.actionUnavailable'))
    }
  }

  const takeScreenshot = async (): Promise<void> => {
    closeMore()
    if (!isDesktop) {
      showToast(t('toast.desktopOnly'))
      return
    }
    const el = webviewRef.current
    if (el === null || typeof el.capturePage !== 'function') {
      showToast(t('toast.screenshotFailed'))
      return
    }
    try {
      const image = await el.capturePage()
      const data = (image as { toDataURL?: () => string } | null)?.toDataURL?.()
      if (typeof data !== 'string' || data === '') throw new Error('empty capture')
      const link = document.createElement('a')
      link.href = data
      link.download = `browser-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      showToast(t('toast.screenshot'))
    } catch {
      showToast(t('toast.screenshotFailed'))
    }
  }

  const clearBrowsingHistory = (): void => {
    closeMore()
    clearHistory()
    try {
      webviewRef.current?.clearHistory?.()
    } catch {
      /* guest gone */
    }
    showToast(t('toast.historyCleared'))
  }

  const togglePick = (): void => {
    if (!canPick) {
      if (isDesktop) showToast(t('pick.notReady'))
      else setSetupOpen(true)
      return
    }
    const next = !picking
    setPicking(next)
    if (!next && pendingRef.current !== null) closePickPopover()
    void callAgent('pick', next)
  }

  const toggleDeviceMode = (): void => {
    if (!responsive) {
      setDevice((d) => ({ ...d, presetId: 'responsive' }))
      return
    }
    const previous = lastDeviceRef.current
    if (previous !== null) {
      setDevice(previous)
      return
    }
    const phone = PRESET_BY_ID.get('iphone-15')
    if (phone !== undefined) setDevice((d) => applyPreset(d, phone))
  }

  const changePreset = (id: string): void => {
    if (id === 'responsive') {
      setDevice((d) => ({ ...d, presetId: 'responsive' }))
      return
    }
    const next = PRESET_BY_ID.get(id)
    if (next === undefined) return
    setDevice((d) => applyPreset(d, next))
  }

  const landscape = isLandscape(device, preset)
  const frameAllowed = preset !== null && (preset.group === 'phone' || preset.group === 'tablet')
  const frameBorder = device.frame && frameAllowed ? 16 : 0
  const studioOrigin = typeof window === 'undefined' ? '' : window.location.origin
  const htmlSnippet = agentSnippet({ origin: studioOrigin })
  const viteSnippet = [
    "import dshStudioAgent from 'dsh-browser-studio/vite'",
    '',
    'export default defineConfig({',
    '  plugins: [dshStudioAgent()],',
    '})',
  ].join('\n')
  const aiBrief = [
    '请在这台设备上的项目里，为 dsh-browser-studio 的 Web 预览接入页面 agent（只改开发环境，不要带进生产构建）。',
    '',
    '背景：DSH 的 Web 预览是跨域 iframe，页面需要自己加载一个脚本，Studio 才能点选元素。',
    '',
    '方式一（任意项目）：把下面这段放到 dev server 返回的 HTML 的 <head> 里：',
    htmlSnippet,
    '',
    '方式二（Vite 项目）：在 vite.config 里加：',
    viteSnippet,
    '',
    `说明：脚本会从 document.referrer 读取 Studio 的源，不需要写死 IP/端口（当前这台机器是 ${studioOrigin}）；只在开发环境生效；如果 CSP 禁止内联/跨域脚本，把 lib/agent.js 放到项目同源目录再引用。完成后打开 DSH 内置浏览器预览该页面，拾取按钮应变蓝可用。`,
  ].join('\n')

  const copyText = (text: string): void => {
    const done = (): void => showToast(t('setup.copied'))
    const fallback = (): void => {
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
        done()
      } catch {
        showToast(t('setup.copyFailed'))
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
      navigator.clipboard.writeText(text).then(done, fallback)
      return
    }
    fallback()
  }

  const deviceLabel =
    preset === null
      ? responsive
        ? t('device.responsive')
        : t('device.custom')
      : landscape
        ? `${preset.title} · ${t('device.landscape')}`
        : preset.title
  const showStart = currentUrl === '' && guest !== 'acquiring'
  const showSizeBar = !responsive && !showStart

  React.useEffect(() => {
    if (showSizeBar) return
    setZoomOpen(false)
    setMenuOpen(false)
  }, [showSizeBar])

  // Opening the device list anchors it under whichever button opened it.
  React.useLayoutEffect(() => {
    if (!menuOpen) return
    const anchor = sizeBtnRef.current
    const host = anchor?.parentElement
    if (!anchor || !host) return
    const width = Math.min(324, host.clientWidth - 16)
    const left = Math.min(Math.max(8, anchor.offsetLeft), Math.max(8, host.clientWidth - width - 8))
    setMenuLeft(left)
  }, [menuOpen, showSizeBar])
  const widthValue = sizeDraft?.w ?? String(size.w)
  const heightValue = sizeDraft?.h ?? String(size.h)

  const beginSizeEdit = (): void => {
    cancelSizeRef.current = false
    setSizeDraft((draft) => draft ?? { w: String(size.w), h: String(size.h) })
  }

  const changeSize = (key: 'w' | 'h', value: string): void => {
    setSizeDraft((draft) => ({
      w: draft?.w ?? String(size.w),
      h: draft?.h ?? String(size.h),
      [key]: value,
    }))
  }

  const commitSize = (): void => {
    if (cancelSizeRef.current) {
      cancelSizeRef.current = false
      setSizeDraft(null)
      return
    }
    const draft = sizeDraft
    if (draft === null) return
    setSizeDraft(null)
    const w = Math.round(Number(draft.w))
    const h = Math.round(Number(draft.h))
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return
    setDevice((d) => ({
      ...d,
      presetId: 'custom',
      width: clamp(w, 120, 4096),
      height: clamp(h, 120, 4096),
    }))
  }

  const sizeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, key: 'w' | 'h'): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelSizeRef.current = true
      setSizeDraft(null)
      event.currentTarget.blur()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1)
      const current = Number(event.currentTarget.value)
      const next = Math.max(120, Math.min(4096, (Number.isFinite(current) ? current : 0) + delta))
      changeSize(key, String(next))
    }
  }

  const guidePoint = (event: { clientX: number; clientY: number }, axis: 'x' | 'y'): number => {
    const canvas = canvasRef.current
    if (canvas === null) return 0
    const rect = canvas.getBoundingClientRect()
    const factor = scaleRef.current > 0 ? scaleRef.current : 1
    return axis === 'x' ? (event.clientX - rect.left) / factor : (event.clientY - rect.top) / factor
  }

  const removeGuide = (axis: 'x' | 'y', index: number): void => {
    setGuides((current) => ({ ...current, [axis]: current[axis].filter((_, i) => i !== index) }))
  }

  const startGuide = (event: React.PointerEvent, axis: 'x' | 'y', index: number | null): void => {
    if (event.button !== 0 || guideDrag !== null) return
    event.preventDefault()
    event.stopPropagation()
    // Capture the pointer: once the drag crosses the page (an iframe/webview),
    // the parent document would otherwise stop receiving pointer events.
    try {
      ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    } catch {
      /* older engines */
    }
    const max = axis === 'x' ? size.w : size.h
    const slot = index ?? guides[axis].length
    if (index === null) {
      const initial = Math.round(Math.min(Math.max(guidePoint(event, axis), 0), max))
      setGuides((current) => ({ ...current, [axis]: [...current[axis], initial] }))
    }
    let raw = guidePoint(event, axis)
    setGuideDrag({ axis, index: slot })
    const onMove = (moveEvent: PointerEvent): void => {
      raw = guidePoint(moveEvent, axis)
      const next = Math.round(Math.min(Math.max(raw, 0), max))
      setGuides((current) => {
        const list = [...current[axis]]
        if (list[slot] === undefined) return current
        list[slot] = next
        return { ...current, [axis]: list }
      })
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
      setGuideDrag(null)
      // Dropping the line back outside the page removes it, like a design tool.
      if (!Number.isFinite(raw) || raw < -6 || raw > max + 6) {
        setGuides((current) => ({ ...current, [axis]: current[axis].filter((_, i) => i !== slot) }))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)
  }

  // Guides live in page pixels; keep them inside the viewport when the device changes.
  React.useEffect(() => {
    setGuides((current) => {
      const x = current.x.filter((value) => value <= size.w)
      const y = current.y.filter((value) => value <= size.h)
      if (x.length === current.x.length && y.length === current.y.length) return current
      return { x, y }
    })
  }, [size.w, size.h])

  const POP_W = Math.min(340, Math.max(240, (avail.w || 360) - 24))
  const POP_H = 92
  const popLeft = anchor === null ? 12 : clamp(anchor.left, 8, Math.max(8, avail.w - POP_W - 8))
  const popTop =
    anchor === null
      ? 12
      : anchor.top + anchor.h + 10 + POP_H <= avail.h
        ? anchor.top + anchor.h + 10
        : Math.max(8, anchor.top - POP_H - 10)

  const statusParts = [formatSize(size.w, size.h)]
  statusParts.push(`${Math.round(scale * 100)}%`)
  statusParts.push(device.uaMobile ? t('status.uaMobile') : t('status.uaDesktop'))

  const deviceMenu = menuOpen ? (
      <div
        className="dbs-menu"
        ref={menuRef}
        role="dialog"
        aria-label={t('device.presets')}
        style={{ left: menuLeft }}
      >
        <div className="dbs-menuScroll">
          <button
            className="dbs-row"
            data-active={responsive}
            onClick={() => {
              changePreset('responsive')
              setMenuOpen(false)
            }}
          >
            <span className="dbs-rowMain">
              <span className="dbs-rowCheck">{responsive ? <IconCheck /> : null}</span>
              <span>{t('device.responsive')}</span>
            </span>
            <small>{t('device.fill')}</small>
          </button>
          {PRESETS.map((item) => (
            <button
              key={item.id}
              className="dbs-row"
              data-active={device.presetId === item.id}
              onClick={() => {
                changePreset(item.id)
                setMenuOpen(false)
              }}
            >
              <span className="dbs-rowMain">
                <span className="dbs-rowCheck">{device.presetId === item.id ? <IconCheck /> : null}</span>
                <span>{item.title}</span>
              </span>
              <small>
                {item.width} × {item.height}
              </small>
            </button>
          ))}
        </div>

        <div className="dbs-section">
          <div className="dbs-sectionLabel">{t('device.simulate')}</div>
          <div className="dbs-toggleRow">
            <span>{t('device.ua')}</span>
            <Switch
              on={device.uaMobile}
              label={t('device.ua')}
              onChange={(next) => setDevice((d) => ({ ...d, uaMobile: next }))}
            />
          </div>
          <div className="dbs-toggleRow" data-disabled={!frameAllowed}>
            <span>{t('device.frame')}</span>
            <Switch
              on={device.frame && frameAllowed}
              disabled={!frameAllowed}
              label={t('device.frame')}
              onChange={(next) => setDevice((d) => ({ ...d, frame: next }))}
            />
          </div>
        </div>
      </div>
  ) : null

  return (
    <div className="dbs-root">
      {/* address bar */}
      <div className="dbs-bar">
        <div className="dbs-nav">
          <button
            className="dbs-iconBtn"
            title={t('toolbar.back')}
            aria-label={t('toolbar.back')}
            disabled={!canBack}
            onClick={() => {
              try {
                webviewRef.current?.goBack()
              } catch {
                /* guest gone */
              }
            }}
          >
            <IconBack />
          </button>
          <button
            className="dbs-iconBtn"
            title={t('toolbar.forward')}
            aria-label={t('toolbar.forward')}
            disabled={!canForward}
            onClick={() => {
              try {
                webviewRef.current?.goForward()
              } catch {
                /* guest gone */
              }
            }}
          >
            <IconForward />
          </button>
          <button className="dbs-iconBtn" title={t('toolbar.reload')} aria-label={t('toolbar.reload')} onClick={reload}>
            <IconReload />
          </button>
        </div>

        <div className="dbs-addrBox">
        <form
          className="dbs-addrWrap"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(address)
          }}
        >
          <input
            ref={addressRef}
            className="dbs-addr"
            value={address}
            placeholder={t('address.placeholder')}
            spellCheck={false}
            onFocus={(event) => {
              setSuggestOpen(true)
              setSuggestIndex(-1)
              if (currentUrl !== '' && address.trim() === currentUrl) event.currentTarget.select()
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setSuggestOpen(false)
                setSuggestIndex(-1)
              }, 120)
            }}
            onChange={(event) => {
              setAddress(event.target.value)
              setSuggestOpen(true)
              setSuggestIndex(-1)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSuggestOpen(true)
                if (suggestions.length === 0) return
                setSuggestIndex((index) => (index + 1) % suggestions.length)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSuggestOpen(true)
                if (suggestions.length === 0) return
                setSuggestIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
              } else if (event.key === 'Escape') {
                setSuggestOpen(false)
                setSuggestIndex(-1)
              } else if (event.key === 'Enter' && suggestIndex >= 0 && suggestions[suggestIndex] !== undefined) {
                event.preventDefault()
                chooseSuggestion(suggestions[suggestIndex].value)
              }
            }}
          />
        </form>

        {suggestOpen && suggestions.length > 0 ? (
          <div className="dbs-suggest" ref={suggestRef} role="listbox">
            {suggestions.map((item, index) => (
              <button
                key={`${item.kind}:${item.value}`}
                className="dbs-suggestRow"
                data-active={index === suggestIndex}
                onMouseDown={(event) => {
                  event.preventDefault()
                  chooseSuggestion(item.value)
                }}
                onMouseEnter={() => setSuggestIndex(index)}
              >
                <span className="dbs-suggestIcon">
                  <IconGlobe size={16} />
                </span>
                <span className="dbs-suggestText">
                  <span className="dbs-suggestTitle">
                    <Highlight text={item.title} query={suggestQuery} />
                  </span>
                  <span className="dbs-suggestUrl">
                    <Highlight text={item.url} query={suggestQuery} />
                  </span>
                </span>
                {item.kind === 'open' ? <span className="dbs-suggestHint">{t('suggest.open')}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        </div>

        <span className="dbs-barSep" aria-hidden="true" />

        <button
          className="dbs-iconBtn dbs-toolBtn"
          data-on={picking}
          aria-disabled={!canPick}
          aria-label={picking ? t('toolbar.pickOn') : t('toolbar.pick')}
          title={
            !canPick
              ? isDesktop
                ? t('pick.notReady')
                : t('pick.needAgent')
              : picking
                ? t('toolbar.pickOn')
                : t('toolbar.pick')
          }
          onClick={togglePick}
        >
          <IconPick />
        </button>

        <button
          className="dbs-iconBtn dbs-toolBtn dbs-deviceBtn"
          data-on={!responsive}
          aria-pressed={!responsive}
          aria-label={t('device.toggle')}
          title={!responsive ? t('device.toggleOff') : t('device.toggleOn')}
          onClick={toggleDeviceMode}
        >
          <IconResponsive />
        </button>

        <button
          className="dbs-iconBtn dbs-toolBtn dbs-rulerBtn"
          data-on={device.rulers}
          aria-pressed={device.rulers}
          aria-label={t('toolbar.rulers')}
          title={t('toolbar.rulers')}
          onClick={() => setDevice((d) => ({ ...d, rulers: !d.rulers }))}
        >
          <IconRuler />
        </button>

        <button
          ref={moreBtnRef}
          className="dbs-iconBtn dbs-moreBtn"
          title={t('menu.more')}
          aria-label={t('menu.more')}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((value) => !value)}
        >
          <IconMore />
        </button>

        {moreOpen ? (
          <div className="dbs-moreMenu" ref={moreMenuRef} role="menu" aria-label={t('menu.more')}>
            <button
              className="dbs-moreRow"
              role="menuitem"
              disabled={!isDesktop || currentUrl === ''}
              onClick={takeScreenshot}
            >
              {t('menu.screenshot')}
            </button>
            <div className="dbs-moreSep" role="separator" />
            <button className="dbs-moreRow" role="menuitem" onClick={hardReload}>
              {t('menu.hardReload')}
            </button>
            <button
              className="dbs-moreRow"
              role="menuitem"
              disabled={currentUrl === ''}
              onClick={copyCurrentUrl}
            >
              {t('menu.copyUrl')}
            </button>
            <div className="dbs-moreSep" role="separator" />
            <button className="dbs-moreRow" role="menuitem" onClick={clearBrowsingHistory}>
              {t('menu.clearHistory')}
            </button>
          </div>
        ) : null}

        {setupOpen ? (
          <div className="dbs-setup" ref={setupRef} role="dialog" aria-label={t('setup.title')}>
            <div className="dbs-setupHead">
              <span>{t('setup.title')}</span>
              <button
                type="button"
                className="dbs-setupClose"
                aria-label={t('setup.close')}
                title={t('setup.close')}
                onClick={() => setSetupOpen(false)}
              >
                ×
              </button>
            </div>
            <p>{t('setup.body')}</p>
            <div className="dbs-setupLabel">{t('setup.html')}</div>
            <pre className="dbs-setupCode">{htmlSnippet}</pre>
            <div className="dbs-setupRow">
              <button type="button" className="dbs-setupBtn" onClick={() => copyText(htmlSnippet)}>
                {t('setup.copy')}
              </button>
            </div>
            <div className="dbs-setupLabel">{t('setup.vite')}</div>
            <pre className="dbs-setupCode">{viteSnippet}</pre>
            <div className="dbs-setupRow">
              <button type="button" className="dbs-setupBtn" onClick={() => copyText(viteSnippet)}>
                {t('setup.copy')}
              </button>
              <button
                type="button"
                className="dbs-setupBtn dbs-setupBtnPrimary"
                onClick={() => copyText(aiBrief)}
              >
                {t('setup.copyAi')}
              </button>
            </div>
            <p className="dbs-setupNote">{t('setup.note')}</p>
          </div>
        ) : null}
      </div>

      {showSizeBar ? (
        <div className="dbs-sizeBar">
          <button
            ref={sizeBtnRef}
            className="dbs-sizeDevice"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            title={t('device.presets')}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span>{deviceLabel}</span>
            <IconChevron />
          </button>

          <span className="dbs-sizeSep" aria-hidden="true" />

          <div
            className="dbs-sizeRow"
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
              commitSize()
            }}
          >
            <input
              className="dbs-num"
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              value={widthValue}
              aria-label={t('toolbar.width')}
              title={t('toolbar.width')}
              onFocus={beginSizeEdit}
              onChange={(event) => changeSize('w', event.target.value)}
              onKeyDown={(event) => sizeKeyDown(event, 'w')}
            />
            <span className="dbs-times">×</span>
            <input
              className="dbs-num"
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              value={heightValue}
              aria-label={t('toolbar.height')}
              title={t('toolbar.height')}
              onFocus={beginSizeEdit}
              onChange={(event) => changeSize('h', event.target.value)}
              onKeyDown={(event) => sizeKeyDown(event, 'h')}
            />
          </div>

          <span className="dbs-sizeSep" aria-hidden="true" />

          <div className="dbs-zoomWrap">
            <button
              ref={zoomBtnRef}
              className="dbs-zoomBtn"
              aria-haspopup="listbox"
              aria-expanded={zoomOpen}
              aria-label={t('device.zoom')}
              onClick={() => setZoomOpen((value) => !value)}
            >
              <span>{device.zoom === 'fit' ? t('zoom.fit') : `${Math.round(device.zoom * 100)}%`}</span>
              <IconChevron />
            </button>
            {zoomOpen ? (
              <div className="dbs-zoomMenu" ref={zoomMenuRef} role="listbox" aria-label={t('device.zoom')}>
                <button
                  className="dbs-zoomRow"
                  role="option"
                  aria-selected={device.zoom === 'fit'}
                  data-active={device.zoom === 'fit'}
                  onClick={() => {
                    setDevice((d) => ({ ...d, zoom: 'fit' }))
                    setZoomOpen(false)
                  }}
                >
                  <span className="dbs-zoomCheck">{device.zoom === 'fit' ? <IconCheck /> : null}</span>
                  <span>{t('zoom.fit')}</span>
                  <span className="dbs-zoomValue">{Math.round(scale * 100)}%</span>
                </button>
                {ZOOM_STEPS.map((step) => (
                  <button
                    key={step}
                    className="dbs-zoomRow"
                    role="option"
                    aria-selected={device.zoom === step}
                    data-active={device.zoom === step}
                    onClick={() => {
                      setDevice((d) => ({ ...d, zoom: step }))
                      setZoomOpen(false)
                    }}
                  >
                    <span className="dbs-zoomCheck">{device.zoom === step ? <IconCheck /> : null}</span>
                    <span>{Math.round(step * 100)}%</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {deviceMenu}
        </div>
      ) : null}

      {picking && pendingPick === null ? (
        <div className="dbs-pickBar" role="status">
          <span className="dbs-pickBarIcon"><IconPick /></span>
          <span className="dbs-pickBarText">{t('hint.pickShort')}</span>
          <button
            type="button"
            className="dbs-pickBarClose"
            aria-label={t('toolbar.pickOn')}
            title={t('toolbar.pickOn')}
            onClick={togglePick}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* viewport */}
      <div className="dbs-viewport" ref={viewportRef} data-responsive={responsive}>
        <div
          ref={stageRef}
          className={`dbs-stage${device.frame && frameAllowed && !responsive ? ' dbs-frame' : ''}`}
          data-picking={picking ? 'true' : undefined}
          style={{
            ...(responsive
              ? { width: '100%', height: '100%' }
              : { width: Math.max(1, size.w * scale) + frameBorder, height: Math.max(1, size.h * scale) + frameBorder }),
            // The pick border hugs the page content, inside the device frame.
            ['--dbs-frame-inset' as string]: `${device.frame && frameAllowed && !responsive ? 8 : 0}px`,
            visibility: showStart ? 'hidden' : 'visible',
          }}
        >
          {device.frame && frameAllowed && !responsive && !landscape && preset?.cutout !== undefined ? <div className="dbs-notch" /> : null}
          <div
            ref={canvasRef}
            className="dbs-canvas"
            style={
              responsive
                ? { width: '100%', height: '100%', borderRadius: 0, boxShadow: 'none' }
                : { width: size.w, height: size.h, transform: `scale(${scale})` }
            }
          >
            {isDesktop ? <div ref={setHostNode} className="dbs-guestHost" style={{ width: '100%', height: '100%', display: 'flex' }} /> : null}
            {!isDesktop && iframeUrl !== '' ? (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                className="dbs-iframe"
                src={iframeUrl}
                onLoad={() => {
                  webAgentRef.current?.reset()
                  webAgentRef.current?.greet()
                }}
                title={t('tab.title')}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : null}
          </div>
          {!responsive && !picking ? (
            <div className="dbs-sizeBadge">
              {Math.round(size.w)}px × {Math.round(size.h)}px
            </div>
          ) : null}
        </div>

        {device.rulers && rulerBox !== null && !showStart ? (
          <RulerOverlay
            box={rulerBox}
            width={size.w}
            height={size.h}
            scale={scale}
            guides={guides}
            dragging={guideDrag}
            hint={t('ruler.hint')}
            onStartGuide={startGuide}
            onRemoveGuide={removeGuide}
          />
        ) : null}

        {pendingPick !== null ? (
          <div
            className="dbs-pop"
            style={{ left: popLeft, top: popTop, width: POP_W }}
            role="dialog"
            aria-label={t('popover.title')}
          >
            <div className="dbs-popHead">
              <span className="dbs-popKicker">{t('popover.title')}</span>
              <span className="dbs-popTarget">{elementLabel(pendingPick)}</span>
              <button className="dbs-popClose" onClick={closePickPopover} aria-label={t('popover.cancel')}>
                ×
              </button>
            </div>
            <div className="dbs-popRow">
              <span className="dbs-popLink">
                <IconLink />
              </span>
              <input
                ref={inputRef}
                className="dbs-popInput"
                value={note}
                placeholder={t('popover.placeholder')}
                spellCheck={false}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    confirmPick()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    closePickPopover()
                  }
                }}
              />
              <button
                className="dbs-popSend"
                onClick={confirmPick}
                disabled={note.trim() === ''}
                aria-label={t('popover.confirm')}
                title={t('popover.confirm')}
              >
                <IconArrowRight />
              </button>
            </div>
          </div>
        ) : null}

        {showStart ? (
          <div className="dbs-start">
            <form
              className="dbs-startForm"
              onSubmit={(event) => {
                event.preventDefault()
                if (startAddress.trim() !== '') navigate(startAddress)
              }}
            >
              <span className="dbs-startSearch">
                <IconSearch size={17} />
              </span>
              <input
                ref={startRef}
                className="dbs-startInput"
                value={startAddress}
                placeholder={t('start.placeholder')}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setStartAddress(event.target.value)}
              />
            </form>

            <section className="dbs-startRecents" aria-label={t('start.recent')}>
              <div className="dbs-startRecentsLabel">{t('start.recent')}</div>
              {recentHistory.length > 0 ? (
                recentHistory.slice(0, 6).map((entry) => (
                  <button
                    key={entry.url}
                    className="dbs-recentRow"
                    title={entry.title !== '' ? `${entry.title}\n${entry.url}` : entry.url}
                    onClick={() => navigate(entry.url)}
                  >
                    <span className="dbs-recentIcon">
                      <IconGlobe size={15} />
                    </span>
                    <span className="dbs-recentUrl">{stripScheme(entry.url)}</span>
                  </button>
                ))
              ) : (
                <div className="dbs-startEmpty">{t('start.empty')}</div>
              )}
            </section>
          </div>
        ) : null}

        {guest === 'acquiring' ? <div className="dbs-loading">{t('guest.acquiring')}</div> : null}
        {loading ? <div className="dbs-loading">…</div> : null}
        {guest === 'failed' ? (
          <div className="dbs-error">
            {t('guest.failed')}
            {guestError !== '' ? <div style={{ marginTop: 4, opacity: 0.7 }}>{guestError}</div> : null}
            <div style={{ marginTop: 10 }}>
              <button className="dbs-chip" onClick={() => setRetry((value) => value + 1)}>
                {t('guest.retry')}
              </button>
            </div>
          </div>
        ) : null}
        {loadError !== '' ? <div className="dbs-error">{loadError}</div> : null}
        {toast !== '' ? <div className="dbs-toast">{toast}</div> : null}
      </div>

      {/* status */}
      {!showStart ? (
      <div className="dbs-status">
        <span>
          {statusParts.map((part, index) => (
            <React.Fragment key={part + index}>
              {index > 0 ? <span className="dbs-dot">·</span> : null}
              {part}
            </React.Fragment>
          ))}
        </span>
        <span>{count > 0 ? t('status.refs').replace('%n', String(count)) : ''}</span>
      </div>
      ) : null}
    </div>
  )
}
