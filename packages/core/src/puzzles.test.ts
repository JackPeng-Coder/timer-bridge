import { describe, it, expect } from 'vitest'
import { normalizePuzzle } from './puzzles.js'

describe('normalizePuzzle', () => {
  it('normalizes standard puzzles', () => {
    expect(normalizePuzzle('333')).toBe('333')
    expect(normalizePuzzle('3x3')).toBe('333')
    expect(normalizePuzzle('222')).toBe('222')
    expect(normalizePuzzle('2x2')).toBe('222')
    expect(normalizePuzzle('444')).toBe('444')
    expect(normalizePuzzle('pyra')).toBe('pyra')
    expect(normalizePuzzle('pyraminx')).toBe('pyra')
    expect(normalizePuzzle('skewb')).toBe('skewb')
    expect(normalizePuzzle('clock')).toBe('clock')
    expect(normalizePuzzle('sq1')).toBe('sq1')
    expect(normalizePuzzle('square-1')).toBe('sq1')
    expect(normalizePuzzle('mega')).toBe('mega')
    expect(normalizePuzzle('megaminx')).toBe('mega')
  })

  it('normalizes common puzzle aliases', () => {
    expect(normalizePuzzle('3x3')).toBe('333')
    expect(normalizePuzzle('2x2')).toBe('222')
    expect(normalizePuzzle('square-1')).toBe('sq1')
    expect(normalizePuzzle('megaminx')).toBe('mega')
    expect(normalizePuzzle('pyraminx')).toBe('pyra')
  })

  it('passes through unknown values', () => {
    expect(normalizePuzzle('unknown')).toBe('unknown')
  })
})
