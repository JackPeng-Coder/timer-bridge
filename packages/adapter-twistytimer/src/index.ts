import type { Adapter, TimerData, Session, Solve } from '@timer-bridge/core'
import { normalizePuzzle, getSqlWasmFallback } from '@timer-bridge/core'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'

const CSV_MARKER = 'Puzzle,Category,Time(millis),Date(millis),Scramble,Penalty,Comment'

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class TwistyTimerAdapter implements Adapter {
  id = 'twistytimer'
  name = 'TwistyTimer'

  detect(input: string | Uint8Array, filename?: string): boolean {
    if (typeof input === 'string') {
      if (input.startsWith(CSV_MARKER)) return true
      if (input.startsWith('SQLite format 3\0')) return true
    } else {
      if (input.length >= 16 &&
        input[0] === 0x53 && input[1] === 0x51 && input[2] === 0x4C && input[3] === 0x69) return true
    }
    if (filename?.toLowerCase().startsWith('solves_') && filename.endsWith('.txt')) return true
    if (filename?.toLowerCase().startsWith('backup_') && filename.endsWith('.txt')) return true
    return false
  }

  async import(input: string | Uint8Array, filename?: string): Promise<TimerData> {
    if (typeof input !== 'string') {
      return this._importDb(input)
    }
    if (input.startsWith('SQLite format 3\0')) {
      return this._importDb(input)
    }
    return this._importCsv(input, filename)
  }

  export(data: TimerData): string {
    const lines: string[] = [CSV_MARKER]
    for (const session of data.sessions) {
      for (const solve of session.solves) {
        const penaltyCode = solve.penalty === 'dnf' ? 2 : solve.penalty === 'plus2' ? 1 : 0
        const fields = [
          this._csvEscape(solve.puzzle),
          this._csvEscape(session.name),
          String(solve.timeMs),
          String(solve.timestamp),
          this._csvEscape(solve.scramble),
          String(penaltyCode),
          this._csvEscape(solve.comment),
        ]
        lines.push(fields.join(';'))
      }
    }
    return lines.join('\n')
  }

  supportedExtensions(): string[] {
    return ['.csv', '.txt', '.db']
  }

  private _csvEscape(s: string): string {
    return `"${s.replace(/"/g, '""')}"`
  }

  private async _importDb(input: string | Uint8Array): Promise<TimerData> {
    let config: Record<string, unknown> | undefined
    if (typeof window !== 'undefined') {
      const fb = getSqlWasmFallback()
      if (fb) {
        config = { wasmBinary: fb }
      } else {
        config = { locateFile: (file: string) => `https://sql.js.org/dist/${file}` }
      }
    }
    const SQL = await initSqlJs(config)
    const buf = typeof input === 'string' ? Uint8Array.from(input, c => c.charCodeAt(0)) : input
    const db = new SQL.Database(buf)
    return this._parseDb(db)
  }

  private _parseDb(db: SqlJsDatabase): TimerData {
    const sessions = new Map<string, Solve[]>()

    const stmt = db.exec('SELECT type, subtype, time, date, scramble, penalty, comment FROM times ORDER BY _id')

    if (stmt.length === 0) {
      return { version: '1.0', exportedAt: Date.now(), sessions: [] }
    }

    for (const row of stmt[0].values) {
      const type = row[0] as string
      const subtype = row[1] as string
      const timeMs = row[2] as number
      const date = row[3] as number
      const scramble = row[4] as string
      const penaltyCode = row[5] as number
      const comment = row[6] as string | null

      let penalty: Solve['penalty'] = 'none'
      let actualTime = timeMs
      if (penaltyCode === 2) {
        penalty = 'dnf'
      } else if (penaltyCode === 1) {
        penalty = 'plus2'
      }

      const puzzle = normalizePuzzle(type)
      const sessionKey = `${puzzle}::${subtype}`

      const solve: Solve = {
        id: randomId(),
        puzzle,
        timeMs: actualTime,
        penalty,
        scramble,
        comment: comment ?? '',
        timestamp: date,
        phases: [],
      }

      if (!sessions.has(sessionKey)) sessions.set(sessionKey, [])
      sessions.get(sessionKey)!.push(solve)
    }

    const result: Session[] = []
    for (const [key, solves] of sessions) {
      const [puzzle, subtype] = key.split('::')
      const timestamps = solves.map(s => s.timestamp).filter(t => t > 0)
      result.push({
        id: randomId(),
        name: subtype || puzzle,
        puzzle,
        solves,
        created: timestamps.length > 0 ? Math.min(...timestamps) : 0,
        updated: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      })
    }

    return { version: '1.0', exportedAt: Date.now(), sessions: result }
  }

  private _importCsv(input: string, _filename?: string): TimerData {
    const lines = input.trim().split('\n')
    const sessions = new Map<string, Solve[]>()

    const isBackupFormat = lines[0].trim() === CSV_MARKER
    const startLine = isBackupFormat ? 1 : 0

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const cols = this._parseCsvLine(line)

      if (isBackupFormat) {
        if (cols.length < 6) continue
        const puzzle = normalizePuzzle(cols[0])
        const subtype = cols[1]
        const timeMs = parseInt(cols[2], 10)
        const date = parseInt(cols[3], 10)
        const scramble = cols[4]
        const penaltyCode = parseInt(cols[5], 10)
        const comment = cols.length > 6 ? cols[6] : ''

        let penalty: Solve['penalty'] = 'none'
        if (penaltyCode === 2) penalty = 'dnf'
        else if (penaltyCode === 1) penalty = 'plus2'

        const solve: Solve = {
          id: randomId(),
          puzzle,
          timeMs,
          penalty,
          scramble,
          comment,
          timestamp: date,
          phases: [],
        }

        const key = `${puzzle}::${subtype}`
        if (!sessions.has(key)) sessions.set(key, [])
        sessions.get(key)!.push(solve)
      } else {
        if (cols.length < 3) continue
        const timeStr = cols[0]
        const scramble = cols[1]
        const dateStr = cols[2]
        const isDnf = cols.length > 3 && cols[3] === 'DNF'

        const timeMs = this._parseTimeExternal(timeStr)
        const timestamp = new Date(dateStr).getTime()

        const solve: Solve = {
          id: randomId(),
          puzzle: '',
          timeMs,
          penalty: isDnf ? 'dnf' : 'none',
          scramble,
          comment: '',
          timestamp,
          phases: [],
        }

        const key = 'External Import'
        if (!sessions.has(key)) sessions.set(key, [])
        sessions.get(key)!.push(solve)
      }
    }

    const result: Session[] = []
    for (const [key, solves] of sessions) {
      const [puzzle, subtype] = key.includes('::') ? key.split('::') : ['', key]
      const timestamps = solves.map(s => s.timestamp).filter(t => t > 0)
      result.push({
        id: randomId(),
        name: subtype || puzzle || 'Imported',
        puzzle,
        solves,
        created: timestamps.length > 0 ? Math.min(...timestamps) : 0,
        updated: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      })
    }

    return { version: '1.0', exportedAt: Date.now(), sessions: result }
  }

  private _parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    const delimiter = ';'

    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (c === delimiter && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += c
      }
    }
    result.push(current)
    return result
  }

  private _parseTimeExternal(t: string): number {
    t = t.trim()
    const parts = t.split(':')
    if (parts.length === 2) {
      return (parseFloat(parts[0]) * 60 + parseFloat(parts[1])) * 1000
    }
    if (parts.length === 3) {
      return (parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])) * 1000
    }
    return parseFloat(t) * 1000
  }
}
