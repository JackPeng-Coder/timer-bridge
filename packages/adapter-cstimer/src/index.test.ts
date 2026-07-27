import { describe, it, expect } from 'vitest'
import { CsTimerAdapter } from './index.js'

const SAMPLE_JSON = `{
  "session1": [
    [[0, 12340], "R U R' U'", "nice solve", 1700000000],
    [[2000, 25670], "F R U R' U' F'", "", 1700000001],
    [[-1, 0], "B L U2 L' B'", "DNF lol", 1700000002]
  ],
  "session2": [
    [[0, 5432, 1234, 3456], "U' L2 D R2", "multi-phase", 1700000005, ["R U @100 R' @200", "333", 5]]
  ]
}`

describe('CsTimerAdapter', () => {
  const adapter = new CsTimerAdapter()

  it('detects JSON format', () => {
    expect(adapter.detect(SAMPLE_JSON)).toBe(true)
    expect(adapter.detect('not json')).toBe(false)
    expect(adapter.detect(new Uint8Array([1, 2, 3]))).toBe(false)
  })

  it('imports JSON correctly', () => {
    const data = adapter.import(SAMPLE_JSON)
    expect(data.sessions).toHaveLength(2)
    expect(data.sessions[0].solves).toHaveLength(3)
    expect(data.sessions[0].name).toBe('Session 1')
    expect(data.sessions[0].solves[0].timeMs).toBe(12340)
    expect(data.sessions[0].solves[0].penalty).toBe('none')
    expect(data.sessions[0].solves[1].timeMs).toBe(23670) // 25670 - 2000
    expect(data.sessions[0].solves[1].penalty).toBe('plus2')
    expect(data.sessions[0].solves[2].penalty).toBe('dnf')
  })

  it('imports multi-phase solves', () => {
    const data = adapter.import(SAMPLE_JSON)
    const solve = data.sessions[1].solves[0]
    expect(solve.timeMs).toBe(5432)
    expect(solve.phases).toEqual([1234, 3456])
  })

  it('exports and re-imports correctly', () => {
    const data = adapter.import(SAMPLE_JSON)
    const exported = adapter.export(data)
    const reimported = adapter.import(exported)
    expect(reimported.sessions).toHaveLength(2)
    expect(reimported.sessions[0].solves).toHaveLength(3)
    expect(reimported.sessions[0].solves[0].timeMs).toBe(12340)
    expect(reimported.sessions[0].solves[0].scramble).toBe("R U R' U'")
  })
})
