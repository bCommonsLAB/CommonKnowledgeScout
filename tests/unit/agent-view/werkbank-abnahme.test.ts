/**
 * @fileoverview Unit-Tests: Kurations-Fluss der Werkbank — pur.
 *
 * ADR 0006 (Modell B): Es gibt keine Sammelaktion und keine Pflichtkette
 * mehr. Geprueft wird das Einspielen einer frischen Kuration und der Sprung
 * zum naechsten WIDERSTAND (markierter Fehler) inkl. Umlauf ans Listen-Ende.
 */

import { describe, it, expect } from 'vitest'
import {
  naechsterWiderstand, patchFamilie, sprungHinweis, sprungNachVerifikation,
} from '@/lib/agent-view/werkbank-abnahme'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    flaggedBy: null, flaggedAt: null, flaggedNote: null,
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

/** Familie mit markiertem Transkript — der einzige Widerstand des Modells. */
function markiert(sourceId: string, overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return familie(sourceId, {
    transkript: artefakt({ twinStatus: 'flagged', flaggedNote: 'Sprecher vertauscht' }),
    ...overrides,
  })
}

describe('naechsterWiderstand', () => {
  it('findet die naechste markierte Familie vorwaerts, mit Umlauf', () => {
    const liste = [markiert('a'), familie('b'), markiert('c')]
    expect(naechsterWiderstand(liste, 'a')?.sourceId).toBe('c')
    expect(naechsterWiderstand(liste, 'c')?.sourceId).toBe('a')
  })

  it('ueberspringt unbestaetigte Familien — fehlende Pruefung ist kein Widerstand', () => {
    const liste = [familie('a'), familie('b'), familie('c')]
    expect(naechsterWiderstand(liste, 'a')).toBeNull()
  })

  it('null, wenn nichts markiert ist — die Ausgangsfamilie zaehlt nicht', () => {
    expect(naechsterWiderstand([markiert('a'), familie('b')], 'a')).toBeNull()
  })
})

describe('patchFamilie', () => {
  it('spielt die frische Kuration in ihre Familie ein', () => {
    const gepatcht = patchFamilie(familie('a'), 'transkript', artefakt({ verification: 'mensch' }))
    expect(gepatcht.transkript?.verification).toBe('mensch')
    expect(gepatcht.zusammenfassung?.verification).toBe('unverifiziert')
  })

  it('traegt auch eine frische Markierung ein', () => {
    const gepatcht = patchFamilie(familie('a'), 'zusammenfassung', artefakt({
      kind: 'transformation', templateName: 'standard', twinStatus: 'flagged', flaggedNote: 'Zahlen falsch',
    }))
    expect(gepatcht.zusammenfassung?.twinStatus).toBe('flagged')
  })
})

describe('sprungNachVerifikation + sprungHinweis', () => {
  it('springt zum naechsten markierten Fehler im selben Ordner: kein Hinweis', () => {
    const gepatcht = familie('a')
    const ergebnis = sprungNachVerifikation([markiert('a'), markiert('b')], gepatcht)
    expect(ergebnis.naechste?.sourceId).toBe('b')
    expect(ergebnis.ordnerFertig).toBe(false)
    expect(sprungHinweis(ergebnis, gepatcht)).toBeNull()
  })

  it('Ordner frei + Wechsel: Hinweis nennt Ordner und naechstes Artefakt', () => {
    const gepatcht = { ...familie('a'), path: 'V/Ordner Eins/a.m4a' }
    const ergebnis = sprungNachVerifikation(
      [markiert('a', { path: 'V/Ordner Eins/a.m4a' }), markiert('b', { folderId: 'f2', path: 'V/Ordner Zwei/b.m4a' })],
      gepatcht,
    )
    expect(ergebnis).toMatchObject({ ordnerFertig: true, ordnerGewechselt: true, vorhabenFertig: false })
    const hinweis = sprungHinweis(ergebnis, gepatcht)
    expect(hinweis?.titel).toContain('Ordner Eins')
    expect(hinweis?.beschreibung).toContain('b.m4a')
  })

  it('kein Widerstand mehr: vorhabenFertig, Hinweis auf die Abnahme', () => {
    const gepatcht = familie('a')
    const ergebnis = sprungNachVerifikation([markiert('a'), familie('b')], gepatcht)
    expect(ergebnis).toMatchObject({ naechste: null, vorhabenFertig: true })
    expect(sprungHinweis(ergebnis, gepatcht)?.beschreibung).toContain('Abnahme')
  })

  it('bleibt stehen, wenn der eigene Fehler noch offen ist', () => {
    // Verifizieren eines ANDEREN Teils raeumt die Markierung nicht weg.
    const gepatcht = markiert('a')
    const ergebnis = sprungNachVerifikation([markiert('a'), familie('b')], gepatcht)
    expect(ergebnis).toMatchObject({ naechste: null, vorhabenFertig: false })
    expect(sprungHinweis(ergebnis, gepatcht)).toBeNull()
  })
})

describe('naechsterWiderstand — Korrekturauftraege zaehlen mit (K3)', () => {
  function beauftragt(sourceId: string): TwinFamilySummary {
    return familie(sourceId, {
      transkript: artefakt({ korrekturAuftrag: 'Gehoert unter 26.02' }),
      zusammenfassung: null,
    })
  }

  it('springt auch zu einer Familie mit offenem Auftrag — beim Durchgehen zaehlt beides', () => {
    const liste = [familie('a'), beauftragt('b'), familie('c')]
    expect(naechsterWiderstand(liste, 'a')?.sourceId).toBe('b')
  })

  it('mischt Markierungen und Auftraege in einer Reihenfolge', () => {
    const liste = [markiert('a'), familie('b'), beauftragt('c')]
    expect(naechsterWiderstand(liste, 'a')?.sourceId).toBe('c')
    expect(naechsterWiderstand(liste, 'c')?.sourceId).toBe('a')
  })

  it('meldet das Vorhaben NICHT fertig, solange ein Auftrag offen ist', () => {
    const liste = [beauftragt('a')]
    const ergebnis = sprungNachVerifikation(liste, beauftragt('a'))
    expect(ergebnis.vorhabenFertig).toBe(false)
    expect(ergebnis.ordnerFertig).toBe(false)
  })

  it('ein gemeldeter Auftrag (K4) haelt nichts mehr auf', () => {
    const erledigt = familie('a', {
      transkript: artefakt({
        korrekturAuftrag: 'Gehoert unter 26.02',
        korrekturErledigtAt: '2026-08-30T11:40:00.000Z',
      }),
      zusammenfassung: null,
    })
    expect(naechsterWiderstand([erledigt, familie('b')], 'b')).toBeNull()
  })
})
