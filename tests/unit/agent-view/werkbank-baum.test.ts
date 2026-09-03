/**
 * @fileoverview Unit-Tests: Baum bis zum Artefakt (Welle A2) — pur.
 *
 * Geprueft werden die Pruef-Praedikate (geprueft = ALLE vorhandenen
 * pruefbaren Artefakte menschlich verifiziert; Scan vor A2 = unbekannt, nie
 * geraten), der Zaehler `n/m`, die Zeilen unter einem Vorhaben (direkte
 * Artefakte, rekursive Ordner, zugeklappte Ordner, benannte Leerzustaende)
 * und die Kurations-Overrides je Artefakt-Key.
 */

import { describe, it, expect } from 'vitest'
import {
  artefaktGeprueft, artefaktKey, artefaktKorrekturOffen, artefaktZustand,
  baueTeilbaumZeilen, effektiveFamilie,
  familienPruefstand, neuesteZuerst, zaehlePruefstand,
} from '@/lib/agent-view/werkbank-baum'
import type { CoverageTreeNode, LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    flaggedBy: null, flaggedAt: null, flaggedNote: null,
    verification: 'unverifiziert',
    ...overrides,
  }
}

function familie(sourceId: string, folderId: string, overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return {
    sourceId, sourceName: `${sourceId}.m4a`, folderId, path: `V/${sourceId}.m4a`,
    artifactCount: 2, leading: artefakt(),
    transkript: artefakt(), zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard' }),
    ...overrides,
  }
}

function knoten(folderId: string, children: CoverageTreeNode[] = []): CoverageTreeNode {
  return {
    folderId, name: folderId, path: `V/${folderId}`, depth: 2,
    bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: true, hasBericht: false,
    sourceCount: 0, fileCount: 0, ownGaps: 0, totalGaps: 0, gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, ampel: 'gruen', children,
  }
}

describe('familienPruefstand', () => {
  it('unbekannt, wenn der Report die A2-Felder nicht traegt (Scan vor A2)', () => {
    expect(familienPruefstand(familie('s1', 'f1', { transkript: undefined, zusammenfassung: undefined }))).toBe('unbekannt')
  })

  it('geprueft nur, wenn ALLE vorhandenen Artefakte menschlich verifiziert sind', () => {
    const beide = familie('s1', 'f1', {
      transkript: artefakt({ verification: 'mensch' }),
      zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard', verification: 'mensch' }),
    })
    expect(familienPruefstand(beide)).toBe('geprueft')
    // ADR 0006: Halb geprueft ist kein Mangel mehr — der Rest gilt als angenommen.
    const halb = familie('s2', 'f1', { transkript: artefakt({ verification: 'mensch' }) })
    expect(familienPruefstand(halb)).toBe('angenommen')
  })

  it('markiert schlaegt alles — auch neben einer gueltigen Verifikation (ADR 0006)', () => {
    const gemischt = familie('s1', 'f1', {
      transkript: artefakt({ verification: 'mensch' }),
      zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard', twinStatus: 'flagged' }),
    })
    expect(familienPruefstand(gemischt)).toBe('markiert')
  })

  it('unangetastete Maschinenarbeit ist angenommen, kein Mangel', () => {
    expect(familienPruefstand(familie('s1', 'f1'))).toBe('angenommen')
  })

  it('nur ein Transkript vorhanden und geprueft ⇒ geprueft (fehlende Zusammenfassung blockiert nicht)', () => {
    const nurTranskript = familie('s1', 'f1', { transkript: artefakt({ verification: 'mensch' }), zusammenfassung: null })
    expect(familienPruefstand(nurTranskript)).toBe('geprueft')
  })

  it('ohne pruefbares Artefakt ist die Familie leer — nicht „OK", sondern unerschlossen', () => {
    expect(familienPruefstand(familie('s1', 'f1', { transkript: null, zusammenfassung: null }))).toBe('leer')
  })

  it('maschinelle Verifikation zaehlt nicht als geprueft', () => {
    expect(artefaktGeprueft(artefakt({ verification: 'maschinell' }))).toBe(false)
    expect(artefaktGeprueft(artefakt({ verification: 'mensch' }))).toBe(true)
  })
})

