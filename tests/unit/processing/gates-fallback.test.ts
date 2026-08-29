/**
 * Welle ST11 — der `previous_job_saved`-Fallback darf Fehl-Skips nicht
 * zementieren.
 *
 * Befund 29.08.2026: Nachdem das Extract-Gate zehn Alt-Familien faelschlich
 * uebersprungen hatte (Transformation ohne Transkript), trug jeder dieser
 * completed-Jobs ein savedItemId — und der Fallback las das als „frueherer
 * Erfolg". Damit war auch der Rettungsweg (`template: nur_transkript`)
 * verbaut: Das Gate schlug fuer immer zu.
 */
import { describe, expect, it } from 'vitest'
import { wurdeExtractUebersprungen } from '@/lib/processing/gates'

describe('wurdeExtractUebersprungen', () => {
  it('erkennt einen uebersprungenen Extract-Schritt (jeder Medientyp)', () => {
    for (const name of ['extract_audio', 'extract_video', 'extract_pdf', 'extract_office']) {
      expect(wurdeExtractUebersprungen({
        steps: [{ name, details: { skipped: true, reason: 'shadow_twin_exists' } }],
      })).toBe(true)
    }
  })

  it('zaehlt einen Job mit ECHTEM Extract weiterhin als Erfolg', () => {
    expect(wurdeExtractUebersprungen({
      steps: [{ name: 'extract_audio', details: { durationMs: 12000 } }],
    })).toBe(false)
  })

  it('laesst Jobs ohne Schritte oder ohne Extract-Schritt unangetastet', () => {
    expect(wurdeExtractUebersprungen({})).toBe(false)
    expect(wurdeExtractUebersprungen({ steps: [] })).toBe(false)
    expect(wurdeExtractUebersprungen({ steps: [{ name: 'transform_template' }] })).toBe(false)
  })
})
