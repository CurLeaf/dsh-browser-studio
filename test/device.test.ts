import { describe, expect, it } from 'vitest'
import { computeScale, DEFAULT_DEVICE, normalizeUrl, rotate, viewportSize } from '../src/client/device'

describe('normalizeUrl', () => {
  it('defaults loopback to http', () => {
    expect(normalizeUrl('localhost:5173')).toBe('http://localhost:5173/')
    expect(normalizeUrl('127.0.0.1:3000/app')).toBe('http://127.0.0.1:3000/app')
  })
  it('defaults public hosts to https', () => {
    expect(normalizeUrl('example.com/a?b=1')).toBe('https://example.com/a?b=1')
  })
  it('rejects non-http schemes and credentials', () => {
    expect(normalizeUrl('file:///etc/passwd')).toBe('')
    expect(normalizeUrl('javascript:alert(1)')).toBe('')
    expect(normalizeUrl('http://user:pass@example.com')).toBe('')
    expect(normalizeUrl('   ')).toBe('')
  })
})

describe('viewport math', () => {
  it('responsive fills the panel', () => {
    const state = { ...DEFAULT_DEVICE, presetId: 'responsive' }
    expect(viewportSize(state, { w: 420, h: 700 })).toEqual({ w: 420, h: 700 })
    expect(computeScale(state, { w: 420, h: 700 })).toBe(1)
  })
  it('fits a fixed device inside the panel', () => {
    const state = { ...DEFAULT_DEVICE, presetId: 'iphone-15', width: 393, height: 852, zoom: 'fit' as const }
    const scale = computeScale(state, { w: 400, h: 600 })
    expect(scale).toBeCloseTo((600 - 24) / 852, 5)
  })
  it('respects an explicit zoom', () => {
    const state = { ...DEFAULT_DEVICE, presetId: 'custom', width: 800, height: 600, zoom: 0.5 as const }
    expect(computeScale(state, { w: 300, h: 300 })).toBe(0.5)
  })
  it('rotates by swapping dimensions', () => {
    const state = { ...DEFAULT_DEVICE, presetId: 'custom', width: 393, height: 852, portrait: true }
    expect(rotate(state)).toMatchObject({ width: 852, height: 393, portrait: false })
  })
})
