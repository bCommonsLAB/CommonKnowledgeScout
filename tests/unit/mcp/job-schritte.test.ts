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
import { beschreibeSchritte, uebersprungenHinweis } from '@/lib/mcp/job-schritte'
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