describe('zaehlePruefstand', () => {
  it('zaehlt markiert/geprueft/gesamt/unbekannt getrennt', () => {
    const zaehler = zaehlePruefstand([
      familie('a', 'f1', { transkript: artefakt({ verification: 'mensch' }), zusammenfassung: null }),
      familie('b', 'f1'),
      familie('c', 'f1', { transkript: undefined, zusammenfassung: undefined }),
      familie('d', 'f1', { transkript: artefakt({ twinStatus: 'flagged' }), zusammenfassung: null }),
      familie('e', 'f1', {
        transkript: artefakt({ korrekturAuftrag: 'Gehoert unter 26.02' }),
        zusammenfassung: null,
      }),
    ])
    expect(zaehler).toEqual({ markiert: 1, auftrag: 1, geprueft: 1, gesamt: 5, unbekannt: 1 })
  })
})

describe('Korrekturauftrag im Baum (K3)', () => {
  it('faerbt ein Artefakt mit offenem Auftrag als „auftrag" — auch ohne Markierung', () => {
    expect(artefaktZustand(artefakt({ korrekturAuftrag: 'Gehoert unter 26.02' }))).toBe('auftrag')
  })

  it('zaehlt einen gemeldeten Auftrag NICHT mehr als offen (K4 meldet Vollzug)', () => {
    const erledigt = artefakt({
      korrekturAuftrag: 'Gehoert unter 26.02',
      korrekturErledigtAt: '2026-08-30T11:40:00.000Z',
    })
    expect(artefaktKorrekturOffen(erledigt)).toBe(false)
    expect(artefaktZustand(erledigt)).toBe('angenommen')
  })

  it('die Markierung schlaegt den Auftrag — der benannte Fehler ist die strengere Aussage', () => {
    const beides = artefakt({ twinStatus: 'flagged', korrekturAuftrag: 'Gehoert unter 26.02' })
    expect(artefaktZustand(beides)).toBe('markiert')
    // Das Praedikat bleibt trotzdem wahr: die Widerstandsliste zeigt beides.
    expect(artefaktKorrekturOffen(beides)).toBe(true)
  })

  it('ein offener Auftrag schlaegt den Haken — es steht noch Arbeit an', () => {
    const geprueftMitAuftrag = artefakt({
      verification: 'mensch',
      korrekturAuftrag: 'Doch noch umbenennen',
    })
    expect(artefaktZustand(geprueftMitAuftrag)).toBe('auftrag')
  })

  it('die Familie erbt den Auftrag eines einzelnen Artefakts', () => {
    const f = familie('x', 'f1', {
      transkript: artefakt({ verification: 'mensch' }),
      zusammenfassung: artefakt({ korrekturAuftrag: 'Titel ist falsch' }),
    })
    expect(familienPruefstand(f)).toBe('auftrag')
  })
})

describe('effektiveFamilie', () => {
  it('ueberlagert den Report-Zustand mit frischen Kurations-Overrides je Artefakt', () => {
    const basis = familie('s1', 'f1')
    const overrides = new Map([[artefaktKey('s1', basis.transkript as LeadingArtifactSummary), artefakt({ verification: 'mensch' })]])
    const effektiv = effektiveFamilie(basis, overrides)
    expect(effektiv.transkript?.verification).toBe('mensch')
    expect(effektiv.zusammenfassung?.verification).toBe('unverifiziert')
  })
})

