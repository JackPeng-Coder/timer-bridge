let _wasmFallback: Uint8Array | undefined

export function setSqlWasmFallback(data: Uint8Array | undefined) {
  _wasmFallback = data
}

export function getSqlWasmFallback(): Uint8Array | undefined {
  return _wasmFallback
}
