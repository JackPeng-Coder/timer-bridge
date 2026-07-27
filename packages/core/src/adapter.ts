import type { TimerData } from './types.js'

export interface Adapter {
  id: string
  name: string

  detect(input: string | Uint8Array, filename?: string): boolean

  import(input: string | Uint8Array, filename?: string): TimerData | Promise<TimerData>

  export(data: TimerData): string | Uint8Array | Promise<string | Uint8Array>

  supportedExtensions(): string[]
}

export interface AdapterConstructor {
  new(): Adapter
}
