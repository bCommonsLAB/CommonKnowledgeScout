/**
 * @fileoverview Unit-Tests: Werkbank-Filter/Sortierung/Leer-Begruendung (F6, W3).
 *
 * Die geteilte Filter-Semantik als Vertrag: „Zu tun" nach §3 (Ampel/Widerspruch,
 * Alt-Karten sichtbar gezaehlt), „Bereit" via geteiltem Praedikat, Chips exakt
 * wie die MCP-Kompaktsicht — und jeder leere Zustand nennt seinen Grund
 * (Akzeptanzkriterium 4).
 */

import { describe, it, expect } from 'vitest'
import type { VorhabenCard } from '@/lib/agent-view/types'
import {
  bereichVon,
  filtereVorhaben,
  karteHatBefundZu,
  matchtBefundFilter,
  sortiereVorhaben,
  zuTun,
} from '@/lib/agent-view/werkbank-filter'
import { beschreibeLeereWerkbankListe, type WerkbankLeerArgs } from '@/lib/agent-view/werkbank-leer'

const KEIN_CHIP = { akteur: null, zyklusSchritt: null } as const

function card(path: string, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: `f-${path}`,
    name: path.split('/').pop() ?? path,
    path,
    bearbeitungsstand: null,
    bearbeitungsstandSeit: null,
    hasBericht: false,
    totalGaps: 0,
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    gapsByType: {},
    widerspruch: false,
    ampel: 'gruen',
    berichtTitel: null,
    berichtFileId: null,
    berichtModifiedAt: null,
    berichtStatus: null,
    themen: [],
    ...overrides,
  }
}

/** Karte aus einem gespeicherten Report vor W1 (ohne Werkbank-Felder). */
function altKarte(path: string, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  const { ampel: _a, berichtTitel: _t, berichtFileId: _f, berichtModifiedAt: _m, berichtStatus: _s, themen: _th, ...rest } = card(path, overrides)
  return rest
}

describe('matchtBefundFilter (geteilt mit MCP)', () => {
  const befund = { actor: 'knowledgescout', zyklusSchritt: 1 } as const

  it('matcht auf Akteur, Schritt und Kombination; leerer Filter matcht alles', () => {
    expect(matchtBefundFilter(befund, KEIN_CHIP)).toBe(true)
    expect(matchtBefundFilter(befund, { akteur: 'knowledgescout', zyklusSchritt: null })).toBe(true)
    expect(matchtBefundFilter(befund, { akteur: 'mensch', zyklusSchritt: null })).toBe(false)
    expect(matchtBefundFilter(befund, { akteur: null, zyklusSchritt: 1 })).toBe(true)
    expect(matchtBefundFilter(befund, { akteur: null, zyklusSchritt: 4 })).toBe(false)
    expect(matchtBefundFilter(befund, { akteur: 'knowledgescout', zyklusSchritt: 4 })).toBe(false)
  })
})

describe('zuTun (§3: ampel ≠ gruen ODER widerspruch)', () => {
  it('gruen ohne Widerspruch ist nichts zu tun; gelb, rot und Widerspruch schon', () => {
    expect(zuTun(card('A'))).toBe(false)
    expect(zuTun(card('A', { ampel: 'gelb' }))).toBe(true)
    expect(zuTun(card('A', { ampel: 'rot' }))).toBe(true)
    expect(zuTun(card('A', { widerspruch: true }))).toBe(true)
  })

  it('Karten aus Scans vor W1 sind NICHT auswertbar (null, kein Raten)', () => {
    expect(zuTun(altKarte('A'))).toBeNull()
  })
})

