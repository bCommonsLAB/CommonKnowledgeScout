/**
 * Welle ST7 — Fehlerdetails aus dem Job-Trace.
 *
 * Fixture ist der ECHTE Trace aus dem Fehlschlag vom 28.08.2026 (gekürzt).
 * `job_status` sagte dazu nur „Template-Transformation fehlgeschlagen" —
 * für die eigentliche Meldung musste jemand in die Datenbank.
 */
import { describe, expect, it } from 'vitest'
import { fehlerDetailsAusTrace } from '@/lib/mcp/job-fehler-details'

/** Auszug des tatsächlichen Jobs 7384a8e1 (Provincia … Registrazione.pdf). */
const ECHTER_JOB = {
  status: 'failed',
  error: { code: 'template_failed', message: 'Template-Transformation fehlgeschlagen' },
  trace: {
    events: [
      { ts: new Date('2026-08-28T14:10:20.184Z'), spanId: 'extract', name: 'step_completed', attributes: { step: 'extract_pdf' } },
      {
        ts: new Date('2026-08-28T14:10:26.667Z'), spanId: 'template', name: 'step_failed',
        attributes: {
          step: 'transform_template',
          error: 'Transformer lieferte kein gültiges structured_data. Response-Struktur: {"status":"success","request":{…}}',
          status: 200, statusText: 'OK',
          url: 'https://secretaryservices.bcommonslab.org/api/transformer/template',
          responseDataPreview: '{"status":"success","request":{"processor":"transformer"…',
        },
      },
      // Der Worker schreibt ein zweites step_failed ohne Aussage — das gehört nicht in die Antwort.
      { ts: new Date('2026-08-28T14:10:26.777Z'), spanId: 'template', name: 'step_failed', attributes: { step: 'transform_template', error: null } },
      {
        ts: new Date('2026-08-28T14:10:26.909Z'), spanId: 'template', name: 'job_error', level: 'error',
        message: 'Template-Transformation fehlgeschlagen',
        attributes: { errorCode: 'template_failed', errorStack: 'Error: …\n    at P (…)' },
      },
    ],
  },
}

describe('fehlerDetailsAusTrace', () => {
  it('liefert genau das, wofür man bisher in die Datenbank musste', () => {
    const details = fehlerDetailsAusTrace(ECHTER_JOB)

    const transform = details.find((d) => d.schritt === 'transform_template')
    expect(transform).toBeDefined()
    expect(transform?.meldung).toContain('kein gültiges structured_data')
    expect(transform?.httpStatus).toBe(200)
    expect(transform?.url).toContain('/api/transformer/template')
    expect(transform?.antwortAuszug).toContain('"status":"success"')
    expect(transform?.zeitpunkt).toBe('2026-08-28T14:10:26.667Z')
  })

  it('nimmt auch den Fehlercode aus job_error mit', () => {
    expect(fehlerDetailsAusTrace(ECHTER_JOB).some((d) => d.code === 'template_failed')).toBe(true)
  })

  it('lässt aussagelose Fehlschlag-Ereignisse weg', () => {
    // Der Worker schreibt bei EINEM Fehlschlag mehrere Ereignisse, teils mit
    // error: null — die wären nur Rauschen.
    const details = fehlerDetailsAusTrace(ECHTER_JOB)
    expect(details.every((d) => d.meldung !== null || d.code !== null)).toBe(true)
    expect(details).toHaveLength(2)
  })

  it('ignoriert gelungene Schritte', () => {
    expect(fehlerDetailsAusTrace(ECHTER_JOB).some((d) => d.schritt === 'extract_pdf')).toBe(false)
  })

  it('kürzt lange Meldungen, statt die Antwort zu fluten (Q2)', () => {
    const lang = {
      trace: { events: [{ name: 'step_failed', attributes: { step: 's', error: 'x'.repeat(5000) } }] },
    }
    const meldung = fehlerDetailsAusTrace(lang)[0].meldung ?? ''
    expect(meldung.length).toBeLessThan(1600)
    expect(meldung.endsWith('…')).toBe(true)
  })

  it('kommt mit fehlendem oder kaputtem Trace klar, ohne zu werfen', () => {
    expect(fehlerDetailsAusTrace(undefined)).toEqual([])
    expect(fehlerDetailsAusTrace({})).toEqual([])
    expect(fehlerDetailsAusTrace({ trace: 'kaputt' })).toEqual([])
    expect(fehlerDetailsAusTrace({ trace: { events: 'kaputt' } })).toEqual([])
    expect(fehlerDetailsAusTrace({ trace: { events: [null, 42] } })).toEqual([])
  })
})
