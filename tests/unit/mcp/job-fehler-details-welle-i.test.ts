/**
 * @fileoverview Unit-Tests: juengste Fehlerereignisse, Fehler als Objekt (Welle I3).
 */

import { describe, expect, it } from 'vitest'
import { fehlerAlsText, fehlerDetailsAusTrace } from '@/lib/mcp/job-fehler-details'

function stepFailed(n: number, error: unknown) {
  return { ts: new Date(2026, 9, 11, 10, n), name: 'step_failed', attributes: { step: `s${n}`, error } }
}

describe('fehlerDetailsAusTrace — Welle I3', () => {
  it('liefert die JUENGSTEN fuenf, in zeitlicher Reihenfolge', () => {
    const events = Array.from({ length: 8 }, (_, i) => stepFailed(i, `Fehler ${i}`))
    const details = fehlerDetailsAusTrace({ trace: { events } })
    expect(details.map((d) => d.meldung)).toEqual(['Fehler 3', 'Fehler 4', 'Fehler 5', 'Fehler 6', 'Fehler 7'])
    expect(details[details.length - 1].schritt).toBe('s7')
  })

  it('liest step_failed mit error als Objekt (updateStep-Form) — Code, Meldung, Details', () => {
    const details = fehlerDetailsAusTrace({
      trace: { events: [stepFailed(1, { message: 'RAG Ingestion fehlgeschlagen', details: { reason: 'vector index missing' } })] },
    })
    expect(details).toHaveLength(1)
    expect(details[0].meldung).toBe('RAG Ingestion fehlgeschlagen Details: {"reason":"vector index missing"}')
  })

  it('nimmt den Code aus dem error-Objekt, wenn errorCode fehlt', () => {
    const details = fehlerDetailsAusTrace({
      trace: { events: [stepFailed(1, { code: 'TEMPLATE_TRANSFORMATION_ERROR', message: '0 LLM-Aufrufe' })] },
    })
    expect(details[0].code).toBe('TEMPLATE_TRANSFORMATION_ERROR')
    expect(details[0].meldung).toBe('[TEMPLATE_TRANSFORMATION_ERROR] 0 LLM-Aufrufe')
  })

  it('laesst ein leeres error-Objekt weiterhin weg', () => {
    expect(fehlerDetailsAusTrace({ trace: { events: [stepFailed(1, {}), stepFailed(2, null)] } })).toEqual([])
  })
})

describe('fehlerAlsText', () => {
  it('String bleibt String, Objekt wird Satz, Unsinn wird null', () => {
    expect(fehlerAlsText('x')).toEqual({ meldung: 'x', code: null })
    expect(fehlerAlsText({ code: 'c', message: 'm' })).toEqual({ meldung: '[c] m', code: 'c' })
    expect(fehlerAlsText(42)).toEqual({ meldung: null, code: null })
  })
})
