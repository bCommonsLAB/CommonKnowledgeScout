/**
 * Welle ST11 — uebersprungene Schritte muessen ueber die Bruecke sichtbar sein.
 *
 * Befund 29.08.2026: `job_status` mappte Schritte auf {name, status, dauerMs}
 * und warf `details` weg — ein Job, der wegen des Extract-Gates ALLES
 * uebersprang, sah ueber die Bruecke identisch aus wie einer, der gearbeitet
 * hat. Cowork las „completed" als Erfolg und erklaerte 236 Familien fuer
 * unrettbar.
 */
import { describe, expect, it } from 'vitest'
import { INGEST_ABGESCHALTET_GRUND, beschreibeSchritte, uebersprungenHinweis } from '@/lib/mcp/job-schritte'
import type { ExternalJobStep } from '@/types/external-job'

const GEARBEITET: ExternalJobStep = { name: 'extract_audio', status: 'completed', durationMs: 12000 }
const UEBERSPRUNGEN: ExternalJobStep = {
  name: 'extract_audio', status: 'completed',
  details: { skipped: true, reason: 'shadow_twin_exists' },
}

describe('beschreibeSchritte', () => {
  it('markiert uebersprungene Schritte mit Grund', () => {
    const zeilen = beschreibeSchritte([UEBERSPRUNGEN])
    expect(zeilen[0]).toEqual({
      name: 'extract_audio', status: 'completed',
      uebersprungen: true, grund: 'shadow_twin_exists',
    })
  })

  it('laesst gearbeitete Schritte unmarkiert', () => {
    const zeilen = beschreibeSchritte([GEARBEITET])
    expect(zeilen[0]).toEqual({ name: 'extract_audio', status: 'completed', dauerMs: 12000 })
    expect('uebersprungen' in zeilen[0]).toBe(false)
  })

  it('kommt mit fehlenden Schritten und fehlendem Grund zurecht', () => {
    expect(beschreibeSchritte(undefined)).toEqual([])
    const ohneGrund = beschreibeSchritte([{ name: 'x', status: 'completed', details: { skipped: true } }])
    expect(ohneGrund[0].uebersprungen).toBe(true)
    expect('grund' in ohneGrund[0]).toBe(false)
  })
})

describe('uebersprungenHinweis', () => {
  it('warnt, wenn ein completed-Job ALLE Schritte uebersprungen hat', () => {
    const hinweis = uebersprungenHinweis({
      status: 'completed',
      steps: [UEBERSPRUNGEN, { ...UEBERSPRUNGEN, name: 'transform_template' }],
    })
    expect(hinweis).toContain('NICHTS geschrieben')
    expect(hinweis).toContain('erzwingen')
  })

  it('schweigt, sobald mindestens ein Schritt gearbeitet hat', () => {
    expect(uebersprungenHinweis({ status: 'completed', steps: [GEARBEITET, UEBERSPRUNGEN] })).toBeUndefined()
  })

  it('schweigt bei nicht-completed Jobs und ohne Schritte', () => {
    expect(uebersprungenHinweis({ status: 'failed', steps: [UEBERSPRUNGEN] })).toBeUndefined()
    expect(uebersprungenHinweis({ status: 'completed', steps: [] })).toBeUndefined()
    expect(uebersprungenHinweis({ status: 'completed', steps: undefined })).toBeUndefined()
  })
})

describe('uebersprungenHinweis — Transformation uebersprungen, Ingest lief (Befund 21.09.2026)', () => {
  const TEMPLATE_SKIP: ExternalJobStep = {
    name: 'transform_template', status: 'completed',
    details: { skipped: true, reason: 'preprocess_frontmatter_valid' },
  }
  const INGEST: ExternalJobStep = { name: 'ingest_rag', status: 'completed', durationMs: 4000 }

  it('sagt laut, dass der Twin unveraendert ist, und nennt erzwingen', () => {
    const hinweis = uebersprungenHinweis({ status: 'completed', steps: [UEBERSPRUNGEN, TEMPLATE_SKIP, INGEST] })
    expect(hinweis).toContain('TRANSFORMATION wurde uebersprungen')
    expect(hinweis).toContain('preprocess_frontmatter_valid')
    expect(hinweis).toContain('erzwingen=true')
  })

  it('schweigt bei bewusst abgeschalteter Template-Phase (nur_transkript)', () => {
    const aus: ExternalJobStep = {
      name: 'transform_template', status: 'completed', details: { skipped: true, reason: 'phase_disabled' },
    }
    expect(uebersprungenHinweis({ status: 'completed', steps: [GEARBEITET, aus] })).toBeUndefined()
  })

  it('schweigt, wenn die Transformation gelaufen ist', () => {
    const lief: ExternalJobStep = { name: 'transform_template', status: 'completed', durationMs: 9000 }
    expect(uebersprungenHinweis({ status: 'completed', steps: [UEBERSPRUNGEN, lief, INGEST] })).toBeUndefined()
  })
})

describe('beschreibeSchritte — Welle I: abgeschalteter Ingest', () => {
  it('erklaert ingest_rag mit phase_disabled als bewusst abgeschaltet, nicht als Befund', () => {
    const zeilen = beschreibeSchritte([
      { name: 'transform_template', status: 'completed', durationMs: 3000 },
      { name: 'ingest_rag', status: 'completed', details: { skipped: true, reason: 'phase_disabled' } },
    ])
    expect(zeilen[1]).toMatchObject({ name: 'ingest_rag', uebersprungen: true, grund: INGEST_ABGESCHALTET_GRUND })
    expect(zeilen[1].grund).toContain('index_aktualisieren')
  })

  it('laesst andere Skip-Gruende von ingest_rag unveraendert', () => {
    const zeilen = beschreibeSchritte([
      { name: 'ingest_rag', status: 'completed', details: { skipped: true, reason: 'no_metadata_for_ingestion' } },
    ])
    expect(zeilen[0].grund).toBe('no_metadata_for_ingestion')
  })

  it('ist fuer einen completed-Job mit abgeschaltetem Ingest kein nichtsGeschrieben-Hinweis', () => {
    const hinweis = uebersprungenHinweis({
      status: 'completed',
      steps: [
        { name: 'transform_template', status: 'completed' },
        { name: 'ingest_rag', status: 'completed', details: { skipped: true, reason: 'phase_disabled' } },
      ],
    })
    expect(hinweis).toBeUndefined()
  })
})
