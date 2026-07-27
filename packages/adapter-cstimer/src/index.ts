import type { Adapter, TimerData, Session, Solve } from '@timer-bridge/core'
import { normalizePuzzle } from '@timer-bridge/core'

interface CsTimerExport {
  [key: string]: unknown
  properties?: Record<string, unknown>
}

type CsTimerTimeEntry = [
  penalty: number,
  totalTime: number,
  ...phases: number[],
]

type CsTimerSolve = [
  times: CsTimerTimeEntry,
  scramble: string,
  comment: string,
  timestamp: number,
  extension?: [reconstruction: string, puzzleType: string, moveCount: number],
]

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class CsTimerAdapter implements Adapter {
  id = 'cstimer'
  name = 'csTimer'

  detect(input: string | Uint8Array, filename?: string): boolean {
    if (typeof input !== 'string') return false
    if (filename?.endsWith('.csv')) {
      return input.startsWith('No.;Time;Comment;Scramble;Date;P.1')
    }
    try {
      const obj = JSON.parse(input)
      return typeof obj === 'object' && obj !== null && Object.keys(obj).some(k => /^session\d+$/.test(k))
    } catch {
      return false
    }
  }

  import(input: string | Uint8Array, filename?: string): TimerData {
    if (typeof input !== 'string') throw new Error('csTimer adapter requires string input')
    if (filename?.endsWith('.csv') || input.startsWith('No.;Time;Comment;Scramble;Date;P.1')) {
      return this._importCsv(input)
    }
    return this._importJson(input)
  }

  private _importJson(input: string): TimerData {
    const obj: CsTimerExport = JSON.parse(input)
    const sessions: Session[] = []

    const sessionKeys = Object.keys(obj).filter(k => /^session\d+$/.test(k)).sort()
    const sessionData: Record<string, { name?: string; opt?: { scrType?: string } }> | undefined =
      obj.properties?.sessionData as Record<string, { name?: string; opt?: { scrType?: string } }> | undefined

    for (const key of sessionKeys) {
      const idx = key.replace('session', '')
      const solves: CsTimerSolve[] = obj[key] as CsTimerSolve[]
      if (!Array.isArray(solves) || solves.length === 0) continue

      const meta = sessionData?.[idx]
      const puzzle = meta?.opt?.scrType
        ? normalizePuzzle(meta.opt.scrType)
        : this._guessPuzzle(solves)

      const session: Session = {
        id: randomId(),
        name: meta?.name ?? `Session ${idx}`,
        puzzle,
        solves: solves.map(s => this._toSolve(s, puzzle)),
        created: 0,
        updated: 0,
      }
      const timestamps = session.solves.map(s => s.timestamp).filter(t => t > 0)
      if (timestamps.length > 0) {
        session.created = Math.min(...timestamps)
        session.updated = Math.max(...timestamps)
      }

      sessions.push(session)
    }

    return { version: '1.0', exportedAt: Date.now(), sessions }
  }

  private _importCsv(input: string): TimerData {
    const lines = input.trim().split('\n')
    const header = lines[0].split(';')
    const phaseCount = header.length - 5 // No.;Time;Comment;Scramble;Date;[P.1;P.2;...]

    const sessionsMap = new Map<string, Solve[]>()

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';')
      if (cols.length < 5) continue

      const timeRaw = cols[1].trim()
      const comment = cols[2]?.trim() ?? ''
      const scramble = cols[3]?.trim() ?? ''
      const dateRaw = cols[4]?.trim() ?? ''

      let penalty: Solve['penalty'] = 'none'
      let timeMs = 0

      if (timeRaw.endsWith('+')) {
        penalty = 'plus2'
        timeMs = parseFloat(timeRaw.slice(0, -1)) * 1000
      } else if (timeRaw === 'DNF') {
        penalty = 'dnf'
      } else {
        timeMs = this._parseTime(timeRaw)
      }

      const phases: number[] = []
      for (let p = 0; p < phaseCount; p++) {
        const val = cols[5 + p]?.trim()
        if (val) phases.push(parseFloat(val))
      }

      const timestamp = dateRaw ? new Date(dateRaw).getTime() : 0

      const solves: Solve = {
        id: randomId(),
        puzzle: '',
        timeMs,
        penalty,
        scramble,
        comment,
        timestamp,
        phases,
      }

      const sessionKey = 'default'
      if (!sessionsMap.has(sessionKey)) sessionsMap.set(sessionKey, [])
      sessionsMap.get(sessionKey)!.push(solves)
    }

    const sessions: Session[] = []
    for (const [key, solves] of sessionsMap) {
      sessions.push({
        id: randomId(),
        name: key === 'default' ? 'Imported CSV' : key,
        puzzle: this._guessPuzzleFromSolves(solves),
        solves,
        created: Math.min(...solves.map(s => s.timestamp).filter(t => t > 0)),
        updated: Math.max(...solves.map(s => s.timestamp).filter(t => t > 0)),
      })
    }

    return { version: '1.0', exportedAt: Date.now(), sessions }
  }

  export(data: TimerData): string {
    const obj: CsTimerExport = {
      properties: {
        sessionN: data.sessions.length,
        sessionData: {} as Record<string, { name: string }>,
      },
    }

    for (let i = 0; i < data.sessions.length; i++) {
      const session = data.sessions[i]
      const key = `session${i + 1}`
      obj[key] = session.solves.map(s => this._fromSolve(s))
      ;(obj.properties!.sessionData as Record<string, { name: string }>)[`${i + 1}`] = {
        name: session.name,
      }
    }

    return JSON.stringify(obj, null, 2)
  }

  supportedExtensions(): string[] {
    return ['.json', '.txt', '.csv']
  }

  private _toSolve(s: CsTimerSolve, puzzle: string): Solve {
    const [times, scramble, comment, timestamp, extension] = s
    const penaltyCode = times[0]
    const phases = times.slice(2)

    let penalty: Solve['penalty'] = 'none'
    let timeMs = times[1]

    if (penaltyCode === -1) {
      penalty = 'dnf'
    } else if (penaltyCode === 2000) {
      penalty = 'plus2'
      timeMs -= 2000
    }

    return {
      id: randomId(),
      puzzle,
      timeMs,
      penalty,
      scramble,
      comment,
      timestamp: timestamp * 1000,
      phases,
      moves: extension?.[0],
    }
  }

  private _fromSolve(s: Solve): CsTimerSolve {
    let penaltyCode = 0
    let displayTime = s.timeMs

    if (s.penalty === 'dnf') {
      penaltyCode = -1
      displayTime = s.timeMs
    } else if (s.penalty === 'plus2') {
      penaltyCode = 2000
      displayTime = s.timeMs + 2000
    }

    const times: CsTimerTimeEntry = [penaltyCode, displayTime, ...s.phases]
    const solve: CsTimerSolve = [
      times,
      s.scramble,
      s.comment,
      Math.floor(s.timestamp / 1000),
    ]
    if (s.moves) {
      solve.push([s.moves, s.puzzle, 0])
    }
    return solve
  }

  private _parseTime(t: string): number {
    t = t.trim()
    if (t.endsWith('+')) t = t.slice(0, -1)
    const parts = t.split(':')
    if (parts.length === 2) {
      return (parseFloat(parts[0]) * 60 + parseFloat(parts[1])) * 1000
    }
    if (parts.length === 3) {
      return (parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])) * 1000
    }
    return parseFloat(t) * 1000
  }

  private _guessPuzzle(solves: CsTimerSolve[]): string {
    for (const s of solves) {
      const ext = s[4]
      if (ext?.[1]) return normalizePuzzle(ext[1])
    }
    return '333'
  }

  private _guessPuzzleFromSolves(solves: Solve[]): string {
    return solves.find(s => s.puzzle)?.puzzle ?? '333'
  }
}
