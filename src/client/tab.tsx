import * as React from 'react'
import { AGENT_BOOT } from '../generated/agent-bundle'
import { PRESETS, PRESET_BY_ID, type Preset } from './presets'
import {
  applyPreset, clamp, computeScale, DEFAULT_DEVICE, formatSize, normalizeUrl, presetFor,
  rotate, viewportSize, type DeviceState,
} from './device'
import { addPendingRef, buildBlock, elementLabel, focusComposer } from './bridge'
import type { AgentEvent, ElementRef } from '../shared/types'

interface GuestElement extends HTMLElement {
  loadURL(url: string): Promise<void> | void
  getURL(): string
  getTitle(): string
  reload(): void
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
const IconExternal = (): React.ReactElement => (
  <Svg><path d="M9 3h4v4" /><path d="M13 3 7.6 8.4" /><path d="M11 9.5V13H3V5h3.5" /></Svg>
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
const IconClock = (): React.ReactElement => (
  <Svg size={13}>
    <circle cx="8" cy="8" r="5.4" />
    <path d="M8 4.8V8l2.2 1.4" />
  </Svg>
)
const IconChevron = (): React.ReactElement => (
  <Svg size={12}><path d="M4 6.5 8 10 12 6.5" /></Svg>
)
const IconPick = (): React.ReactElement => (
  <Svg>
    <circle cx="8" cy="8" r="4.2" />
    <path d="M8 1.4v2.9M8 11.7v2.9M1.4 8h2.9M11.7 8h2.9" />
  </Svg>
)
const IconRotate = (): React.ReactElement => (
  <Svg><path d="M12.6 8A4.6 4.6 0 1 1 11.2 4.8" /><path d="M12.6 2.9v2.5h-2.5" /></Svg>
)
const IconArrowRight = (): React.ReactElement => (
  <Svg size={12}><path d="M3 8h9" /><path d="M8.5 4.5 12 8l-3.5 3.5" /></Svg>
)
const IconDevice = (props: { group?: string; size?: number }): React.ReactElement => {
  const size = props.size ?? 15
  if (props.group === 'laptop') {
    return (
      <Svg size={size}>
        <rect x="3" y="3.5" width="10" height="7" rx="1.3" />
        <path d="M1.8 12.2h12.4" />
      </Svg>
    )
  }
  if (props.group === 'desktop') {
    return (
      <Svg size={size}>
        <rect x="1.8" y="2.8" width="12.4" height="8.2" rx="1.3" />
        <path d="M8 11v2.2M5.6 13.2h4.8" />
      </Svg>
    )
  }
  if (props.group === 'tablet') {
    return (
      <Svg size={size}>
        <rect x="3.2" y="1.6" width="9.6" height="12.8" rx="1.6" />
        <path d="M7.2 12.6h1.6" />
      </Svg>
    )
  }
  return (
    <Svg size={size}>
      <rect x="4.4" y="1.6" width="7.2" height="12.8" rx="1.8" />
      <path d="M7 12.5h2" />
    </Svg>
  )
}

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

export function BrowserBody(props: BodyProps): React.ReactElement {
  const { t, locale, sessionId, sendPrompt } = props
  const tab = typeof props.useTabInfo === 'function' ? props.useTabInfo().tab : undefined
  const tabId = tab?.id ?? 'default'
  const desktop = (globalThis as any).dshDesktop?.browser
  const isDesktop = typeof desktop?.acquire === 'function'

  const useWorkspaces = props.useWorkspaces
  const workspaceSnapshot: unknown = typeof useWorkspaces === 'function' ? useWorkspaces((s) => s) : undefined
  const workspaceKey = workspaceKeyOf(workspaceSnapshot, sessionId)

  const [device, setDevice] = React.useState<DeviceState>(() => readJson('device', DEFAULT_DEVICE))
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
  const [iframeUrl, setIframeUrl] = React.useState('')
  const [iframeKey, setIframeKey] = React.useState(0)
  const [workspaceFallback, setWorkspaceFallback] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [hostReady, setHostReady] = React.useState(false)
  const [pendingPick, setPendingPick] = React.useState<ElementRef | null>(null)
  const [note, setNote] = React.useState('')
  const [emptyAddress, setEmptyAddress] = React.useState('')
  const [recents, setRecents] = React.useState<string[]>(() => readJson<string[]>('recent', []))
  const [anchor, setAnchor] = React.useState<{ left: number; top: number; w: number; h: number } | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const deviceBtnRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    if (workspaceKey !== undefined || workspaceFallback) return undefined
    const timer = window.setTimeout(() => setWorkspaceFallback(true), 4000)
    return () => window.clearTimeout(timer)
  }, [workspaceKey, workspaceFallback])

