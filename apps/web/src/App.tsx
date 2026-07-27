import { useState, useCallback, useRef } from 'react'
import { registry, setSqlWasmFallback } from '@timer-bridge/core'
import { CsTimerAdapter } from '@timer-bridge/adapter-cstimer'
import { DCTimerAdapter } from '@timer-bridge/adapter-dctimer'
import { TwistyTimerAdapter } from '@timer-bridge/adapter-twistytimer'
import { SQL_WASM_BASE64 } from './wasm-base64.js'

setSqlWasmFallback(Uint8Array.from(atob(SQL_WASM_BASE64), c => c.charCodeAt(0)))

registry.register('cstimer', CsTimerAdapter as any)
registry.register('dctimer', DCTimerAdapter as any)
registry.register('twistytimer', TwistyTimerAdapter as any)

const ADAPTER_LABELS: Record<string, string> = {
  cstimer: 'csTimer',
  dctimer: 'DCTimer',
  twistytimer: 'TwistyTimer',
}

type Status = 'idle' | 'detecting' | 'ready' | 'converting' | 'done' | 'error'

export function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [sourceId, setSourceId] = useState<string>('')
  const [targetId, setTargetId] = useState<string>('cstimer')
  const [inputData, setInputData] = useState<{ data: string | Uint8Array; name: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setStatus('detecting')
    setErrorMessage('')
    setResultUrl(null)

    const isBinary = file.name.endsWith('.db') || file.name.endsWith('.sqlite')
    let data: string | Uint8Array

    if (isBinary) {
      const buf = await file.arrayBuffer()
      data = new Uint8Array(buf)
    } else {
      data = await file.text()
    }

    const adapter = registry.detect(data, file.name)
    if (!adapter) {
      setStatus('error')
      setErrorMessage('无法识别文件格式。支持的格式：csTimer JSON/CSV、DCTimer SQLite、TwistyTimer CSV/SQLite')
      return
    }

    setSourceId(adapter.id)
    setInputData({ data, name: file.name })
    const firstTarget = Object.keys(ADAPTER_LABELS).find(id => id !== adapter.id)
    if (firstTarget) setTargetId(firstTarget)
    setStatus('ready')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleConvert = useCallback(async () => {
    if (!inputData) return
    setStatus('converting')
    setErrorMessage('')

    try {
      const output = await registry.convertAuto(inputData.data, targetId, inputData.name)

      let blob: Blob
      const tgt = registry.create(targetId)
      const exts = tgt?.supportedExtensions() ?? ['.txt']
      const ext = exts[0]
      if (output instanceof Uint8Array) {
        blob = new Blob([output], { type: 'application/octet-stream' })
      } else {
        blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
      }

      const name = inputData.name.replace(/\.[^.]+$/, '') + ext
      const url = URL.createObjectURL(blob)

      setResultUrl(url)
      setResultName(name)
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setErrorMessage((err as Error).message)
    }
  }, [inputData, targetId])

  const handleReset = useCallback(() => {
    setStatus('idle')
    setSourceId('')
    setInputData(null)
    setErrorMessage('')
    setResultUrl(null)
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Timer Bridge</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>魔方计时器数据格式互转工具</p>

      {status === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed #aaa',
            borderRadius: 8,
            padding: 60,
            textAlign: 'center',
            cursor: 'pointer',
            background: '#fafafa',
          }}
        >
          <p style={{ margin: 0, fontSize: 16, color: '#555' }}>拖放计时器数据文件到这里</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#999' }}>或点击选择文件</p>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {status === 'detecting' && (
        <p style={{ color: '#666' }}>识别文件格式...</p>
      )}

      {inputData && (
        <div>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <strong>源格式：</strong>{ADAPTER_LABELS[sourceId] ?? sourceId}
            <br />
            <strong>文件名：</strong>{inputData.name}
          </div>

          {status === 'converting' && <p style={{ color: '#666' }}>正在转换...</p>}

          {status === 'ready' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>转换到：</label>
                <select
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
                >
                  {Object.entries(ADAPTER_LABELS).map(([id, label]) =>
                    id !== sourceId && <option key={id} value={id}>{label}</option>
                  )}
                </select>
              </div>
              <button
                onClick={handleConvert}
                style={{
                  width: '100%', padding: '10px 0', fontSize: 15, fontWeight: 600,
                  background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                }}
              >
                开始转换
              </button>
            </>
          )}

          {status === 'done' && resultUrl && (
            <>
              <p style={{ color: '#090', marginBottom: 12 }}>✓ 转换完成</p>
              <a
                href={resultUrl}
                download={resultName}
                style={{
                  display: 'block', textAlign: 'center', padding: '10px 0', fontSize: 15, fontWeight: 600,
                  background: '#090', color: '#fff', borderRadius: 6, textDecoration: 'none',
                }}
              >
                下载 {resultName}
              </a>
            </>
          )}

          {status !== 'converting' && (
            <button
              onClick={handleReset}
              style={{
                marginTop: 12, width: '100%', padding: '8px 0', fontSize: 13,
                background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer',
              }}
            >
              转换另一个文件
            </button>
          )}
        </div>
      )}

      {status === 'error' && (
        <div>
          <p style={{ color: '#c00', marginBottom: 12 }}>{errorMessage}</p>
          <button
            onClick={handleReset}
            style={{
              width: '100%', padding: '10px 0', fontSize: 15, fontWeight: 600,
              background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 12, color: '#999', textAlign: 'center' }}>
        支持 csTimer (JSON/CSV)、DCTimer (SQLite)、TwistyTimer (CSV/SQLite)
      </p>
    </div>
  )
}
