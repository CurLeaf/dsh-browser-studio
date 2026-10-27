import * as React from 'react'
import { BrowserBody } from './tab'
import {
  clearPendingRefs,
  focusComposer,
  listPendingRefs,
  publishRefs,
  removePendingRef,
  subscribePendingRefs,
  type PendingRef,
} from './bridge'
import { CSS } from './styles'
import { EN, NS, ZH } from './i18n'
import { browserStore, type BrowserStoreActions } from './browser-store'

const TAKEOVER_ID = 'dsh-browser-studio/browser'
const ALIAS_KIND = 'studio-preview'
const ALIAS_ID = 'dsh-browser-studio/preview'
const CSS_TAG = 'dsh-browser-studio/client.css'

function IconStudio(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 5.5h13" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3.6" cy="4" r="0.6" fill="currentColor" />
      <circle cx="5.4" cy="4" r="0.6" fill="currentColor" />
      <rect x="8.6" y="11.2" width="3" height="3" rx="1.5" fill="currentColor" opacity=".9" />
      <path d="M6 14h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function installStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.querySelector(`style[data-plugin-css="${CSS_TAG}"]`) !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-browser-studio'
  tag.dataset.pluginCss = CSS_TAG
  tag.textContent = CSS
  document.head.appendChild(tag)
  return () => tag.remove()
}

function RefIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="3.4" />
      <path d="M8 1.6v2.4M8 12v2.4M1.6 8h2.4M12 8h2.4" strokeLinecap="round" />
    </svg>
  )
}

const NO_REFS: PendingRef[] = []

/**
 * Composer dock.
 *
 * Two jobs: keep the one public seam that exposes `inputActions` (`setDraft`,
 * caret insertion), and render the picked page elements as removable chips
 * above the composer. Each confirmed pick also appends a compact reference line
 * to the draft, so the sent bubble shows what travelled with it.
 */