describe('karteHatBefundZu (Chips via GAP_REGISTRY)', () => {
  const mitBefunden = card('A', { gapsByType: { source_without_twin: 2, twin_unverified: 1 } })

  it('leitet Akteur und Schritt je Typ aus der Registry ab', () => {
    // source_without_twin: knowledgescout/1 · twin_unverified: mensch/4
    expect(karteHatBefundZu(mitBefunden, { akteur: 'knowledgescout', zyklusSchritt: null })).toBe(true)
    expect(karteHatBefundZu(mitBefunden, { akteur: 'cowork', zyklusSchritt: null })).toBe(false)
    expect(karteHatBefundZu(mitBefunden, { akteur: null, zyklusSchritt: 4 })).toBe(true)
    expect(karteHatBefundZu(mitBefunden, { akteur: 'knowledgescout', zyklusSchritt: 4 })).toBe(false)
    expect(karteHatBefundZu(mitBefunden, { akteur: 'mensch', zyklusSchritt: 4 })).toBe(true)
    expect(karteHatBefundZu(card('B'), { akteur: 'mensch', zyklusSchritt: null })).toBe(false)
    expect(karteHatBefundZu(card('B'), KEIN_CHIP)).toBe(true)
  })

  it('wirft bei unbekanntem Gap-Typ statt ihn still zu verschlucken', () => {
    const kaputt = card('X', { gapsByType: { zukunftstyp: 1 } as VorhabenCard['gapsByType'] })
    expect(() => karteHatBefundZu(kaputt, { akteur: 'mensch', zyklusSchritt: null })).toThrow('Unbekannter Gap-Typ')
  })
})

describe('filtereVorhaben + bereichVon', () => {
  const gruen = card('1. Arbeit/Pilot', { berichtTitel: 'Pilotprojekt Klima' })
  const rot = card('1. Arbeit/Chaos', { ampel: 'rot', totalGaps: 3, gapsByType: { source_without_twin: 3 }, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 3 } })
  const bereit = card('2. Privat/Steuer', { ampel: 'rot', totalGaps: 1, gapsByType: { twin_unverified: 1 }, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 } })
  const alt = altKarte('3. Alt/Archiv')

  it('Suche matcht Name, Pfad und Bericht-Titel', () => {
    expect(filtereVorhaben([gruen, rot], { statusFilter: 'alle', befundFilter: KEIN_CHIP, suche: 'klima' }).zeilen).toEqual([gruen])
    expect(filtereVorhaben([gruen, rot], { statusFilter: 'alle', befundFilter: KEIN_CHIP, suche: 'chaos' }).zeilen).toEqual([rot])
    expect(filtereVorhaben([gruen, rot], { statusFilter: 'alle', befundFilter: KEIN_CHIP, suche: '1. arbeit' }).zeilen).toHaveLength(2)
  })

  it('„Zu tun" filtert auf Ampel/Widerspruch und zaehlt Alt-Karten sichtbar', () => {
    const ergebnis = filtereVorhaben([gruen, rot, bereit, alt], { statusFilter: 'zu_tun', befundFilter: KEIN_CHIP, suche: '' })
    expect(ergebnis.zeilen).toEqual([rot, bereit])
    expect(ergebnis.nichtAuswertbar).toBe(1)
  })

  it('„Bereit" nutzt das geteilte Praedikat — auch fuer Alt-Karten (gapsByActor existiert immer)', () => {
    const ergebnis = filtereVorhaben([gruen, rot, bereit, alt], { statusFilter: 'bereit', befundFilter: KEIN_CHIP, suche: '' })
    expect(ergebnis.zeilen).toEqual([bereit])
    expect(ergebnis.nichtAuswertbar).toBe(0)
  })

  it('Chips wirken zusaetzlich zum Status-Filter', () => {
    const ergebnis = filtereVorhaben([gruen, rot, bereit], {
      statusFilter: 'zu_tun',
      befundFilter: { akteur: 'knowledgescout', zyklusSchritt: null },
      suche: '',
    })
    expect(ergebnis.zeilen).toEqual([rot])
  })

  it('bereichVon ist das erste Pfadsegment', () => {
    expect(bereichVon(gruen)).toBe('1. Arbeit')
    expect(bereichVon(card('Solo'))).toBe('Solo')
  })
})

