import { describe, it, expect } from 'vitest'
import { parseVerificationSseLine } from '@/lib/library-verification/sse-events'

describe('parseVerificationSseLine', () => {
  it('parst ein progress-Ereignis', () => {
    const ev = parseVerificationSseLine(
      'data: {"type":"progress","phase":"document","current":3,"total":10,"fileId":"f1","repaired":true}'
    )
    expect(ev).toMatchObject({ type: 'progress', current: 3, total: 10, fileId: 'f1', repaired: true })
  })

  it('parst ein end-Ereignis mit Status + Summary', () => {
    const ev = parseVerificationSseLine(
      'data: {"type":"end","success":true,"status":"verified","summary":{"scanned":2}}'
    )
    expect(ev?.type).toBe('end')
    if (ev?.type === 'end') {
      expect(ev.success).toBe(true)
      expect(ev.status).toBe('verified')
      expect(ev.summary).toMatchObject({ scanned: 2 })
    }
  })

  it('parst ein error-Ereignis', () => {
    expect(parseVerificationSseLine('data: {"type":"error","error":"boom"}')).toEqual({
      type: 'error',
      error: 'boom',
    })
  })

  it('ignoriert Nicht-data-, Leer- und Heartbeat-Zeilen', () => {
    expect(parseVerificationSseLine('')).toBeNull()
    expect(parseVerificationSseLine(':keepalive')).toBeNull()
    expect(parseVerificationSseLine('event: ping')).toBeNull()
    expect(parseVerificationSseLine('data: ')).toBeNull()
  })

  it('ignoriert unbekannten Typ und kaputtes JSON (kein stiller Default)', () => {
    expect(parseVerificationSseLine('data: {"type":"weird"}')).toBeNull()
    expect(parseVerificationSseLine('data: {nope}')).toBeNull()
  })
})
