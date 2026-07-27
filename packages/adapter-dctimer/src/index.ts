import type { Adapter, TimerData, Session, Solve } from '@timer-bridge/core'
import { normalizePuzzle, getSqlWasmFallback } from '@timer-bridge/core'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'

function getSqlJsConfig(): Record<string, unknown> | undefined {
  if (typeof window === 'undefined') return undefined
  const fb = getSqlWasmFallback()
  if (fb) return { wasmBinary: fb }
  return { locateFile: (file: string) => `https://sql.js.org/dist/${file}` }
}

const DCT_PUZZLE_MAP: Record<number, string> = {
  0: '222',
  32: '333',
  33: '333',
  64: '444',
  96: '555',
  128: '666',
  160: '777',
  192: 'mega',
  224: 'pyra',
  256: 'sq1',
  288: 'clock',
  320: 'skewb',
}

const DCT_WCA_MAP: Record<number, string> = {
  [-32]: '333',
  [-31]: '444',
  [-30]: '555',
  [-29]: '222',
  [-28]: '333bf',
  [-27]: '333oh',
  [-26]: '333fm',
  [-24]: 'mega',
  [-23]: 'pyra',
  [-22]: 'sq1',
  [-21]: 'clock',
  [-20]: 'skewb',
  [-19]: '666',
  [-18]: '777',
}

const TABLE_NAMES = [
  'resulttb', 'result2', 'result3', 'result4', 'result5', 'result6', 'result7',
  'result8', 'result9', 'result10', 'result11', 'result12', 'result13', 'result14',
  'result15', 'resultstb',
]

