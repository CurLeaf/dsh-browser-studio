import { describe, expect, it } from 'vitest'
import { buildContextText, normalizeBlocks } from '../index.js'

describe('host refs payload', () => {
  it('keeps a bounded list of blocks', () => {
    const parsed = normalizeBlocks({ sessionId: 's1', blocks: ['a', '', 'b', 3] })
    expect(parsed).toEqual({ sessionId: 's1', blocks: ['a', 'b'] })
  })

  it('rejects malformed payloads', () => {
    expect(normalizeBlocks(null)).toBeNull()
    expect(normalizeBlocks({})).toBeNull()
    expect(normalizeBlocks({ sessionId: '', blocks: [] })).toBeNull()
    expect(normalizeBlocks({ sessionId: 's1', blocks: 'nope' })).toBeNull()
  })

  it('marks the page data as untrusted in the injected context', () => {
    const text = buildContextText(['BLOCK 1', 'BLOCK 2'])
    expect(text).toContain('不可信')
    expect(text).toContain('BLOCK 1\n\nBLOCK 2')
  })
})
