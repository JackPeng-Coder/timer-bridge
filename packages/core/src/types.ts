export interface Solve {
  id: string
  puzzle: string
  timeMs: number
  penalty: 'none' | 'plus2' | 'dnf'
  scramble: string
  comment: string
  timestamp: number
  phases: number[]
  moves?: string
}

export interface Session {
  id: string
  name: string
  puzzle: string
  solves: Solve[]
  created: number
  updated: number
}

export interface TimerData {
  version: string
  exportedAt: number
  sessions: Session[]
}
