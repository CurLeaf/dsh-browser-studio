/**
 * Page-side agent for dsh-browser-studio.
 *
 * Injected into the visited page through `<webview>.executeJavaScript()`.
 * It owns a Shadow-DOM overlay (page CSS cannot reach it), the element picker,
 * the numbered pins and the queue the embedder drains.
 *
 * Everything here runs in the page's main world: the page can tamper with it.
 * That is why the embedder treats every field as untrusted page data and the
 * user has to confirm before a block reaches the session.
 */
import { getDisplayName, getFiberFromHostInstance, getLatestFiber, type Fiber } from 'bippy'
import { getOwnerStack, getSource } from 'bippy/source'
import type { AgentEvent, ElementRef, Pin } from '../shared/types'

const KEY = '__DSH_STUDIO_AGENT__'
const VERSION = 1
const ATTR_HOST = 'data-dsh-studio-host'

const BOX_CSS =
  'position:fixed;pointer-events:none;border:1.5px solid #2f6fed;background:rgba(47,111,237,.12);' +
  'border-radius:2px;box-sizing:border-box;display:none;z-index:2147483646'
const TAG_CSS =
  'position:fixed;pointer-events:none;background:#2f6fed;color:#fff;' +
  'font:500 11px/16px system-ui,-apple-system,Segoe UI,sans-serif;padding:2px 6px;border-radius:4px;' +
  'max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none;' +
  'box-shadow:0 1px 4px rgba(0,0,0,.25);z-index:2147483647'
const PIN_CSS =
  'position:fixed;pointer-events:none;transform:translate(-50%,-50%);background:#2f6fed;color:#fff;' +
  'font:600 11px/16px system-ui,-apple-system,Segoe UI,sans-serif;min-width:16px;height:16px;' +
  'border-radius:8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35);padding:0 4px;box-sizing:border-box;' +
  'z-index:2147483647'
const HINT_CSS =
  'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);pointer-events:none;' +
  'background:rgba(17,24,39,.92);color:#fff;font:500 12px/18px system-ui,-apple-system,Segoe UI,sans-serif;' +
  'padding:6px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.28);white-space:nowrap;' +
  'z-index:2147483647'

const STYLE_KEYS = [
  'display', 'position', 'width', 'height', 'padding', 'margin', 'color', 'background-color',
  'border', 'border-radius', 'font-size', 'font-weight', 'line-height', 'flex', 'flex-direction',
  'gap', 'grid-template-columns', 'align-items', 'justify-content', 'box-shadow', 'opacity', 'z-index',
]

