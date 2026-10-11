/**
 * Welle J5: Folienbilder-Bilanz des Ingests ueber die Bruecke sichtbar —
 * `job_status` zeigt am Schritt `ingest_rag` `bilder: { aufgeloest, unaufgeloest }`
 * aus `step.details.slideImages` (schreibt `phase-ingest.ts`).
 */
import { describe, expect, it } from 'vitest'
import { beschreibeSchritte, bilderAusSchritt } from '@/lib/mcp/job-schritte'
import type { ExternalJobStep } from '@/types/external-job'

describe('bilderAusSchritt', () => {
  it('liest resolved/unresolved als aufgeloest/unaufgeloest', () => {
    const step: ExternalJobStep = {
      name: 'ingest_rag', status: 'completed',
      details: { slideImages: { resolved: 57, unresolved: ['preview_058.jpg'] } },
    }
    expect(bilderAusSchritt(step)).toEqual({ aufgeloest: 57, unaufgeloest: ['preview_058.jpg'] })
    expect(beschreibeSchritte([step])[0]).toEqual({
      name: 'ingest_rag', status: 'completed', bilder: { aufgeloest: 57, unaufgeloest: ['preview_058.jpg'] },
    })
  })

  it('liefert nichts ohne Bilanz oder bei fremder Form', () => {
    expect(bilderAusSchritt({ name: 'ingest_rag', status: 'completed' })).toBeUndefined()
    expect(bilderAusSchritt({ name: 'ingest_rag', status: 'completed', details: { slideImages: { resolved: 'x' } } })).toBeUndefined()
    expect(beschreibeSchritte([{ name: 'extract_audio', status: 'completed', durationMs: 5 }])[0]).toEqual({
      name: 'extract_audio', status: 'completed', dauerMs: 5,
    })
  })
})