export function ComposerDock(props: any): React.ReactElement | null {
  const sessionId: string | undefined = props.sessionId
  const draft: string = typeof props.input?.draft === 'string' ? props.input.draft : ''
  const t: (key: string) => string = typeof props.t === 'function' ? props.t : (key) => key

  const subscribe = React.useCallback(
    (listener: () => void) => (typeof sessionId === 'string' ? subscribePendingRefs(sessionId, listener) : () => {}),
    [sessionId],
  )
  const snapshot = React.useCallback(
    () => (typeof sessionId === 'string' ? listPendingRefs(sessionId) : NO_REFS),
    [sessionId],
  )
  const refs = React.useSyncExternalStore(subscribe, snapshot, snapshot)

  // Publish non-empty chip lists: the host injects them as one hidden context
  // message on the next agent step.
  React.useEffect(() => {
    if (typeof sessionId !== 'string' || refs.length === 0) return
    if (clearTimer.current !== 0) {
      window.clearTimeout(clearTimer.current)
      clearTimer.current = 0
    }
    clearGeneration.current += 1
    publishRefs(sessionId, refs.map((ref) => ref.detail))
  }, [refs, sessionId])

  // A send empties the draft: drop the chips, then clear the host copy after the
  // step had time to consume it. Clearing too early would race `agent/pre-step`.
  const previousDraft = React.useRef('')
  const clearTimer = React.useRef(0)
  const clearGeneration = React.useRef(0)
  React.useEffect(() => {
    const before = previousDraft.current
    previousDraft.current = draft
    if (typeof sessionId !== 'string') return undefined
    if (before.trim() === '' || draft.trim() !== '' || listPendingRefs(sessionId).length === 0) return undefined
    clearPendingRefs(sessionId)
    const generation = ++clearGeneration.current
    if (clearTimer.current !== 0) window.clearTimeout(clearTimer.current)
    clearTimer.current = window.setTimeout(() => {
      clearTimer.current = 0
      if (clearGeneration.current === generation && listPendingRefs(sessionId).length === 0) {
        publishRefs(sessionId, [])
      }
    }, 8000)
    return () => {
      /* the timer is shared across renders; the generation guards it */
    }
  }, [draft, sessionId])

  if (typeof sessionId !== 'string' || refs.length === 0) return null

  return (
    <div className="dbs-refs" aria-label={t('dock.label')}>
      {refs.map((ref) => (
        <span className="dbs-refChip" key={ref.id} title={ref.detail}>
          <span className="dbs-refIcon">
            <RefIcon />
          </span>
          <b>{t('dock.index').replace('%n', String(ref.n))}</b>
          {ref.note !== undefined && ref.note !== '' ? <span className="dbs-refNote">{ref.note}</span> : null}
          <span className="dbs-refLabel">{ref.label}</span>
          <button
            type="button"
            className="dbs-refRemove"
            aria-label={t('dock.remove')}
            title={t('dock.remove')}
            onClick={() => {
              removePendingRef(sessionId, ref.id)
              publishRefs(sessionId, listPendingRefs(sessionId).map((item) => item.detail))
              focusComposer()
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

export const inject = ['slots', 'sessions', 'locale']

export function apply(ctx: any): void {
  const t = ctx.locale.bind(NS)
  const activeLocale = (): 'zh' | 'en' => {
    try {
      const active = ctx.locale.getLocale()?.active
      return typeof active === 'string' && active.toLowerCase().startsWith('zh') ? 'zh' : 'en'
    } catch {
      return 'en'
    }
  }

  ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'browser-studio: dictionaries')
  ctx.effect(installStyles, 'browser-studio: styles')

  const sendPrompt = async (sessionId: string, text: string): Promise<void> => {
    const sessions = ctx.get('sessions')
    if (sessions === undefined) throw new Error('browser-studio: sessions unavailable')
    const conversation = sessions.scope(sessionId)?.get('conversation')
    if (conversation !== undefined) {
      await conversation.send(text)
      return
    }
    const session = sessions.binding(sessionId)?.session
    if (session === undefined) throw new Error('browser-studio: session is no longer open')
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (result?.ok !== true) throw new Error('browser-studio: message was rejected')
  }

  const bodyInject = () => ({ t, locale: activeLocale(), sendPrompt })

  ctx.inject(['uiConversation', 'slots'], (conversation: any) => {
    conversation.effect(
      () =>
        conversation.slots.register(
          {
            name: 'conversation.input.dock',
            id: 'browser-studio-dock',
            order: 15,
            locale: NS,
            label: () => t('dock.label'),
            inject: (sessionId: string) => ({ sessionId, t }),
          },
          ComposerDock,
        ),
      'browser-studio: composer dock',
    )
  })

  const desktopBridge = (globalThis as any).dshDesktop?.browser
  const desktop = typeof desktopBridge?.acquire === 'function'

  ctx.inject(['sidebarRight', 'sidebarRightTabs'], (sidebar: any) => {
    if (desktop) {
      const takeover = {
        id: TAKEOVER_ID,
        kind: 'browser',
        multiple: true,
        keepMounted: true,
        title: () => t('browser.title'),
        guide: [
          {
            id: 'studio',
            commandId: 'browser.new',
            order: 30,
            title: () => t('browser.title'),
            description: () => t('browser.guide'),
            icon: IconStudio,
          },
        ],
      }
      sidebar.effect(() => sidebar.sidebarRightTabs.register(takeover), 'browser-studio: browser takeover')

      /** Bound store actions plus the layout inventory, used to forget a genuinely closed tab. */
      const takeoverInject = (sessionId: string, actions: BrowserStoreActions) => ({
        ...bodyInject(),
        storeActions: actions,
        isTabOpen: (tabId: string): boolean => {
          try {
            return sidebar.openTabs
              .getSnapshot()
              .some((tab: any) => tab.sessionId === sessionId && tab.tabId === tabId)
          } catch {
            return true
          }
        },
      })

      sidebar.slots.inject('sidebar.right.pane.tab', () => {
        const body: any = {
          name: 'sidebar.right.pane.tab',
          key: TAKEOVER_ID,
          locale: NS,
          inject: takeoverInject,
        }
        // Same persisted store the shipped Browser declares, so sidebar sharing
        // can mirror the current URL between sessions.
        if (browserStore !== undefined) body.store = browserStore
        return sidebar.slots.register(body, BrowserBody)
      })
      return
    }

    // Web: no guest lease, so the shipped Browser stays untouched and this is
    // an extra iframe tab that only previews sizes.
    const alias = {
      id: ALIAS_ID,
      kind: ALIAS_KIND,
      multiple: true,
      keepMounted: true,
      title: () => t('tab.title'),
      guide: [
        {
          id: 'studio-web',
          order: 31,
          title: () => t('tab.title'),
          description: () => t('tab.guide'),
          icon: IconStudio,
        },
      ],
    }
    sidebar.effect(() => sidebar.sidebarRightTabs.register(alias), 'browser-studio: preview tab')
    sidebar.slots.inject('sidebar.right.pane.tab', () =>
      sidebar.slots.register(
        {
          name: 'sidebar.right.pane.tab',
          key: ALIAS_ID,
          locale: NS,
          inject: bodyInject,
        },
        BrowserBody,
      ),
    )
  })
}
