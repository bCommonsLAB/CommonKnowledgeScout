/**
 * Welle K2 — Ereignisse der Lesersicht aus dem Job-Trace: feste Namensliste,
 * Attribute statt ganzer Trace, Log-Phasen nur ohne Trace-Ereignis.
 * Fixture nach dem Index-Job des Live-Prueffalls 11.10.2026 (Corbo, 58 Folien).
 */
import { describe, expect, it } from 'vitest'
import { coverQuelleAus, ereignisseAusTrace, folienAus, LESERSICHT_EREIGNISSE } from '@/lib/mcp/job-ereignisse'

const INDEX_JOB = {
  status: 'completed',
  logs: [
    { timestamp: new Date('2026-10-11T20:00:00.000Z'), phase: 'frontmatter_json_list_invalid', message: 'Listenfeld als JSON-Text nicht lesbar: slides (Unexpected token)' },
    { timestamp: new Date('2026-10-11T20:00:02.000Z'), phase: 'slide_images_unresolved', message: '2 Folienbild(er) ohne Fragment …' },
    { timestamp: new Date('2026-10-11T20:00:03.000Z'), phase: 'ingest_completed', progress: 100 },
  ],
  trace: {
    events: [
      { ts: new Date('2026-10-11T20:00:01.000Z'), spanId: 'ingest', name: 'ingest_decision', attributes: { run: true } },
      { ts: new Date('2026-10-11T20:00:02.000Z'), spanId: 'ingest', name: 'slide_images_resolved', attributes: { resolved: 56, unresolved: 2, sources: ['Corbo.pdf'] } },
      { ts: new Date('2026-10-11T20:00:02.100Z'), spanId: 'ingest', name: 'slide_images_unresolved', attributes: { unresolved: ['preview_057.jpg', 'preview_058.jpg'] } },
      { ts: new Date('2026-10-11T20:00:02.500Z'), spanId: 'ingest', name: 'cover_source', attributes: { source: 'slides', sourceId: 'pdf-1', sourceName: 'Corbo.pdf', page: 2 } },
      { ts: new Date('2026-10-11T20:00:02.700Z'), spanId: 'ingest', name: 'attachments_source', attributes: { anzahl: 1, namen: ['Corbo.pdf'] } },
      { ts: new Date('2026-10-11T20:00:02.900Z'), spanId: 'ingest', name: 'ingest_mongodb_upserted', attributes: { chunks: 12 } },
    ],
  },
}

describe('ereignisseAusTrace', () => {
  it('liefert nur die Ereignisse der festen Liste, mit Zeitpunkt und Attributen', () => {
    const ereignisse = ereignisseAusTrace(INDEX_JOB)
    expect(ereignisse.filter((e) => e.quelle === 'trace').map((e) => e.name))
      .toEqual(['slide_images_resolved', 'slide_images_unresolved', 'cover_source', 'attachments_source'])
    expect(ereignisse[0]).toEqual({
      name: 'slide_images_resolved', zeitpunkt: '2026-10-11T20:00:02.000Z', quelle: 'trace',
      attribute: { resolved: 56, unresolved: 2, sources: ['Corbo.pdf'] },
    })
    for (const e of ereignisse) expect(LESERSICHT_EREIGNISSE).toContain(e.name)
  })

  it('nimmt Log-Phasen der Liste nur mit, wenn kein Trace-Ereignis gleichen Namens steht', () => {
    const ereignisse = ereignisseAusTrace(INDEX_JOB)
    const ausLog = ereignisse.filter((e) => e.quelle === 'log')
    // frontmatter_json_list_invalid schreibt der Ingest nur als Log; slide_images_unresolved steht schon im Trace.
    expect(ausLog.map((e) => e.name)).toEqual(['frontmatter_json_list_invalid'])
    expect(ausLog[0].attribute).toEqual({ message: 'Listenfeld als JSON-Text nicht lesbar: slides (Unexpected token)' })
    expect(ausLog[0].zeitpunkt).toBe('2026-10-11T20:00:00.000Z')
  })

  it('liefert ein leeres Array ohne Trace und ohne Logs — kein Wurf, kein Raten', () => {
    expect(ereignisseAusTrace({ status: 'completed' })).toEqual([])
    expect(ereignisseAusTrace(null)).toEqual([])
  })
})

describe('coverQuelleAus / folienAus', () => {
  it('liest Cover-Herkunft mit Seite und die Folien-Bilanz mit Namen', () => {
    const ereignisse = ereignisseAusTrace(INDEX_JOB)
    expect(coverQuelleAus(ereignisse)).toEqual({ quelle: 'slides', grund: null, seite: 2 })
    expect(folienAus(ereignisse)).toEqual({ aufgeloest: 56, unaufgeloest: 2, namen: ['preview_057.jpg', 'preview_058.jpg'] })
  })

  it('liefert null ohne Ereignis und den Grund bei source none', () => {
    expect(coverQuelleAus([])).toBeNull()
    expect(folienAus([])).toBeNull()
    const ohne = ereignisseAusTrace({ trace: { events: [{ name: 'cover_source', attributes: { source: 'none', grund: 'keine PDF-Quelle mit Seitenbildern' } }] } })
    expect(coverQuelleAus(ohne)).toEqual({ quelle: 'none', grund: 'keine PDF-Quelle mit Seitenbildern', seite: null })
  })
})
