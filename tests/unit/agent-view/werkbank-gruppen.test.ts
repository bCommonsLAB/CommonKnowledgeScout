/**
 * @fileoverview Unit-Tests: Themen-Gruppierung der Werkbank (F12/W5, A6).
 *
 * Seit A6 speist sich die Gruppierung AUSSCHLIESSLICH aus den von Hand
 * gepflegten Themen (`themen:` im _INDEX.md, `card.gepflegteThemen`) — die
 * BERICHT-`themen` zaehlen nicht mehr. Akzeptanzkriterium 10 bleibt: ein
 * Vorhaben mit zwei Themen erscheint unter BEIDEN Gruppen; ohne Themen
 * (leer oder — bei Karten aus Scans vor A6 — undefined) benannt in
 * „Ohne Thema", nie unsichtbar. Bereichs-Gruppierung behaelt W3.
 */

import { describe, it, expect } from 'vitest'
import type { VorhabenCard } from '@/lib/agent-view/types'
import {
  alleGepflegtenThemen,
  AUTO_ZU_AB_KARTEN,
  baueWerkbankZeilen,
  berechneEingeklappt,
  gruppenVon,
  OHNE_THEMA_GRUPPE,
  ueberlagereThemen,
  type WerkbankZeile,
} from '@/lib/agent-view/werkbank-gruppen'

function card(path: string, gepflegteThemen?: string[]): VorhabenCard {
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
    gepflegteThemen: [],
  }
  // gepflegteThemen === undefined simuliert eine Karte aus einem Scan vor A6.
  if (gepflegteThemen === undefined) {
    const { gepflegteThemen: _weg, ...alt } = basis
    return alt
  }
  return { ...basis, gepflegteThemen }
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

  it('leere und fehlende gepflegte Themen (Scan vor A6) landen benannt in „Ohne Thema"', () => {
    expect(gruppenVon(card('A/x', []), 'thema')).toEqual([OHNE_THEMA_GRUPPE])
    expect(gruppenVon(card('A/x', undefined), 'thema')).toEqual([OHNE_THEMA_GRUPPE])
  })

  it('A6: BERICHT-themen zaehlen NICHT mehr — nur das gepflegte Feld gruppiert', () => {
    const mitBerichtThemen = { ...card('A/x', []), themen: ['Technik-Baustein'] }
    expect(gruppenVon(mitBerichtThemen, 'thema')).toEqual([OHNE_THEMA_GRUPPE])
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

describe('alleGepflegtenThemen + ueberlagereThemen (A6)', () => {
  it('sammelt das Vokabular dedupliziert und alphabetisch', () => {
    expect(alleGepflegtenThemen([
      card('A/x', ['KI', 'Commoning']),
      card('A/y', ['KI']),
      card('A/z', undefined),
    ])).toEqual(['Commoning', 'KI'])
  })

  it('ueberlagert frisch geschriebene Themen bis zum naechsten Scan', () => {
    const karten = [card('A/x', ['Alt'])]
    const frisch = ueberlagereThemen(karten, new Map([[karten[0].folderId, ['Neu']]]))
    expect(frisch[0].gepflegteThemen).toEqual(['Neu'])
    expect(karten[0].gepflegteThemen).toEqual(['Alt'])
  })
})

describe('berechneEingeklappt — lange Listen starten zu (Befund Testsession 25.08.2026)', () => {
  const keine = new Map<string, boolean>()

  /** `anzahl` Karten, gleichmaessig auf zwei Bereiche verteilt. */
  function viele(anzahl: number): VorhabenCard[] {
    return Array.from({ length: anzahl }, (_, i) =>
      card(`${(i % 2) + 1}. Bereich${(i % 2) + 1}/V${i}`),
    )
  }

  it('kurze Liste bleibt offen — ein Suchtreffer versteckt sich nicht', () => {
    const karten = viele(AUTO_ZU_AB_KARTEN)
    expect(berechneEingeklappt(karten, 'bereich', { manuell: keine, auswahlId: null }).size).toBe(0)
  })

  it('lange Liste startet zugeklappt', () => {
    const karten = viele(AUTO_ZU_AB_KARTEN + 1)
    const zu = berechneEingeklappt(karten, 'bereich', { manuell: keine, auswahlId: null })
    expect([...zu].sort()).toEqual(['1. Bereich1', '2. Bereich2'])
  })

  it('die Gruppe der Auswahl bleibt offen (Deep-Link zeigt seine Auswahl)', () => {
    const karten = viele(AUTO_ZU_AB_KARTEN + 1)
    const zu = berechneEingeklappt(karten, 'bereich', { manuell: keine, auswahlId: karten[0].folderId })
    expect(zu.has('1. Bereich1')).toBe(false)
    expect(zu.has('2. Bereich2')).toBe(true)
  })

  it('ein Handgriff des Menschen ueberstimmt die Automatik in BEIDE Richtungen', () => {
    const lang = viele(AUTO_ZU_AB_KARTEN + 1)
    const aufgeklappt = berechneEingeklappt(lang, 'bereich', {
      manuell: new Map([['1. Bereich1', false]]),
      auswahlId: null,
    })
    expect(aufgeklappt.has('1. Bereich1')).toBe(false)

    const kurz = viele(4)
    const zugeklappt = berechneEingeklappt(kurz, 'bereich', {
      manuell: new Map([['1. Bereich1', true]]),
      auswahlId: null,
    })
    expect(zugeklappt.has('1. Bereich1')).toBe(true)
  })

  it('der Handgriff schlaegt auch die Auswahl — sonst springt die Gruppe zurueck auf', () => {
    const karten = viele(AUTO_ZU_AB_KARTEN + 1)
    const zu = berechneEingeklappt(karten, 'bereich', {
      manuell: new Map([['1. Bereich1', true]]),
      auswahlId: karten[0].folderId,
    })
    expect(zu.has('1. Bereich1')).toBe(true)
  })
})
