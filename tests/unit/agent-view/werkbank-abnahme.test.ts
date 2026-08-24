/**
 * @fileoverview Unit-Tests: Abnahme-Fluss (Welle A4) — pur.
 *
 * Ziele der Sammelaktion (nur offene Artefakte EINER Art, Entscheidung 3),
 * Einspielen frischer Verifikationen und der Sprung zum naechsten offenen
 * Artefakt (Entscheidung 5) inkl. Umlauf ans Listen-Ende.
 */

import { describe, it, expect } from 'vitest'
import {
  andererOffenerTab, naechstesOffenes, patchFamilie, sammelZiele,
} from '@/lib/agent-view/werkbank-abnahme'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    verification: 'unverifiziert', ...overrides,
  }
}

function familie(sourceId: string, overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return {
    sourceId, sourceName: `${sourceId}.m4a`, folderId: 'f1', path: `V/${sourceId}.m4a`,
    artifactCount: 2, leading: artefakt(),
    transkript: artefakt(),
    zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard' }),
    ...overrides,
  }
}

describe('sammelZiele', () => {
  it('sammelt nur offene Artefakte der gewaehlten Art', () => {
    const ziele = sammelZiele(
      [
        familie('offen'),
        familie('geprueft', { transkript: artefakt({ verification: 'mensch' }) }),
        familie('ohne', { transkript: null }),
        familie('vor-a2', { transkript: undefined, zusammenfassung: undefined }),
      ],
      'transkript',
    )
    expect(ziele.map((ziel) => ziel.familie.sourceId)).toEqual(['offen'])
  })

  it('trennt die Arten — Zusammenfassungen sind eine eigene Sammlung', () => {
    const familien = [familie('a', { transkript: artefakt({ verification: 'mensch' }) })]
    expect(sammelZiele(familien, 'transkript')).toHaveLength(0)
    expect(sammelZiele(familien, 'zusammenfassung')).toHaveLength(1)
  })
})

describe('naechstesOffenes', () => {
  const geprueft = () => familie('x', {
    transkript: artefakt({ verification: 'mensch' }),
    zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard', verification: 'mensch' }),
  })

  it('findet das naechste offene Artefakt vorwaerts, mit Umlauf', () => {
    const liste = [familie('a'), { ...geprueft(), sourceId: 'b' }, familie('c')]
    expect(naechstesOffenes(liste, 'a')?.sourceId).toBe('c')
    expect(naechstesOffenes(liste, 'c')?.sourceId).toBe('a')
  })

  it('null, wenn nichts mehr offen ist — die Ausgangsfamilie zaehlt nicht', () => {
    const liste = [{ ...geprueft(), sourceId: 'a' }, familie('b')]
    expect(naechstesOffenes(liste, 'b')).toBeNull()
  })
})

describe('patchFamilie + andererOffenerTab', () => {
  it('spielt die frische Verifikation ein; der andere offene Tab ist dran', () => {
    const basis = familie('a')
    const gepatcht = patchFamilie(basis, 'transkript', artefakt({ verification: 'mensch' }))
    expect(gepatcht.transkript?.verification).toBe('mensch')
    expect(andererOffenerTab(gepatcht, 'transkript')).toBe('zusammenfassung')
  })

  it('kein anderer Tab, wenn das zweite Artefakt fehlt oder geprueft ist', () => {
    expect(andererOffenerTab(familie('a', { zusammenfassung: null }), 'transkript')).toBeNull()
    expect(
      andererOffenerTab(
        familie('a', { zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard', verification: 'mensch' }) }),
        'transkript',
      ),
    ).toBeNull()
  })
})