function buildReverseMap(): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [code, puzzle] of Object.entries(DCT_PUZZLE_MAP)) {
    map[puzzle] = Number(code)
  }
  for (const [code, puzzle] of Object.entries(DCT_WCA_MAP)) {
    if (!(puzzle in map)) {
      map[puzzle] = Number(code)
    }
  }
  return map
}

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class DCTimerAdapter implements Adapter {
  id = 'dctimer'
  name = 'DCTimer'

  detect(input: string | Uint8Array, _filename?: string): boolean {
    if (typeof input === 'string') {
      return input.startsWith('SQLite format 3\0')
    }
    return input.length >= 16 &&
      input[0] === 0x53 && input[1] === 0x51 && input[2] === 0x4C && input[3] === 0x69
  }

  async import(input: string | Uint8Array, _filename?: string): Promise<TimerData> {
    const SQL = await initSqlJs(getSqlJsConfig())
    const buf = typeof input === 'string' ? Uint8Array.from(input, c => c.charCodeAt(0)) : input
    const db = new SQL.Database(buf)
    return this._parseDb(db)
  }

  async export(data: TimerData): Promise<Uint8Array> {
    const SQL = await initSqlJs(getSqlJsConfig())
    const db = new SQL.Database()

    for (let i = 0; i < 15; i++) {
      db.run(`CREATE TABLE IF NOT EXISTS ${TABLE_NAMES[i]}(
        id integer not null,
        rest integer not null,
        resp integer not null,
        resd integer not null,
        scr text not null,
        time text,
        note text,
        p1 integer, p2 integer, p3 integer,
        p4 integer, p5 integer, p6 integer,
        moves text
      )`)
    }
    db.run(`CREATE TABLE IF NOT EXISTS resultstb(
      id integer not null,
      sid integer not null,
      rest integer not null,
      resp integer not null,
      resd integer not null,
      scr text,
      time text,
      note text,
      p1 integer, p2 integer, p3 integer,
      p4 integer, p5 integer, p6 integer,
      moves text
    )`)
    db.run(`CREATE TABLE IF NOT EXISTS sessiontb(
      id integer not null,
      name text,
      type integer,
      mulp integer,
      ra integer,
      sorting integer
    )`)

    const reverseMap = buildReverseMap()
    let lastId = 1
    let nextSessionId = 15

    for (let si = 0; si < data.sessions.length; si++) {
      const session = data.sessions[si]
      const sid = si < 15 ? si : nextSessionId++
      const dctType = reverseMap[session.puzzle] ?? 33

      db.run('INSERT INTO sessiontb(id, name, type, mulp, ra, sorting) VALUES (?, ?, ?, 0, 8011, ?)',
        [sid, session.name, dctType, si + 1])

      for (const solve of session.solves) {
        let resp = 0
        let resd = 1
        let rest = solve.timeMs

        if (solve.penalty === 'plus2') {
          resp = 1
        } else if (solve.penalty === 'dnf') {
          resp = 2
          resd = 0
        }

        const dateStr = solve.timestamp > 0
          ? new Date(solve.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
          : null

        const phases = solve.phases.length >= 6 ? solve.phases : [...solve.phases, ...new Array(6 - solve.phases.length).fill(null)]

        if (sid >= 15) {
          db.run(`INSERT INTO resultstb(id, sid, rest, resp, resd, scr, time, note,
            p1, p2, p3, p4, p5, p6, moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lastId++, sid, rest, resp, resd, solve.scramble, dateStr, solve.comment,
             phases[0] ?? null, phases[1] ?? null, phases[2] ?? null,
             phases[3] ?? null, phases[4] ?? null, phases[5] ?? null,
             solve.moves ?? null])
        } else {
          db.run(`INSERT INTO ${TABLE_NAMES[sid]}(id, rest, resp, resd, scr, time, note,
            p1, p2, p3, p4, p5, p6, moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lastId++, rest, resp, resd, solve.scramble, dateStr, solve.comment,
             phases[0] ?? null, phases[1] ?? null, phases[2] ?? null,
             phases[3] ?? null, phases[4] ?? null, phases[5] ?? null,
             solve.moves ?? null])
        }
      }
    }

    const exported = db.export()
    db.close()
    return exported
  }

  supportedExtensions(): string[] {
    return ['.db', '.sqlite']
  }

  private _parseDb(db: SqlJsDatabase): TimerData {
    const sessions: Session[] = []

    const sessionRows = db.exec('SELECT id, name, type FROM sessiontb ORDER BY id')
    const sessionMap = new Map<number, { name: string; type: number }>()

    if (sessionRows.length > 0) {
      for (const row of sessionRows[0].values) {
        sessionMap.set(row[0] as number, {
          name: (row[1] as string) ?? `Session ${row[0]}`,
          type: (row[2] as number) ?? 33,
        })
      }
    }

    const handledTables = new Set<number>()

    for (let i = 0; i <= 14; i++) {
      const meta = sessionMap.get(i)
      if (meta) {
        const solves = this._getSolvesFromTable(db, TABLE_NAMES[i], meta.type)
        if (solves.length > 0) {
          sessions.push(this._makeSession(`Session ${i}`, meta.name, meta.type, solves))
          handledTables.add(i)
        }
      }
    }

    const resultStmt = db.exec('SELECT DISTINCT sid FROM resultstb')
    if (resultStmt.length > 0) {
      for (const row of resultStmt[0].values) {
        const sid = row[0] as number
        if (handledTables.has(sid)) continue
        const meta = sessionMap.get(sid)
        const name = meta?.name ?? `Session ${sid}`
        const type = meta?.type ?? 33
        const solves = this._getSolvesFromTable(db, 'resultstb', type, sid)
        if (solves.length > 0) {
          sessions.push(this._makeSession(`Session ${sid}`, name, type, solves))
        }
      }
    }

    return { version: '1.0', exportedAt: Date.now(), sessions }
  }

  private _getSolvesFromTable(db: SqlJsDatabase, table: string, puzzleType: number, sid?: number): Solve[] {
    const puzzle = DCT_PUZZLE_MAP[puzzleType] ?? DCT_WCA_MAP[puzzleType] ?? normalizePuzzle(String(puzzleType))
    const solves: Solve[] = []

    let query: string
    if (table === 'resultstb' && sid !== undefined) {
      query = `SELECT id, rest, resp, scr, time, note, p1, p2, p3, p4, p5, p6 FROM resultstb WHERE sid = ${sid} ORDER BY id`
    } else {
      query = `SELECT id, rest, resp, scr, time, note, p1, p2, p3, p4, p5, p6 FROM ${table} ORDER BY id`
    }

    const stmt = db.exec(query)
    if (stmt.length === 0) return solves

    for (const row of stmt[0].values) {
      const rest = row[1] as number
      const resp = row[2] as number
      const scr = row[3] as string
      const dateStr = row[4] as string | null
      const note = row[5] as string | null

      const phases: number[] = []
      for (let p = 6; p < 12; p++) {
        const val = row[p]
        if (val !== null && val !== undefined) phases.push(val as number)
      }

      let penalty: Solve['penalty'] = 'none'
      let timeMs = rest

      if (resp === 1) {
        penalty = 'plus2'
      } else if (resp === 2) {
        penalty = 'dnf'
      }

      let timestamp = 0
      if (dateStr) {
        timestamp = new Date(dateStr.replace(' ', 'T') + '+08:00').getTime()
      }

      solves.push({
        id: randomId(),
        puzzle,
        timeMs,
        penalty,
        scramble: scr,
        comment: note ?? '',
        timestamp,
        phases,
      })
    }

    return solves
  }

  private _makeSession(_fallbackName: string, name: string, type: number, solves: Solve[]): Session {
    const timestamps = solves.map(s => s.timestamp).filter(t => t > 0)
    return {
      id: randomId(),
      name,
      puzzle: DCT_PUZZLE_MAP[type] ?? DCT_WCA_MAP[type] ?? normalizePuzzle(String(type)),
      solves,
      created: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      updated: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    }
  }
}
