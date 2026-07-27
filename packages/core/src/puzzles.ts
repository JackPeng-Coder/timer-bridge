export const NORMALIZED_PUZZLES = [
  '333', '333oh', '333bf', '333fm',
  '222', '444', '555', '666', '777',
  'pyra', 'skewb', 'clock', 'sq1', 'mega',
] as const

export type NormalizedPuzzle = typeof NORMALIZED_PUZZLES[number]

export function normalizePuzzle(key: string): string {
  const map: Record<string, string> = {
    '333': '333', '3x3': '333', '33': '333',
    '333oh': '333oh', 'oh': '333oh',
    '333bf': '333bf', 'bf': '333bf',
    '333fm': '333fm', 'fm': '333fm',
    '222': '222', '2x2': '222', '22': '222',
    '444': '444', '4x4': '444', '44': '444',
    '555': '555', '5x5': '555', '55': '555',
    '666': '666', '6x6': '666', '66': '666',
    '777': '777', '7x7': '777', '77': '777',
    'pyra': 'pyra', 'pyraminx': 'pyra',
    'skewb': 'skewb',
    'clock': 'clock',
    'sq1': 'sq1', 'square1': 'sq1', 'square-1': 'sq1',
    'mega': 'mega', 'megaminx': 'mega',
  }
  return map[key.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? key
}
