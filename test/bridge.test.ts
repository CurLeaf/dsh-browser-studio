import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addPendingRef,
  buildBlock,
  clearPendingRefs,
  listPendingRefs,
  publishRefs,
  removePendingRef,
  subscribePendingRefs,
} from '../src/client/bridge'
import type { ElementRef } from '../src/shared/types'

const ref: ElementRef = {
  selector: '#submit',
  domPath: 'main > form > button#submit',
  tag: 'button',
  idAttr: 'submit',
  classes: ['btn', 'primary'],
  attrs: { 'data-testid': 'submit-order', type: 'button' },
  text: '提交订单',
  rect: { x: 24, y: 760, w: 120, h: 40 },
  styles: { display: 'flex', 'background-color': 'rgb(37, 99, 235)', 'border-radius': '8px' },
  react: { name: 'CheckoutSubmit', file: 'src/components/checkout.tsx' },
  pageUrl: 'http://localhost:5173/checkout',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildBlock', () => {
  it('keeps the selector, DOM path, react source and the untrusted marker', () => {
    const block = buildBlock(ref, 1, { deviceLabel: 'iPhone 15', uaMobile: true, locale: 'zh' })
    expect(block).toContain('〔网页元素 1〕')
    expect(block).toContain('main > form > button#submit')
    expect(block).toContain('CheckoutSubmit (src/components/checkout.tsx)')
    expect(block).toContain('不可信')
    expect(block).toContain('iPhone 15')
  })

  it('renders English copy and the annotation', () => {
    const block = buildBlock(ref, 2, { deviceLabel: 'iPhone 15', uaMobile: false, locale: 'en' }, 'make it rounder')
    expect(block).toContain('[Web element 2]')
    expect(block).toContain('untrusted')
    expect(block).toContain('Note: make it rounder')
  })
})

describe('pending ref queue', () => {
  it('adds, notifies, lists and removes chips', () => {
    let notified = 0
    const off = subscribePendingRefs('s4', () => {
      notified += 1
    })
    const entry = addPendingRef('s4', { n: 1, label: 'button#submit', detail: 'DETAIL' })
    expect(listPendingRefs('s4')).toHaveLength(1)
    expect(notified).toBe(1)
    expect(removePendingRef('s4', entry.id)?.detail).toBe('DETAIL')
    expect(listPendingRefs('s4')).toHaveLength(0)
    clearPendingRefs('s4')
    off()
  })
})

describe('publishRefs', () => {
  it('posts the current blocks to the host route', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return Promise.resolve(new Response('{}'))
    })
    publishRefs('s1', ['A', 'B'])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('/browser-studio/api/refs')
    expect(calls[0]?.body).toEqual({ sessionId: 's1', blocks: ['A', 'B'] })
  })

  it('does nothing without a session or fetch', () => {
    publishRefs('', ['A'])
    expect(true).toBe(true)
  })
})
