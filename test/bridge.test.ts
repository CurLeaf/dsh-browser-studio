import { describe, expect, it } from 'vitest'
import {
  addPendingRef,
  buildBlock,
  buildTag,
  insertAtCaret,
  listPendingRefs,
  registerDraftBridge,
  removePendingRef,
  removeTagText,
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

describe('buildBlock', () => {
  it('keeps the selector, DOM path, react source and the untrusted marker', () => {
    const block = buildBlock(ref, 1, { deviceLabel: 'iPhone 15', uaMobile: true, locale: 'zh' })
    expect(block).toContain('〔网页元素 1〕')
    expect(block).toContain('main > form > button#submit')
    expect(block).toContain('CheckoutSubmit (src/components/checkout.tsx)')
    expect(block).toContain('不可信')
    expect(block).toContain('iPhone 15')
  })

  it('renders English copy when asked', () => {
    const block = buildBlock(ref, 2, { deviceLabel: 'iPhone 15', uaMobile: false, locale: 'en' })
    expect(block).toContain('[Web element 2]')
    expect(block).toContain('untrusted')
  })
})

describe('buildTag', () => {
  it('is one compact line with the identifyable bits', () => {
    const tag = buildTag(ref, 1)
    expect(tag).not.toContain('\n')
    expect(tag).toContain('⟦元素1⟧')
    expect(tag).toContain('button#submit.btn.primary')
    expect(tag).toContain('localhost:5173/checkout')
    expect(tag).toContain('120×40')
    expect(tag).toContain('src/components/checkout.tsx')
  })

  it('carries the annotation inline', () => {
    const tag = buildTag(ref, 3, '把圆角改小一点')
    expect(tag).toContain('批注：把圆角改小一点')
    expect(buildTag(ref, 3)).not.toContain('批注')
  })
})

describe('draft seam', () => {
  it('prefers caret insertion and appends when no span is returned', () => {
    let draft = 'make it blue'
    let inserted: string | null = null
    const off = registerDraftBridge('s1', {
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text
      },
      captureInsertion: () => ({ rev: 1 }),
      insertText: (text) => {
        inserted = text
        return true
      },
    })
    expect(insertAtCaret('s1', 'TAG')).toBe('caret')
    expect(inserted).toBe('TAG')

    off()
    registerDraftBridge('s2', { getDraft: () => draft, setDraft: (text) => { draft = text } })
    expect(insertAtCaret('s2', 'TAG2')).toBe('append')
    expect(draft).toBe('make it blue\nTAG2')
    expect(insertAtCaret('missing', 'TAG')).toBe('none')
  })

  it('removes the tag line when the chip is dismissed', () => {
    let draft = 'fix this\nTAG\n'
    registerDraftBridge('s3', {
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text
      },
    })
    removeTagText('s3', 'TAG')
    expect(draft).toBe('fix this')
  })
})

describe('pending ref queue', () => {
  it('adds, notifies, lists and removes chips', () => {
    let notified = 0
    const off = subscribePendingRefs('s4', () => {
      notified += 1
    })
    const entry = addPendingRef('s4', { n: 1, tag: 'TAG', label: 'button#submit', detail: 'DETAIL' })
    expect(listPendingRefs('s4')).toHaveLength(1)
    expect(notified).toBe(1)
    expect(removePendingRef('s4', entry.id)?.tag).toBe('TAG')
    expect(listPendingRefs('s4')).toHaveLength(0)
    off()
  })
})
