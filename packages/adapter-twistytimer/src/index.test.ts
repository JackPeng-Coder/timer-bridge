import { describe, it, expect } from 'vitest'
import { TwistyTimerAdapter } from './index.js'

const CSV_BACKUP = `Puzzle,Category,Time(millis),Date(millis),Scramble,Penalty,Comment
"333";"Normal";"62420";"1466336229619";"R U R' U'";"0";"nice solve"
"444";"Normal";"123456";"1466336230000";"F R U R' U' F'";"1";""
"pyra";"Practice";"0";"1466336240000";"B L U2 L' B'";"2";"DNF"`

describe('TwistyTimerAdapter', () => {
  const adapter = new TwistyTimerAdapter()

  it('detects SQLite format', () => {
    expect(adapter.detect('SQLite format 3\0')).toBe(true)
  })

  it('detects backup CSV format', () => {
    expect(adapter.detect(CSV_BACKUP)).toBe(true)
    expect(adapter.detect('not twistytimer')).toBe(false)
  })

  it('imports backup CSV correctly', async () => {
    const data = await adapter.import(CSV_BACKUP)
    // Each puzzle+subtype combo becomes a session
    expect(data.sessions).toHaveLength(3)
    const normal333 = data.sessions.find(s => s.name === 'Normal' && s.puzzle === '333')
    expect(normal333).toBeDefined()
    expect(normal333!.solves).toHaveLength(1)
    expect(normal333!.solves[0].timeMs).toBe(62420)
    expect(normal333!.solves[0].scramble).toBe("R U R' U'")
    expect(normal333!.solves[0].penalty).toBe('none')

    const practice = data.sessions.find(s => s.name === 'Practice')
    expect(practice).toBeDefined()
    expect(practice!.solves).toHaveLength(1)
    expect(practice!.solves[0].penalty).toBe('dnf')
  })

  it('exports to backup CSV format', async () => {
    const data = await adapter.import(CSV_BACKUP)
    const exported = adapter.export(data)
    expect(exported).toContain('Puzzle,Category,Time(millis),Date(millis),Scramble,Penalty,Comment')
    expect(exported).toContain('62420')
    expect(exported).toContain('"Normal"')
  })

  it('reports supported extensions', () => {
    const exts = adapter.supportedExtensions()
    expect(exts).toContain('.db')
    expect(exts).toContain('.txt')
  })
})