  const effectiveWorkspaceKey = workspaceKey ?? (workspaceFallback ? `session:${sessionId}` : undefined)

  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const pendingRef = React.useRef<ElementRef | null>(null)
  const noteRef = React.useRef('')
  const scaleRef = React.useRef(1)
  const setHostNode = React.useCallback((node: HTMLDivElement | null): void => {
    hostRef.current = node
    setHostReady(node !== null)
  }, [])
  const webviewRef = React.useRef<GuestElement | null>(null)
  const readyRef = React.useRef(false)
  const pendingUrlRef = React.useRef('')
  const pickingRef = React.useRef(false)
  const deviceRef = React.useRef(device)
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
  const scale = computeScale(device, avail)
  scaleRef.current = scale
  const responsive = device.presetId === 'responsive'

  const showToast = React.useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current !== 0) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  React.useEffect(() => () => {
    if (toastTimer.current !== 0) window.clearTimeout(toastTimer.current)
  }, [])

  React.useEffect(() => {
    writeJson('device', device)
  }, [device])

  // Measure the viewport so fixed devices can be fitted.
  React.useLayoutEffect(() => {
    const node = viewportRef.current
    if (node === null) return undefined
    const measure = (): void => setAvail({ w: node.clientWidth, h: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Initial URL: tab navigation params win over the remembered one.
  React.useEffect(() => {
    const fromParams = typeof tab?.navigation?.params?.url === 'string' ? tab.navigation.params.url : ''
    const stored = readJson<string>('url.' + sessionId + '.' + tabId, '')
    const initial = normalizeUrl(fromParams) || normalizeUrl(stored)
    if (initial === '') return
    setAddress(initial)
    setCurrentUrl(initial)
    pendingUrlRef.current = initial
    if (!isDesktop) setIframeUrl(initial)
  }, [])

  const syncPins = React.useCallback(() => {
    const el = webviewRef.current
    if (el === null || !readyRef.current) return
    el.executeJavaScript(callCode('pins', pinsRef.current), false).catch(() => {})
  }, [])

  const beginPick = React.useCallback((ref: ElementRef) => {
    if (pendingRef.current !== null) return
    pendingRef.current = ref
    setPendingPick(ref)
    setNote('')
    window.setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  const resumePagePicking = React.useCallback(() => {
    const el = webviewRef.current
    if (el === null || !readyRef.current || !pickingRef.current) return
    el.executeJavaScript(callCode('pick', true), false).catch(() => {})
  }, [])

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
    // The dock publishes the chip list to the host; the composer stays clean.
    focusComposer(true)
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
      const el = webviewRef.current
      const stage = stageRef.current
      const viewport = viewportRef.current
      if (el === null || stage === null || viewport === null) return
      el.executeJavaScript(callCode('rect', pendingPick.selector), false).then(
        (rect: unknown) => {
          if (cancelled) return
          const r = rect as { x: number; y: number; w: number; h: number } | null
          if (r === null || r === undefined) return
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
        () => {},
      )
    }
    update()
    const timer = window.setInterval(update, 180)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pendingPick])

  React.useEffect(() => {
    const el = webviewRef.current
    if (el === null || !readyRef.current) return
    const selector = pendingPick === null ? null : pendingPick.selector
    el.executeJavaScript(callCode('highlight', selector), false).catch(() => {})
  }, [pendingPick])

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
          setCurrentUrl(url)
          setAddress((value) => (value === url ? value : url))
          writeJson('url.' + sessionId + '.' + tabId, url)
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
  }, [isDesktop, hostReady, effectiveWorkspaceKey, retry, sessionId, tabId, desktop, t])

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
      const el = webviewRef.current
      if (el === null || !readyRef.current) return
      el.executeJavaScript(callCode('drain'), false).then(
        (result: unknown) => {
          const events = (result as { events?: AgentEvent[] } | undefined)?.events ?? []
          for (const event of events) {
            if (event.kind === 'pick') {
              beginPick(event.ref)
              if (webviewRef.current !== null) {
                webviewRef.current.executeJavaScript(callCode('pick', false), false).catch(() => {})
              }
            }
            if (event.kind === 'esc') setPicking(false)
          }
        },
        () => {},
      )
    }, 170)
    return () => window.clearInterval(timer)
  }, [picking, beginPick])

  React.useEffect(() => {
    if (!menuOpen) return undefined
    const raf = window.requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector('[data-active="true"]')
      if (active instanceof HTMLElement) active.scrollIntoView({ block: 'nearest' })
    })
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (menuRef.current?.contains(target) === true) return
      if (deviceBtnRef.current?.contains(target) === true) return
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

  const navigate = (input: string): void => {
    const url = normalizeUrl(input)
    if (url === '') {
      showToast(t('address.invalid'))
      return
    }
    setAddress(url)
    setCurrentUrl(url)
    setEmptyAddress('')
    setLoadError('')
    writeJson('url.' + sessionId + '.' + tabId, url)
    setRecents((previous) => {
      const next = [url, ...previous.filter((item) => item !== url)].slice(0, 6)
      writeJson('recent', next)
      return next
    })
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

  const openExternal = (): void => {
    if (currentUrl === '') return
    window.open(currentUrl, '_blank', 'noopener')
  }

  const togglePick = (): void => {
    if (!isDesktop) {
      showToast(t('unsupported.web'))
      return
    }
    const next = !picking
    setPicking(next)
    if (!next && pendingRef.current !== null) closePickPopover()
    const el = webviewRef.current
    if (el !== null && readyRef.current) {
      el.executeJavaScript(callCode('pick', next), false).catch(() => {})
    }
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

  const editSize = (next: { width?: number; height?: number }): void => {
    setDevice((d) => ({
      ...d,
      presetId: 'custom',
      width: clamp(next.width ?? d.width, 120, 4096),
      height: clamp(next.height ?? d.height, 120, 4096),
    }))
  }

  const groups: Array<{ key: Preset['group']; label: string; items: Preset[] }> = [
    { key: 'phone', label: t('device.group.phone'), items: PRESETS.filter((p) => p.group === 'phone') },
    { key: 'tablet', label: t('device.group.tablet'), items: PRESETS.filter((p) => p.group === 'tablet') },
    { key: 'laptop', label: t('device.group.laptop'), items: PRESETS.filter((p) => p.group === 'laptop') },
    { key: 'desktop', label: t('device.group.desktop'), items: PRESETS.filter((p) => p.group === 'desktop') },
  ]

  const frameAllowed = preset !== null && (preset.group === 'phone' || preset.group === 'tablet')
  const frameBorder = device.frame && frameAllowed ? 16 : 0
  const deviceLabel = preset?.title ?? (responsive ? t('device.responsive') : t('device.custom'))
  const dirty = address.trim() !== '' && address.trim() !== currentUrl
  const zoomLabel = device.zoom === 'fit' ? `${Math.round(scale * 100)}%` : `${Math.round(device.zoom * 100)}%`
  const showStart = currentUrl === '' && guest !== 'acquiring'
  const zoomValues = ['fit', 0.5, 0.75, 1] as const
  const cycleZoom = (): void =>
    setDevice((d) => {
      const index = zoomValues.indexOf(d.zoom as (typeof zoomValues)[number])
      return { ...d, zoom: zoomValues[(index + 1) % zoomValues.length] }
    })

  const startCustom = (patch: { width?: number; height?: number }): void => {
    setDevice((d) => {
      const baseW = d.presetId === 'responsive' ? size.w : d.width
      const baseH = d.presetId === 'responsive' ? size.h : d.height
      return {
        ...d,
        presetId: 'custom',
        width: clamp(patch.width ?? baseW, 120, 4096),
        height: clamp(patch.height ?? baseH, 120, 4096),
      }
    })
  }

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

        <form
          className="dbs-addrWrap"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(address)
          }}
        >
          <span className="dbs-addrIcon">
            <IconGlobe size={14} />
          </span>
          <input
            className="dbs-addr"
            value={address}
            placeholder={t('address.placeholder')}
            spellCheck={false}
            onChange={(event) => setAddress(event.target.value)}
          />
          {dirty ? (
            <button className="dbs-go" type="submit" title={t('address.go')} aria-label={t('address.go')}>
              <IconArrowRight />
            </button>
          ) : null}
        </form>

        <button className="dbs-iconBtn" title={t('toolbar.external')} aria-label={t('toolbar.external')} onClick={openExternal}>
          <IconExternal />
        </button>
      </div>

      {/* device bar */}
      <div className="dbs-deviceBar">
        <button
          ref={deviceBtnRef}
          className="dbs-chip dbs-deviceChip"
          aria-expanded={menuOpen}
          aria-label={t('device.presets')}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <IconDevice group={preset?.group ?? 'desktop'} />
          <span>{deviceLabel}</span>
          <span className="dbs-chevron">
            <IconChevron />
          </span>
        </button>

        <span className="dbs-chip dbs-sizeChip">
          {size.w} × {size.h}
        </span>

        <button className="dbs-chip dbs-zoomChip" onClick={cycleZoom} title={t('device.zoom')}>
          {zoomLabel}
        </button>

        <div className="dbs-spacer" />

        <button
          className="dbs-pickBtn"
          data-on={picking}
          disabled={!isDesktop}
          title={!isDesktop ? t('unsupported.web') : t('toolbar.pick')}
          onClick={togglePick}
        >
          <IconPick />
          <span>{picking ? t('toolbar.pickActive') : t('toolbar.pickShort')}</span>
        </button>

        {menuOpen ? (
          <div className="dbs-menu" ref={menuRef} role="dialog" aria-label={t('device.presets')}>
            <div className="dbs-menuScroll">
              <button
                className="dbs-row"
                data-active={responsive}
                onClick={() => {
                  changePreset('responsive')
                  setMenuOpen(false)
                }}
              >
                <span>{t('device.responsive')}</span>
                <small>{t('device.fill')}</small>
              </button>
              {groups.map((group) => (
                <React.Fragment key={group.key}>
                  <div className="dbs-sectionLabel">{group.label}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className="dbs-row"
                      data-active={device.presetId === item.id}
                      onClick={() => {
                        changePreset(item.id)
                        setMenuOpen(false)
                      }}
                    >
                      <span>{item.title}</span>
                      <small>
                        {item.width}×{item.height}
                      </small>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>

            <div className="dbs-section">
              <div className="dbs-sectionLabel">{t('device.customSize')}</div>
              <div className="dbs-sizeRow">
                <input
                  className="dbs-num"
                  type="number"
                  min={120}
                  max={4096}
                  value={responsive ? size.w : device.width}
                  aria-label={t('toolbar.width')}
                  onChange={(event) => startCustom({ width: Number(event.target.value) })}
                />
                <span className="dbs-times">×</span>
                <input
                  className="dbs-num"
                  type="number"
                  min={120}
                  max={4096}
                  value={responsive ? size.h : device.height}
                  aria-label={t('toolbar.height')}
                  onChange={(event) => startCustom({ height: Number(event.target.value) })}
                />
                <button
                  className="dbs-iconBtn"
                  title={t('toolbar.rotate')}
                  aria-label={t('toolbar.rotate')}
                  disabled={responsive}
                  onClick={() => setDevice((d) => rotate(d))}
                >
                  <IconRotate />
                </button>
              </div>
            </div>

            <div className="dbs-section">
              <div className="dbs-sectionLabel">{t('device.zoom')}</div>
              <div className="dbs-seg">
                {zoomValues.map((value) => (
                  <button
                    key={String(value)}
                    className="dbs-segBtn"
                    data-active={device.zoom === value}
                    onClick={() => setDevice((d) => ({ ...d, zoom: value }))}
                  >
                    {value === 'fit' ? t('zoom.fit') : `${Math.round(value * 100)}%`}
                  </button>
                ))}
              </div>
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
        ) : null}
      </div>

      {/* viewport */}
      <div className="dbs-viewport" ref={viewportRef} data-responsive={responsive}>
        <div
          ref={stageRef}
          className={`dbs-stage${device.frame && frameAllowed && !responsive ? ' dbs-frame' : ''}`}
          style={{
            ...(responsive
              ? { width: '100%', height: '100%' }
              : { width: Math.max(1, size.w * scale) + frameBorder, height: Math.max(1, size.h * scale) + frameBorder }),
          }}
        >
          {device.frame && frameAllowed && !responsive && preset?.cutout !== undefined ? <div className="dbs-notch" /> : null}
          <div
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
                className="dbs-iframe"
                src={iframeUrl}
                title={t('tab.title')}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
        </div>

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
            <div className="dbs-startCard">
              <div className="dbs-startArt">
                <IconGlobe size={26} />
              </div>
              <div className="dbs-startTitle">{t('start.title')}</div>
              <p className="dbs-startSub">{t('start.sub')}</p>

              <form
                className="dbs-startForm"
                onSubmit={(event) => {
                  event.preventDefault()
                  navigate(emptyAddress)
                }}
              >
                <IconGlobe size={14} />
                <input
                  className="dbs-startInput"
                  value={emptyAddress}
                  placeholder={t('start.placeholder')}
                  spellCheck={false}
                  autoFocus
                  onChange={(event) => setEmptyAddress(event.target.value)}
                />
                <button className="dbs-startGo" type="submit" aria-label={t('start.open')} title={t('start.open')}>
                  <IconArrowRight />
                </button>
              </form>

              {recents.length > 0 ? (
                <div className="dbs-startSection">
                  <span className="dbs-startLabel">{t('start.recent')}</span>
                  <div className="dbs-recentList">
                    {recents.slice(0, 3).map((url) => (
                      <button key={url} className="dbs-recentRow" title={url} onClick={() => navigate(url)}>
                        <IconClock />
                        <span className="dbs-recentUrl">{url.replace(/^https?:\/\//, '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="dbs-startSection">
                <span className="dbs-startLabel">{t('start.quick')}</span>
                <div className="dbs-startChips">
                  {['localhost:3000', 'localhost:5173', 'localhost:8080', 'localhost:9000'].map((host) => (
                    <button key={host} className="dbs-startChip" onClick={() => navigate(host)}>
                      {host}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
        {picking && isDesktop && pendingPick === null ? (
          <div className="dbs-pickHint">
            <IconPick />
            {t('hint.pickShort')}
          </div>
        ) : null}
        {toast !== '' ? <div className="dbs-toast">{toast}</div> : null}
      </div>

      {/* status */}
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
    </div>
  )
}
