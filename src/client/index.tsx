import * as React from 'react'
import { BrowserBody } from './tab'
import { registerDraftBridge } from './bridge'
import { CSS } from './styles'
import { EN, NS, ZH } from './i18n'

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

/** Draft bridge: the dock slot is the only public seam that exposes `inputActions`. */
function ComposerDock(props: any): null {
  const sessionId: string | undefined = props.sessionId
  const draftRef = React.useRef('')
  const actionsRef = React.useRef<any>(null)
  draftRef.current = typeof props.input?.draft === 'string' ? props.input.draft : ''
  actionsRef.current = props.inputActions ?? null

  React.useEffect(() => {
    if (typeof sessionId !== 'string' || sessionId === '') return undefined
    return registerDraftBridge(sessionId, {
      getDraft: () => draftRef.current,
      setDraft: (text: string) => {
        const actions = actionsRef.current
        if (actions !== null && typeof actions.setDraft === 'function') actions.setDraft(text)
      },
    })
  }, [sessionId])

  return null
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
            order: 20,
            label: () => t('dock.label'),
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
      sidebar.slots.inject('sidebar.right.pane.tab', () =>
        sidebar.slots.register(
          {
            name: 'sidebar.right.pane.tab',
            key: TAKEOVER_ID,
            locale: NS,
            inject: bodyInject,
          },
          BrowserBody,
        ),
      )
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
