import { describe, it, expect } from 'vitest'
import { DCTimerAdapter } from './index.js'

describe('DCTimerAdapter', () => {
  const adapter = new DCTimerAdapter()

  it('detects SQLite format', () => {
    expect(adapter.detect('SQLite format 3\0')).toBe(true)
    expect(adapter.detect('not sqlite')).toBe(false)
  })

  it('reports supported extensions', () => {
    const exts = adapter.supportedExtensions()
    expect(exts).toContain('.db')
    expect(exts).toContain('.sqlite')
  })
})
