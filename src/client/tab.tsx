import * as React from 'react'
import { AGENT_BOOT } from '../generated/agent-bundle'
import { PRESETS, PRESET_BY_ID, type Preset } from './presets'
import {
  applyPreset, clamp, computeScale, DEFAULT_DEVICE, formatSize, normalizeUrl, presetFor,
  rotate, viewportSize, type DeviceState,
} from './device'
import { buildBlock, insertBlock } from './bridge'
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

  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const hostRef = React.useRef<HTMLDivElement | null>(null)
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
  localeRef.current = locale
  pickingRef.current = picking

  const preset = presetFor(device.presetId)
  const ua = device.uaMobile ? preset?.ua ?? FALLBACK_MOBILE_UA : DESKTOP_UA
  const size = viewportSize(device, avail)
  const scale = computeScale(device, avail)
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

  const handlePick = React.useCallback((ref: ElementRef) => {
    const n = countRef.current + 1
    countRef.current = n
    setCount(n)
    const d = deviceRef.current
    const p = presetFor(d.presetId)
    const label = p?.title ?? (d.presetId === 'responsive' ? 'Responsive' : 'Custom')
    const block = buildBlock(ref, n, { deviceLabel: label, uaMobile: d.uaMobile, locale: localeRef.current })
    const inserted = insertBlock(sessionId, block)
    if (inserted) {
      showToast(t('toast.added'))
    } else {
      sendPrompt(sessionId, block).then(
        () => showToast(t('toast.sent')),
        () => showToast(t('toast.failed')),
      )
    }
    pinsRef.current = [...pinsRef.current, { n, selector: ref.selector }]
    syncPins()
  }, [sessionId, sendPrompt, showToast, t, syncPins])

  // Guest lifecycle: one lease, one webview, events wired to React state.
  React.useLayoutEffect(() => {
    if (!isDesktop) return undefined
    const host = hostRef.current
    if (host === null) return undefined
    if (workspaceKey === undefined) return undefined

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
        reservation = await desktop.acquire(workspaceKey)
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
  }, [isDesktop, workspaceKey, retry, sessionId, tabId, desktop, t])

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
            if (event.kind === 'pick') handlePick(event.ref)
            if (event.kind === 'esc') setPicking(false)
          }
        },
        () => {},
      )
    }, 170)
    return () => window.clearInterval(timer)
  }, [picking, handlePick])

  const navigate = (input: string): void => {
    const url = normalizeUrl(input)
    if (url === '') {
      showToast(t('address.invalid'))
      return
    }
    setAddress(url)
    setCurrentUrl(url)
    setLoadError('')
    writeJson('url.' + sessionId + '.' + tabId, url)
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

  const status = responsive
    ? `${formatSize(size.w, size.h)} · ${t('status.uaDesktop')}`
    : `${formatSize(size.w, size.h)} · DPR ${preset?.dpr ?? 1} · ${Math.round(scale * 100)}% · ${device.uaMobile ? t('status.uaMobile') : t('status.uaDesktop')}`

  const showStart = currentUrl === '' && guest !== 'acquiring'

  return (
    <div className="dbs-root">
      <div className="dbs-bar">
        <button
          className="dbs-icon"
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
          ←
        </button>
        <button
          className="dbs-icon"
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
          →
        </button>
        <button className="dbs-icon" title={t('toolbar.reload')} aria-label={t('toolbar.reload')} onClick={reload}>
          ⟳
        </button>
        <form
          className="dbs-addrForm"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(address)
          }}
        >
          <input
            className="dbs-addr"
            value={address}
            placeholder={t('address.placeholder')}
            spellCheck={false}
            onChange={(event) => setAddress(event.target.value)}
          />
        </form>
        <button className="dbs-icon" title={t('toolbar.external')} aria-label={t('toolbar.external')} onClick={openExternal}>
          ↗
        </button>
      </div>

      <div className="dbs-device">
        <select
          className="dbs-select"
          value={device.presetId === 'custom' ? 'custom' : device.presetId}
          onChange={(event) => changePreset(event.target.value)}
          aria-label={t('block.device')}
        >
          <option value="responsive">{t('device.responsive')}</option>
          {device.presetId === 'custom' ? <option value="custom">{t('device.custom')}</option> : null}
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <optgroup key={group.key} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
        <input
          className="dbs-num"
          type="number"
          min={120}
          max={4096}
          value={size.w}
          aria-label={t('toolbar.width')}
          onChange={(event) => editSize({ width: Number(event.target.value) })}
        />
        <span className="dbs-dim">×</span>
        <input
          className="dbs-num"
          type="number"
          min={120}
          max={4096}
          value={size.h}
          aria-label={t('toolbar.height')}
          onChange={(event) => editSize({ height: Number(event.target.value) })}
        />
        <button
          className="dbs-icon"
          title={t('toolbar.rotate')}
          aria-label={t('toolbar.rotate')}
          disabled={responsive}
          onClick={() => setDevice((d) => rotate(d))}
        >
          ⇄
        </button>
        <select
          className="dbs-select"
          value={String(device.zoom)}
          onChange={(event) => {
            const value = event.target.value
            setDevice((d) => ({ ...d, zoom: value === 'fit' ? 'fit' : (Number(value) as 0.5 | 0.75 | 1) }))
          }}
          aria-label={t('zoom.fit')}
        >
          <option value="fit">{t('zoom.fit')}</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
        </select>
        <button
          className="dbs-icon"
          data-on={device.uaMobile}
          title="UA"
          aria-label="UA"
          onClick={() => setDevice((d) => ({ ...d, uaMobile: !d.uaMobile }))}
        >
          UA
        </button>
        <button
          className="dbs-icon"
          data-on={device.frame}
          title={t('toolbar.frame')}
          aria-label={t('toolbar.frame')}
          onClick={() => setDevice((d) => ({ ...d, frame: !d.frame }))}
        >
          ▣
        </button>
        <button
          className="dbs-icon"
          data-on={picking}
          title={picking ? t('toolbar.pickOn') : t('toolbar.pick')}
          aria-label={t('toolbar.pick')}
          onClick={togglePick}
        >
          ⊕
        </button>
      </div>

      <div className="dbs-viewport" ref={viewportRef} data-responsive={responsive}>
        {showStart ? (
          <div className="dbs-start">
            <b>{t('hint.start')}</b>
            <small>{t('hint.startSub')}</small>
          </div>
        ) : null}

        <div
          className={`dbs-stage${device.frame && !responsive ? ' dbs-frame' : ''}`}
          style={
            responsive
              ? { width: '100%', height: '100%' }
              : { width: Math.max(1, size.w * scale), height: Math.max(1, size.h * scale) }
          }
        >
          {device.frame && !responsive && preset?.cutout !== undefined ? <div className="dbs-notch" /> : null}
          <div
            className="dbs-canvas"
            style={
              responsive
                ? { width: '100%', height: '100%' }
                : { width: size.w, height: size.h, transform: `scale(${scale})` }
            }
          >
            {isDesktop ? <div ref={hostRef} style={{ width: '100%', height: '100%', display: 'flex' }} /> : null}
            {!isDesktop && iframeUrl !== '' ? (
              <iframe
                className="dbs-iframe"
                key={iframeKey}
                src={iframeUrl}
                title={t('tab.title')}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
        </div>

        {guest === 'acquiring' ? <div className="dbs-loading">{t('guest.acquiring')}</div> : null}
        {loading ? <div className="dbs-loading">…</div> : null}
        {guest === 'failed' ? (
          <div className="dbs-error">
            {t('guest.failed')}
            {guestError !== '' ? <div style={{ marginTop: 4, opacity: 0.7 }}>{guestError}</div> : null}
            <div style={{ marginTop: 8 }}>
              <button className="dbs-icon" onClick={() => setRetry((value) => value + 1)}>
                {t('guest.retry')}
              </button>
            </div>
          </div>
        ) : null}
        {loadError !== '' ? <div className="dbs-error">{loadError}</div> : null}
        {toast !== '' ? <div className="dbs-toast">{toast}</div> : null}
      </div>

      <div className="dbs-status">
        <span>{status}</span>
        {count > 0 ? <span>· {count}</span> : null}
      </div>
    </div>
  )
}
