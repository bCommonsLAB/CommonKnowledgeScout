/**
 * @fileoverview Unit-Tests: Ingest als bewusster Schritt der Bruecke (Welle I1).
 *
 * Owner 11.10.2026: Weglassen = false, sichtbar als Vorgabe mit naechstem
 * Schritt; nur ein expliziter Wert gilt als Aufruf; `nur_transkript` mit
 * `ingest: true` ist ein Widerspruch.
 */

import { describe, it, expect } from 'vitest'
import {
  NAECHSTER_SCHRITT_MIT_INGEST,
  NAECHSTER_SCHRITT_OHNE_INGEST,
  entscheideIngest,
  pruefeIngestMitVorlage,
} from '@/lib/mcp/ingest-entscheidung'

describe('entscheideIngest', () => {
  it('weglassen = false, Herkunft vorgabe, naechster Schritt nennt Pruefung und index_aktualisieren', () => {
    expect(entscheideIngest(undefined)).toEqual({
      ingest: false, herkunft: 'vorgabe', naechsterSchritt: NAECHSTER_SCHRITT_OHNE_INGEST,
    })
    expect(NAECHSTER_SCHRITT_OHNE_INGEST).toContain('index_aktualisieren')
    expect(NAECHSTER_SCHRITT_OHNE_INGEST).toContain('KS-Oberflaeche')
  })

  it('explizites false ist ein Aufruf, kein Default', () => {
    expect(entscheideIngest(false)).toMatchObject({ ingest: false, herkunft: 'aufruf' })
  })

  it('true ingestiert und sagt, dass der Galerie-Eintrag ohne Pruefung entsteht', () => {
    expect(entscheideIngest(true)).toEqual({
      ingest: true, herkunft: 'aufruf', naechsterSchritt: NAECHSTER_SCHRITT_MIT_INGEST,
    })
  })
})

describe('pruefeIngestMitVorlage', () => {
  it('laesst ingest: true mit Vorlage durch', () => {
    expect(() => pruefeIngestMitVorlage({ ingest: true, template: 'vortrag-session-de' })).not.toThrow()
  })

  it('laesst ingest: false ohne Vorlage durch (nur_transkript)', () => {
    expect(() => pruefeIngestMitVorlage({ ingest: false, template: undefined })).not.toThrow()
  })

  it('weist ingest: true ohne Vorlage ab', () => {
    expect(() => pruefeIngestMitVorlage({ ingest: true, template: undefined })).toThrow(/nur_transkript/)
  })
})
