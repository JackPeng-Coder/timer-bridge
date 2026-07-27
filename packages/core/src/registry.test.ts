import { describe, it, expect } from 'vitest'
import { BridgeRegistry } from './registry.js'
import type { Adapter } from './adapter.js'
import type { TimerData } from './types.js'

class MockAdapter implements Adapter {
  id = 'mock'
  name = 'Mock'

  detect(input: string | Uint8Array, _filename?: string): boolean {
    return input === 'mock-data'
  }

  import(_input: string | Uint8Array, _filename?: string): TimerData {
    return {
      version: '1.0',
      exportedAt: Date.now(),
      sessions: [{
        id: '1',
        name: 'Test',
        puzzle: '333',
        solves: [],
        created: 0,
        updated: 0,
      }],
    }
  }

  export(_data: TimerData): string {
    return 'mock-output'
  }

  supportedExtensions(): string[] {
    return ['.mock']
  }
}

describe('BridgeRegistry', () => {
  it('registers and creates adapters', () => {
    const reg = new BridgeRegistry()
    reg.register('mock', MockAdapter)
    const adapter = reg.create('mock')
    expect(adapter).toBeDefined()
    expect(adapter!.id).toBe('mock')
  })

  it('detects format from content', () => {
    const reg = new BridgeRegistry()
    reg.register('mock', MockAdapter)
    const detected = reg.detect('mock-data')
    expect(detected).toBeDefined()
    expect(detected!.id).toBe('mock')
  })

  it('returns undefined for unknown format', () => {
    const reg = new BridgeRegistry()
    reg.register('mock', MockAdapter)
    const detected = reg.detect('unknown-data')
    expect(detected).toBeUndefined()
  })

  it('converts between adapters', () => {
    const reg = new BridgeRegistry()
    reg.register('mock', MockAdapter)
    const result = reg.convert('mock-data', 'mock', 'mock')
    expect(result).toBe('mock-output')
  })
})
