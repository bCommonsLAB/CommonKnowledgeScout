/**
 * @fileoverview Unit-Tests: Sammelaktions-Stempel erkennen (ADR 0006).
 *
 * Der Vertrag ist die Messung aus dem Pruefarchiv „26.01 Klimamassnahmen
 * Suedtirol" (26.08.2026, 35 Stempel, vier Schwuenge): 26 Zusammenfassungen
 * im 2,5-s-Takt sind eine Sammelaktion, 4 + 1 + 4 Einzelklicks mit 7-13 s
 * Abstand nicht.
 */

import { describe, it, expect } from 'vitest'
import {
  SAMMELAKTION_REGEL,
  baueSchwuenge,
  findeSammelStempel,
  type VerifikationsStempel,
} from '@/lib/shadow-twin/sammelaktion-stempel'

function stempel(
  sourceId: string,
  verifiedAt: string,
  overrides: Partial<VerifikationsStempel> = {},
): VerifikationsStempel {
  return {
    sourceId,
    sourceName: `${sourceId}.m4a`,
    kind: 'transformation',
    templateName: 'standard-meeting',
    targetLanguage: 'de',
    verifiedBy: 'human:peter@example.org',
    verifiedAt,
    ...overrides,
  }
}

/** Reihe im festen Takt ab `startMs` (wie eine sequenzielle Sammelaktion). */
function reihe(anzahl: number, startMs: number, taktMs: number, overrides: Partial<VerifikationsStempel> = {}) {
  return Array.from({ length: anzahl }, (_, i) =>
    stempel(`s${startMs}-${i}`, new Date(startMs + i * taktMs).toISOString(), overrides),
  )
}

const BASIS = Date.parse('2026-08-25T14:21:57.566Z')

describe('findeSammelStempel — der gemessene Fall', () => {
  it('erkennt 26 Zusammenfassungen im 2,5-s-Takt als Sammelaktion', () => {
    const sammel = reihe(26, BASIS, 2500)
    expect(findeSammelStempel(sammel)).toHaveLength(26)
  })

  it('laesst Einzelklicks in Ruhe — 4 Stempel mit ~13 s Abstand', () => {
    const einzeln = reihe(4, BASIS, 13000)
    expect(findeSammelStempel(einzeln)).toEqual([])
  })

  it('trennt beide Muster im selben Datensatz', () => {
    const alle = [
      ...reihe(4, Date.parse('2026-08-25T14:18:32.049Z'), 13000, { kind: 'transcript', templateName: null, targetLanguage: '' }),
      ...reihe(26, BASIS, 2500),
      ...reihe(4, Date.parse('2026-08-26T07:29:35.389Z'), 7000, { kind: 'transcript', templateName: null, targetLanguage: '' }),
    ]
    const treffer = findeSammelStempel(alle)
    expect(treffer).toHaveLength(26)
    expect(treffer.every((s) => s.kind === 'transformation')).toBe(true)
  })
})

describe('findeSammelStempel — Grenzen der Regel', () => {
  it('zaehlt Arten getrennt: zwei Reihen zu 4 sind keine Sammelaktion von 8', () => {
    const gemischt = [
      ...reihe(4, BASIS, 2000),
      ...reihe(4, BASIS + 500, 2000, { kind: 'transcript', templateName: null, targetLanguage: '' }),
    ]
    expect(findeSammelStempel(gemischt)).toEqual([])
  })

  it('bricht den Schwung bei einer Pause — 5 + 5 bleiben zwei kleine Schwuenge', () => {
    const mitPause = [...reihe(5, BASIS, 2000), ...reihe(5, BASIS + 60_000, 2000)]
    expect(findeSammelStempel(mitPause)).toEqual([])
  })

  it('haelt sich an die Mindestanzahl der Regel', () => {
    expect(findeSammelStempel(reihe(SAMMELAKTION_REGEL.mindestAnzahl - 1, BASIS, 2000))).toEqual([])
    expect(findeSammelStempel(reihe(SAMMELAKTION_REGEL.mindestAnzahl, BASIS, 2000))).toHaveLength(
      SAMMELAKTION_REGEL.mindestAnzahl,
    )
  })
})

describe('baueSchwuenge', () => {
  it('beschreibt jeden Schwung mit Zeitraum und Urteil', () => {
    const { schwuenge } = baueSchwuenge(reihe(26, BASIS, 2500))
    expect(schwuenge).toHaveLength(1)
    expect(schwuenge[0]).toMatchObject({ istSammelaktion: true })
    expect(schwuenge[0].stempel).toHaveLength(26)
    expect(Date.parse(schwuenge[0].bis) - Date.parse(schwuenge[0].von)).toBe(25 * 2500)
  })

  it('benennt Stempel ohne lesbare Zeit, statt sie still einzusortieren', () => {
    const { schwuenge, ohneZeit } = baueSchwuenge([stempel('kaputt', 'irgendwann'), ...reihe(6, BASIS, 2000)])
    expect(ohneZeit.map((s) => s.sourceId)).toEqual(['kaputt'])
    expect(schwuenge).toHaveLength(1)
  })
})
