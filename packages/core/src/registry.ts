import type { Adapter, AdapterConstructor } from './adapter.js'

export class BridgeRegistry {
  private _constructors = new Map<string, AdapterConstructor>()

  register(id: string, ctor: AdapterConstructor): void {
    this._constructors.set(id, ctor)
  }

  create(id: string): Adapter | undefined {
    const ctor = this._constructors.get(id)
    return ctor ? new ctor() : undefined
  }

  getAllConstructors(): Map<string, AdapterConstructor> {
    return this._constructors
  }

  detect(input: string | Uint8Array, filename?: string): Adapter | undefined {
    for (const [, ctor] of this._constructors) {
      const adapter = new ctor()
      try {
        if (adapter.detect(input, filename)) return adapter
      } catch {
        continue
      }
    }
    return undefined
  }

  convert(
    input: string | Uint8Array,
    sourceId: string,
    targetId: string,
    filename?: string,
  ): string | Uint8Array | Promise<string | Uint8Array> {
    const src = this.create(sourceId)
    if (!src) throw new Error(`Unknown source adapter: ${sourceId}`)

    const tgt = this.create(targetId)
    if (!tgt) throw new Error(`Unknown target adapter: ${targetId}`)

    const data = src.import(input, filename)
    if (data instanceof Promise) {
      return data.then(d => tgt.export(d))
    }
    return tgt.export(data)
  }

  convertAuto(
    input: string | Uint8Array,
    targetId: string,
    filename?: string,
  ): string | Uint8Array | Promise<string | Uint8Array> {
    const src = this.detect(input, filename)
    if (!src) throw new Error('Cannot detect source format')

    const tgt = this.create(targetId)
    if (!tgt) throw new Error(`Unknown target adapter: ${targetId}`)

    const data = src.import(input, filename)
    if (data instanceof Promise) {
      return data.then(d => tgt.export(d))
    }
    return tgt.export(data)
  }
}

export const registry = new BridgeRegistry()