describe('sortiereVorhaben', () => {
  const a = card('A/x', { bearbeitungsstand: 'abgenommen', totalGaps: 1 })
  const b = card('B/x', { bearbeitungsstand: null, totalGaps: 5 })
  const c = card('C/x', { bearbeitungsstand: 'ungesichtet', totalGaps: 3 })

  it('pfad ist deterministisch, stand folgt der Board-Reihenfolge (ohne Stand zuletzt), befunde absteigend', () => {
    expect(sortiereVorhaben([c, b, a], 'pfad').map((k) => k.path)).toEqual(['A/x', 'B/x', 'C/x'])
    expect(sortiereVorhaben([a, b, c], 'stand').map((k) => k.path)).toEqual(['C/x', 'A/x', 'B/x'])
    expect(sortiereVorhaben([a, b, c], 'befunde').map((k) => k.totalGaps)).toEqual([5, 3, 1])
  })

  it('innerhalb eines Bereichs stehen die neuesten zuerst (Namen beginnen mit Jahr/Monat)', () => {
    const alt2018 = card('4. Aktivismus/18.05 Escher')
    const dez2025 = card('4. Aktivismus/25.12 KnowledgeScout')
    const jan2026 = card('4. Aktivismus/26.01 Klimamassnahmen')
    expect(sortiereVorhaben([alt2018, jan2026, dez2025], 'pfad').map((k) => k.name)).toEqual([
      '26.01 Klimamassnahmen',
      '25.12 KnowledgeScout',
      '18.05 Escher',
    ])
  })

  it('die Bereiche selbst bleiben aufsteigend — Phasen 1..7, nicht 7..1', () => {
    const phase1 = card('1. Orientierung/26.01 Neu')
    const phase7 = card('7. Buchprojekt/18.01 Alt')
    expect(sortiereVorhaben([phase7, phase1], 'pfad').map((k) => k.path)).toEqual([
      '1. Orientierung/26.01 Neu',
      '7. Buchprojekt/18.01 Alt',
    ])
  })
})

describe('beschreibeLeereWerkbankListe (Akzeptanzkriterium 4)', () => {
  function leerArgs(overrides: Partial<WerkbankLeerArgs> = {}): WerkbankLeerArgs {
    return {
      gefiltert: 0, gesamt: 5, statusFilter: 'alle',
      befundFilter: KEIN_CHIP, suche: '', nichtAuswertbar: 0,
      scoped: false, scopePath: null,
      ...overrides,
    }
  }

  it('null, wenn die Liste nicht leer ist', () => {
    expect(beschreibeLeereWerkbankListe(leerArgs({ gefiltert: 3 }))).toBeNull()
  })

  it('erklaert die Vorhaben-Erkennung bei leerem Report — mit Teilbaum-Hinweis, wenn scoped', () => {
    expect(beschreibeLeereWerkbankListe(leerArgs({ gesamt: 0 }))).toContain('bearbeitungsstand')
    const scoped = beschreibeLeereWerkbankListe(leerArgs({ gesamt: 0, scoped: true, scopePath: 'A/B' }))
    expect(scoped).toContain('TEILBAUM')
    expect(scoped).toContain('A/B')
  })

  it('benennt Alt-Reports, wenn „Zu tun" nicht auswertbar war', () => {
    const text = beschreibeLeereWerkbankListe(leerArgs({ statusFilter: 'zu_tun', nichtAuswertbar: 5 }))
    expect(text).toContain('vor Werkbank-Welle W1')
  })

  it('erklaert leere Status-Filter fachlich (gruen bzw. maschinelle Befunde)', () => {
    expect(beschreibeLeereWerkbankListe(leerArgs({ statusFilter: 'zu_tun' }))).toContain('gruen')
    expect(beschreibeLeereWerkbankListe(leerArgs({ statusFilter: 'bereit' }))).toContain('maschinellen Befunde')
  })

  it('benennt bei Suche/Chips die aktiven Einschraenkungen', () => {
    const text = beschreibeLeereWerkbankListe(
      leerArgs({ suche: 'klima', befundFilter: { akteur: 'mensch', zyklusSchritt: 4 } }),
    )
    expect(text).toContain('Suche „klima"')
    expect(text).toContain('Mensch')
    expect(text).toContain('4')
  })
})