describe('baueTeilbaumZeilen', () => {
  const vorhabenId = 'fV'

  it('benennt Reports ohne Familien-Feld (Scan vor Welle 4) statt zu raten', () => {
    const zeilen = baueTeilbaumZeilen({ vorhabenFolderId: vorhabenId, knoten: knoten(vorhabenId), familien: undefined, ordnerZu: new Set() })
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].art).toBe('baum-hinweis')
  })

  it('benennt einen Teilbaum ohne Familien', () => {
    const zeilen = baueTeilbaumZeilen({ vorhabenFolderId: vorhabenId, knoten: knoten(vorhabenId), familien: [], ordnerZu: new Set() })
    expect(zeilen[0].art).toBe('baum-hinweis')
  })

  it('liefert direkte Artefakte, dann Ordner mit Familien rekursiv — leere Ordner fehlen', () => {
    const baum = knoten(vorhabenId, [knoten('f-ordner1', [knoten('f-tief')]), knoten('f-leer')])
    const familien = [
      familie('direkt', vorhabenId),
      familie('im-ordner', 'f-ordner1'),
      familie('tief', 'f-tief'),
    ]
    const zeilen = baueTeilbaumZeilen({ vorhabenFolderId: vorhabenId, knoten: baum, familien, ordnerZu: new Set() })
    expect(zeilen.map((z) => z.art)).toEqual(['baum-artefakt', 'ordner', 'baum-artefakt', 'ordner', 'baum-artefakt'])
    const ordner = zeilen.filter((z) => z.art === 'ordner')
    expect(ordner.map((z) => (z.art === 'ordner' ? z.node.folderId : ''))).toEqual(['f-ordner1', 'f-tief'])
    // Zaehler des oberen Ordners umfasst den Teilbaum (2 Familien).
    expect(ordner[0].art === 'ordner' && ordner[0].zaehler.gesamt).toBe(2)
  })

  it('zugeklappte Ordner behalten die Zeile und lassen den Inhalt aus', () => {
    const baum = knoten(vorhabenId, [knoten('f-ordner1')])
    const zeilen = baueTeilbaumZeilen({
      vorhabenFolderId: vorhabenId, knoten: baum,
      familien: [familie('a', 'f-ordner1')], ordnerZu: new Set(['f-ordner1']),
    })
    expect(zeilen.map((z) => z.art)).toEqual(['ordner'])
    expect(zeilen[0].art === 'ordner' && zeilen[0].aufgeklappt).toBe(false)
  })

  it('Familien ohne Ordner im Baum erscheinen am Vorhaben statt still zu fehlen', () => {
    const zeilen = baueTeilbaumZeilen({
      vorhabenFolderId: vorhabenId, knoten: knoten(vorhabenId),
      familien: [familie('verwaist', 'f-unbekannt')], ordnerZu: new Set(),
    })
    expect(zeilen.map((z) => z.art)).toEqual(['baum-artefakt'])
  })
})

describe('neuesteZuerst — Ordner absteigend (Befund Testsession 25.08.2026)', () => {
  it('Ordnernamen mit Jahr/Monat stehen chronologisch rueckwaerts', () => {
    const kinder = [knoten('2026-02 Beispiel'), knoten('2026-04-02 Besprechung'), knoten('2026-03-10 Workshop')]
    expect(neuesteZuerst(kinder).map((k) => k.name)).toEqual([
      '2026-04-02 Besprechung',
      '2026-03-10 Workshop',
      '2026-02 Beispiel',
    ])
  })

  it('laesst die Eingabe unangetastet (pur)', () => {
    const kinder = [knoten('a'), knoten('b')]
    neuesteZuerst(kinder)
    expect(kinder.map((k) => k.name)).toEqual(['a', 'b'])
  })

  it('baueTeilbaumZeilen ordnet die Ordner-Zeilen neueste zuerst', () => {
    const alt = knoten('2026-02 Alt')
    const neu = knoten('2026-04 Neu')
    const zeilen = baueTeilbaumZeilen({
      vorhabenFolderId: 'V',
      knoten: knoten('V', [alt, neu]),
      familien: [familie('s-alt', '2026-02 Alt'), familie('s-neu', '2026-04 Neu')],
      ordnerZu: new Set<string>(),
    })
    const ordner = zeilen.filter((z) => z.art === 'ordner').map((z) => (z.art === 'ordner' ? z.node.name : ''))
    expect(ordner).toEqual(['2026-04 Neu', '2026-02 Alt'])
  })
})