function boot(): void {
  const root = window as unknown as Record<string, unknown>
  const existing = root[KEY] as { version?: number; rebind?: () => void } | undefined
  if (existing !== undefined && existing.version === VERSION) {
    try {
      existing.rebind?.()
    } catch {
      /* the page replaced something; caller re-injects on navigation */
    }
    return
  }

  let picking = false
  let hover: Element | null = null
  let host: HTMLDivElement | null = null
  let shadow: ShadowRoot | null = null
  let box: HTMLDivElement | null = null
  let tag: HTMLDivElement | null = null
  let hint: HTMLDivElement | null = null
  let pinsLayer: HTMLDivElement | null = null
  let pinNodes: Array<{ el: HTMLDivElement; selector: string; n: number }> = []
  let events: AgentEvent[] = []
  let pins: Pin[] = []
  let highlighted: Element | null = null
  let pending: Array<Promise<void>> = []
  let copy = { pick: '点击元素加入对话 · Esc 退出', added: '已加入对话' }

  const doc = document
  const safe = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn()
    } catch {
      return fallback
    }
  }

  function ensureHost(): void {
    if (host !== null && host.isConnected) return
    host = doc.createElement('div')
    host.setAttribute(ATTR_HOST, '')
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647'
    const parent = doc.body ?? doc.documentElement
    parent.appendChild(host)
    shadow = host.attachShadow({ mode: 'open' })
    const style = doc.createElement('style')
    style.textContent = '.dbs-box{all:initial}'
    shadow.appendChild(style)
    box = doc.createElement('div')
    box.setAttribute('style', BOX_CSS)
    box.setAttribute('data-dbs-box', '')
    tag = doc.createElement('div')
    tag.setAttribute('style', TAG_CSS)
    pinsLayer = doc.createElement('div')
    pinsLayer.setAttribute('style', 'position:fixed;inset:0;pointer-events:none;z-index:2147483646')
    hint = doc.createElement('div')
    hint.setAttribute('style', HINT_CSS)
    shadow.appendChild(pinsLayer)
    shadow.appendChild(box)
    shadow.appendChild(tag)
    shadow.appendChild(hint)
  }

  function position(el: Element, node: HTMLElement | null, label?: string): void {
    if (node === null) return
    const r = el.getBoundingClientRect()
    node.style.left = `${r.left}px`
    node.style.top = `${r.top}px`
    node.style.width = `${Math.max(0, r.width)}px`
    node.style.height = `${Math.max(0, r.height)}px`
    if (label !== undefined) node.textContent = label
  }

  function describe(el: Element): string {
    const tagName = el.tagName.toLowerCase()
    const id = el.id !== '' ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim() !== ''
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : ''
    return `${tagName}${id}${cls}`
  }

  function cssEscape(value: string): string {
    const anyCss = (window as unknown as { CSS?: { escape?: (v: string) => string } }).CSS
    return anyCss?.escape !== undefined ? anyCss.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
  }

  function unique(selector: string): boolean {
    try {
      return doc.querySelectorAll(selector).length === 1
    } catch {
      return false
    }
  }

  function selectorFor(el: Element): string {
    const testId = el.getAttribute('data-testid') ?? el.getAttribute('data-test')
    if (testId !== null && testId !== '') return `[data-testid="${testId.replace(/"/g, '\\"')}"]`
    if (el.id !== '' && unique(`#${cssEscape(el.id)}`)) return `#${cssEscape(el.id)}`

    const parts: string[] = []
    let node: Element | null = el
    while (node !== null && node.nodeType === 1 && node !== doc.documentElement) {
      if (node !== el) {
        const testId2 = node.getAttribute('data-testid') ?? node.getAttribute('data-test')
        if (testId2 !== null && testId2 !== '') {
          parts.unshift(`[data-testid="${testId2.replace(/"/g, '\\"')}"]`)
          break
        }
        if (node.id !== '' && unique(`#${cssEscape(node.id)}`)) {
          parts.unshift(`#${cssEscape(node.id)}`)
          break
        }
      }
      let part = node.tagName.toLowerCase()
      if (typeof node.className === 'string') {
        const classes = node.className.trim().split(/\s+/).filter((c) => c !== '' && !c.includes(':')).slice(0, 2)
        if (classes.length > 0) part += `.${classes.map(cssEscape).join('.')}`
      }
      const parent: Element | null = node.parentElement
      if (parent !== null) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node?.tagName)
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
      }
      parts.unshift(part)
      const candidate = parts.join(' > ')
      if (unique(candidate)) return candidate
      node = parent
    }
    return parts.join(' > ')
  }

  function domPath(el: Element): string {
    const parts: string[] = []
    let node: Element | null = el
    while (node !== null && node.nodeType === 1 && node !== doc.documentElement && parts.length < 8) {
      let part = node.tagName.toLowerCase()
      if (node.id !== '') part += `#${node.id}`
      parts.unshift(part)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  function collectAttrs(el: Element): Record<string, string> {
    const out: Record<string, string> = {}
    let n = 0
    for (const attr of Array.from(el.attributes)) {
      if (n >= 12) break
      if (attr.name === 'style') continue
      out[attr.name] = attr.value.length > 120 ? `${attr.value.slice(0, 120)}…` : attr.value
      n += 1
    }
    return out
  }

  function collectStyles(el: Element): Record<string, string> {
    const out: Record<string, string> = {}
    const computed = window.getComputedStyle(el)
    for (const key of STYLE_KEYS) {
      const value = computed.getPropertyValue(key)
      if (value !== '') out[key] = value.length > 80 ? `${value.slice(0, 80)}…` : value
    }
    return out
  }

  function componentName(fiber: Fiber | null): string | undefined {
    if (fiber === null) return undefined
    try {
      const latest = getLatestFiber(fiber)
      let node: Fiber | null = latest
      for (let i = 0; i < 12 && node !== null; i += 1) {
        const current: Fiber = node
        const name = safe(() => getDisplayName(current.type), null)
        if (name !== null && name.length > 1 && /^[A-Z]/.test(name)) return name
        node = current.return
      }
    } catch {
      /* not a React tree */
    }
    return undefined
  }

  async function reactInfo(el: Element): Promise<ElementRef['react']> {
    try {
      const fiber = getFiberFromHostInstance(el)
      if (fiber === null) return undefined
      const name = componentName(fiber)
      const result: NonNullable<ElementRef['react']> = {}
      if (name !== undefined) result.name = name
      const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T | null> => {
        return await Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))])
      }
      const vite = (window as unknown as { __vite_plugin_react_preamble_installed__?: boolean }).__vite_plugin_react_preamble_installed__ === true
      const source = await withTimeout(getSource(fiber), 240)
      if (source !== null && typeof source === 'object' && typeof source.fileName === 'string') {
        result.file = source.fileName
        // Vite's transform makes owner-stack line numbers unreliable (react-grab
        // reached the same conclusion); keep the file, drop the line.
        if (!vite && typeof source.lineNumber === 'number') result.line = source.lineNumber
      }
      if (result.file === undefined) {
        const stack = await withTimeout(getOwnerStack(fiber), 240)
        if (Array.isArray(stack)) {
          const frame = stack.find((f) => typeof f.fileName === 'string' && !f.fileName.includes('node_modules'))
          if (frame !== undefined && typeof frame.fileName === 'string') {
            result.file = frame.fileName
            if (!vite && frame.isSymbolicated === true && typeof frame.lineNumber === 'number') {
              result.line = frame.lineNumber
            }
          }
        }
      }
      if (name !== undefined) result.component = name
      return Object.keys(result).length > 0 ? result : undefined
    } catch {
      return undefined
    }
  }

  function snapshot(el: Element): ElementRef {
    const r = el.getBoundingClientRect()
    const ref: ElementRef = {
      selector: safe(() => selectorFor(el), el.tagName.toLowerCase()),
      domPath: domPath(el),
      tag: el.tagName.toLowerCase(),
      idAttr: el.id,
      classes: typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 8) : [],
      attrs: collectAttrs(el),
      text: safe(() => (el as HTMLElement).innerText ?? el.textContent ?? '', '').replace(/\s+/g, ' ').trim().slice(0, 300),
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      styles: safe(() => collectStyles(el), {}),
      pageUrl: location.href,
    }
    const info = reactInfo(el)
    pending.push(
      info.then((value) => {
        if (value !== undefined) ref.react = value
      }),
    )
    return ref
  }

  function showHover(el: Element | null): void {
    hover = el
    if (box === null || tag === null) return
    if (el === null || el === doc.documentElement || el === doc.body) {
      box.style.display = 'none'
      tag.style.display = 'none'
      return
    }
    box.style.display = 'block'
    tag.style.display = 'block'
    position(el, box)
    const r = el.getBoundingClientRect()
    tag.textContent = `${describe(el)} · ${Math.round(r.width)}×${Math.round(r.height)}`
    tag.style.left = `${Math.max(0, Math.min(r.left, window.innerWidth - 320))}px`
    tag.style.top = `${Math.max(0, r.top - 20)}px`
  }

  function hideOverlay(): void {
    hover = null
    if (box !== null) box.style.display = 'none'
    if (tag !== null) tag.style.display = 'none'
    if (hint !== null) hint.style.display = 'none'
  }

  function onMove(event: MouseEvent): void {
    if (!picking) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest(`[${ATTR_HOST}]`) !== null) return
    showHover(target)
  }

  function onClick(event: MouseEvent): void {
    if (!picking) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest(`[${ATTR_HOST}]`) !== null) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    const ref = snapshot(target)
    events.push({ kind: 'pick', ref })
    if (hint !== null) {
      hint.textContent = copy.added
      window.setTimeout(() => {
        if (hint !== null && picking) hint.textContent = copy.pick
      }, 900)
    }
    showHover(null)
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && picking) {
      setPick(false)
      events.push({ kind: 'esc' })
    }
  }

  function bind(): void {
    ensureHost()
    doc.addEventListener('mousemove', onMove, true)
    doc.addEventListener('click', onClick, true)
    doc.addEventListener('keydown', onKey, true)
  }

  function unbind(): void {
    doc.removeEventListener('mousemove', onMove, true)
    doc.removeEventListener('click', onClick, true)
    doc.removeEventListener('keydown', onKey, true)
  }

  function setPick(on: boolean): void {
    picking = on
    ensureHost()
    if (on) {
      bind()
      if (hint !== null) {
        hint.textContent = copy.pick
        hint.style.display = 'block'
      }
    } else {
      unbind()
      hideOverlay()
    }
  }

  function paintHighlight(): void {
    if (highlighted === null || box === null) return
    if (!highlighted.isConnected) {
      highlighted = null
      box.style.display = 'none'
      return
    }
    box.style.display = 'block'
    position(highlighted, box)
  }

  function paintPins(): void {
    if (shadow === null) return
    if (pinsLayer === null) return
    pinsLayer.textContent = ''
    pinNodes = []
    for (const pin of pins) {
      const el = safe(() => doc.querySelector(pin.selector), null)
      if (el === null) continue
      const node = doc.createElement('div')
      node.setAttribute('style', PIN_CSS)
      node.textContent = String(pin.n)
      pinsLayer.appendChild(node)
      pinNodes.push({ el: node, selector: pin.selector, n: pin.n })
    }
    layoutPins()
  }

  function layoutPins(): void {
    for (const pin of pinNodes) {
      const el = safe(() => doc.querySelector(pin.selector), null)
      if (el === null) continue
      const r = el.getBoundingClientRect()
      pin.el.style.left = `${r.left + 8}px`
      pin.el.style.top = `${r.top + 8}px`
    }
  }

  window.addEventListener('scroll', () => { layoutPins(); paintHighlight() }, { capture: true, passive: true })
  window.addEventListener('resize', () => { layoutPins(); paintHighlight() }, { passive: true })

  function call(cmd: string, arg?: unknown): unknown {
    switch (cmd) {
      case 'ping':
        return { ok: true, version: VERSION }
      case 'pick':
        setPick(arg === true)
        return { ok: true }
      case 'drain': {
        const take = async (): Promise<{ events: AgentEvent[] }> => {
          if (pending.length > 0) {
            await Promise.race([
              Promise.allSettled(pending),
              new Promise((resolve) => setTimeout(resolve, 300)),
            ])
            pending = []
          }
          const out = events
          events = []
          return { events: out }
        }
        return take()
      }
      case 'rect': {
        const selector = typeof arg === 'string' ? arg : ''
        const el = selector === '' ? null : safe(() => doc.querySelector(selector), null)
        if (el === null) return null
        const r = el.getBoundingClientRect()
        return {
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          vw: window.innerWidth,
          vh: window.innerHeight,
        }
      }
      case 'highlight': {
        const selector = typeof arg === 'string' ? arg : ''
        if (selector === '') {
          highlighted = null
          if (box !== null) box.style.display = 'none'
          return { ok: true }
        }
        const el = safe(() => doc.querySelector(selector), null)
        highlighted = el
        paintHighlight()
        return { ok: el !== null }
      }
      case 'pins': {
        pins = Array.isArray(arg) ? (arg as Pin[]) : []
        paintPins()
        return { ok: true, count: pins.length }
      }
      case 'clear':
        pins = []
        events = []
        highlighted = null
        if (box !== null) box.style.display = 'none'
        if (pinsLayer !== null) pinsLayer.textContent = ''
        return { ok: true }
      case 'copy': {
        if (typeof arg === 'object' && arg !== null) copy = { ...copy, ...(arg as Record<string, string>) }
        return { ok: true }
      }
      default:
        return { ok: false, error: 'unknown command' }
    }
  }

  function rebind(): void {
    ensureHost()
    if (picking) {
      unbind()
      bind()
    }
  }

  root[KEY] = { version: VERSION, call, rebind }
}

boot()
