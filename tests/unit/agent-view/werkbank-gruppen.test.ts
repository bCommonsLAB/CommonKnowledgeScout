/**
 * @fileoverview Unit-Tests: Themen-Gruppierung der Werkbank (F12, Welle W5).
 *
 * Akzeptanzkriterium 10 als Vertrag: ein Vorhaben mit zwei Themen erscheint
 * unter BEIDEN; Vorhaben ohne `themen` (leer oder — bei Karten aus Scans vor
 * W1 — undefined) landen in der benannten Gruppe „Ohne Thema", nie
 * unsichtbar. Bereichs-Gruppierung behaelt das W3-Verhalten.
 */

import { describe, it, expect } from 'vitest'
import type { VorhabenCard } from '@/lib/agent-view/types'
import {
  baueWerkbankZeilen,
  gruppenVon,
  OHNE_THEMA_GRUPPE,
  type WerkbankZeile,
} from '@/lib/agent-view/werkbank-gruppen'

function card(path: string, themen?: string[]): VorhabenCard {
  const basis: VorhabenCard = {
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
  }
  // themen === undefined simuliert eine Karte aus einem Scan vor W1.
  if (themen === undefined) {
    const { themen: _weg, ...alt } = basis
    return alt
  }
  return { ...basis, themen }
}

function koepfe(zeilen: WerkbankZeile[]): string[] {
  return zeilen.filter((z) => z.art === 'kopf').map((z) => (z.art === 'kopf' ? z.gruppe : ''))
}

function kartenIn(zeilen: WerkbankZeile[], gruppe: string): string[] {
  const ergebnis: string[] = []
  let aktiv = false
  for (const zeile of zeilen) {
    if (zeile.art === 'kopf') aktiv = zeile.gruppe === gruppe
    else if (aktiv) ergebnis.push(zeile.card.path)
  }
  return ergebnis
}

describe('gruppenVon', () => {
  it('bereich ist das erste Pfadsegment; thema liefert JEDES Thema', () => {
    expect(gruppenVon(card('1. Arbeit/Pilot', ['Commoning', 'KI']), 'bereich')).toEqual(['1. Arbeit'])
    expect(gruppenVon(card('1. Arbeit/Pilot', ['Commoning', 'KI']), 'thema')).toEqual(['Commoning', 'KI'])
  })

  it('leere und fehlende themen (Scan vor W1) landen benannt in „Ohne Thema"', () => {
    expect(gruppenVon(card('A/x', []), 'thema')).toEqual([OHNE_THEMA_GRUPPE])
    expect(gruppenVon(card('A/x', undefined), 'thema')).toEqual([OHNE_THEMA_GRUPPE])
  })
})

describe('baueWerkbankZeilen — Thema (F12, Akzeptanzkriterium 10)', () => {
  const beide = card('1. Arbeit/Pilot', ['Commoning', 'KI'])
  const nurKi = card('2. Privat/Steuer', ['KI'])
  const ohne = card('3. Alt/Archiv', [])

  it('ein Vorhaben mit zwei Themen erscheint unter BEIDEN Gruppen', () => {
    const zeilen = baueWerkbankZeilen([beide, nurKi, ohne], 'thema', new Set())
    expect(kartenIn(zeilen, 'Commoning')).toEqual(['1. Arbeit/Pilot'])
    expect(kartenIn(zeilen, 'KI')).toEqual(['1. Arbeit/Pilot', '2. Privat/Steuer'])
  })

  it('„Ohne Thema" ist benannt und steht zuletzt; Themen alphabetisch', () => {
    const zeilen = baueWerkbankZeilen([ohne, nurKi, beide], 'thema', new Set())
    expect(koepfe(zeilen)).toEqual(['Commoning', 'KI', OHNE_THEMA_GRUPPE])
    expect(kartenIn(zeilen, OHNE_THEMA_GRUPPE)).toEqual(['3. Alt/Archiv'])
  })

  it('zeilenKeys bleiben eindeutig, obwohl dieselbe Karte mehrfach erscheint', () => {
    const zeilen = baueWerkbankZeilen([beide], 'thema', new Set())
    const keys = zeilen.filter((z) => z.art === 'karte').map((z) => (z.art === 'karte' ? z.zeilenKey : ''))
    expect(keys).toHaveLength(2)
    expect(new Set(keys).size).toBe(2)
  })

  it('eingeklappte Gruppen behalten den Kopf und lassen die Karten aus', () => {
    const zeilen = baueWerkbankZeilen([beide, nurKi], 'thema', new Set(['KI']))
    expect(koepfe(zeilen)).toContain('KI')
    expect(kartenIn(zeilen, 'KI')).toEqual([])
    expect(kartenIn(zeilen, 'Commoning')).toEqual(['1. Arbeit/Pilot'])
  })
})

describe('baueWerkbankZeilen — Bereich (W3-Verhalten unveraendert)', () => {
  it('gruppiert nach erstem Pfadsegment in Erst-Auftretens-Reihenfolge', () => {
    const zeilen = baueWerkbankZeilen(
      [card('2. Privat/Steuer', []), card('1. Arbeit/Pilot', []), card('2. Privat/Ablage', [])],
      'bereich',
      new Set(),
    )
    expect(koepfe(zeilen)).toEqual(['2. Privat', '1. Arbeit'])
    expect(kartenIn(zeilen, '2. Privat')).toEqual(['2. Privat/Steuer', '2. Privat/Ablage'])
  })
})
