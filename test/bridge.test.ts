import { describe, expect, it } from 'vitest'
import { buildBlock, insertBlock, registerDraftBridge } from '../src/client/bridge'
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
    expect(block).toContain('button#submit')
    expect(block).toContain('main > form > button#submit')
    expect(block).toContain('#submit')
    expect(block).toContain('CheckoutSubmit (src/components/checkout.tsx)')
    expect(block).toContain('data-testid="submit-order"')
    expect(block).toContain('不可信')
    expect(block).toContain('iPhone 15')
  })

  it('renders English copy when asked', () => {
    const block = buildBlock(ref, 2, { deviceLabel: 'iPhone 15', uaMobile: false, locale: 'en' })
    expect(block).toContain('[Web element 2]')
    expect(block).toContain('untrusted')
  })
})

describe('draft bridge', () => {
  it('inserts a block into the captured draft', () => {
    let draft = 'make this primary'
    const off = registerDraftBridge('s1', {
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text
      },
    })
    expect(insertBlock('s1', 'BLOCK')).toBe(true)
    expect(draft).toBe('make this primary\n\nBLOCK')
    off()
    expect(insertBlock('s1', 'BLOCK')).toBe(false)
  })
})
