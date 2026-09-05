/**
 * @fileoverview Unit-Tests: Aktuell-Sicht (Welle A7).
 *
 * Die Sicht muss dieselbe Einteilung und Reihenfolge liefern wie der
 * Export `renderAktuell` — sonst laufen Browser-Sicht und `AKTUELL.md`
 * auseinander. Geprueft werden: Status-Buecher (aktiv / ruhend / ohne
 * Status / ohne Bericht), die Termin-Sortierung, die Marken „nicht
 * fixiert" und „ueberfaellig" (gegen HEUTE, nicht gegen den Scan-Tag),
 * die sichtbare Kappung der offenen Punkte und die Erkennung von Karten
 * aus Reports vor A7.
 */

import { describe, it, expect } from 'vitest'
import { baueAktuellSicht, sichtIstLeer } from '@/lib/agent-view/aktuell-sicht'
import type { VorhabenCard } from '@/lib/agent-view/types'

const HEUTE = '2026-09-05'

function karte(name: string, overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: `f-${name}`,
    name,
    path: `4. Ökosozialer Aktivismus/${name}`,
    bearbeitungsstand: 'berichtet',
    bearbeitungsstandSeit: null,
    hasBericht: true,
    totalGaps: 0,
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    gapsByType: {},
    widerspruch: false,
    ampel: 'gruen',
    berichtTitel: name,
    berichtFileId: `file-${name}`,
    berichtModifiedAt: '2026-09-01T10:00:00.000Z',
    berichtStatus: 'aktiv',
    themen: [],
    gepflegteThemen: [],
    berichtRolle: null,
    berichtLetzteAktivitaet: null,
    berichtNaechsterTermin: null,
    berichtTerminFixiert: true,
    berichtOffenePunkte: [],
    berichtOffeneAnzahl: 0,
    postfachAb: null,
    postfachBis: null,
    ...overrides,
  }
}

describe('baueAktuellSicht — Status-Buecher', () => {
  it('teilt nach dem ERKLAERTEN Status ein und raet nichts dazu', () => {
    const sicht = baueAktuellSicht(
      [
        karte('A', { berichtStatus: 'aktiv' }),
        karte('B', { berichtStatus: 'ruhend' }),
        karte('C', { berichtStatus: 'abgeschlossen' }),
        karte('D', { berichtStatus: null }),
        karte('E', { hasBericht: false, berichtStatus: null, berichtFileId: null }),
      ],
      HEUTE,
    )

    expect(sicht.aktiv.map((v) => v.name)).toEqual(['A'])
    expect(sicht.ruhend.map((v) => v.titel)).toEqual(['B', 'C'])
    expect(sicht.ohneStatus.map((v) => v.titel)).toEqual(['D'])
    // Ohne BERICHT.md ist ein Vorhaben nicht einzuordnen — es faellt nicht
    // still weg, sondern erscheint als Abdeckungsluecke.
    expect(sicht.ohneBericht).toBe(1)
    expect(sicht.mitBericht).toBe(4)
  })

  it('behaelt einen unbekannten Status-Wert sichtbar, statt ihn zu schlucken', () => {
    const sicht = baueAktuellSicht([karte('A', { berichtStatus: 'pausiert-bis-Q4' })], HEUTE)
    expect(sicht.ruhend[0].status).toBe('pausiert-bis-Q4')
    expect(sicht.aktiv).toHaveLength(0)
  })
})

describe('baueAktuellSicht — Reihenfolge und Termine', () => {
  it('sortiert aktive Vorhaben nach Termin, Terminlose ans Ende (wie renderAktuell)', () => {
    const sicht = baueAktuellSicht(
      [
        karte('Ohne', { berichtLetzteAktivitaet: '2026-09-01' }),
        karte('Spaet', { berichtNaechsterTermin: '2026-10-30' }),
        karte('Frueh', { berichtNaechsterTermin: '2026-09-10' }),
      ],
      HEUTE,
    )
    expect(sicht.aktiv.map((v) => v.name)).toEqual(['Frueh', 'Spaet', 'Ohne'])
    expect(sicht.termine.map((v) => v.name)).toEqual(['Frueh', 'Spaet'])
  })

  it('markiert ueberfaellig gegen HEUTE, nicht gegen den Scan-Tag', () => {
    const sicht = baueAktuellSicht(
      [
        karte('Vergangen', { berichtNaechsterTermin: '2026-08-20' }),
        karte('Kommend', { berichtNaechsterTermin: '2026-09-24' }),
      ],
      HEUTE,
    )
    expect(sicht.termine.find((v) => v.name === 'Vergangen')?.ueberfaellig).toBe(true)
    expect(sicht.termine.find((v) => v.name === 'Kommend')?.ueberfaellig).toBe(false)
  })

  it('traegt `termin_fixiert: nein` als offenen Termin weiter', () => {
    const sicht = baueAktuellSicht(
      [karte('A', { berichtNaechsterTermin: '2026-09-22', berichtTerminFixiert: false })],
      HEUTE,
    )
    expect(sicht.termine[0].terminFixiert).toBe(false)
  })
})

describe('baueAktuellSicht — offene Punkte', () => {
  it('macht die Kappung sichtbar statt still abzuschneiden', () => {
    const sicht = baueAktuellSicht(
      [karte('A', { berichtOffenePunkte: ['erstens', 'zweitens'], berichtOffeneAnzahl: 5 })],
      HEUTE,
    )
    expect(sicht.mitSchritten).toHaveLength(1)
    expect(sicht.mitSchritten[0].offenePunkte).toEqual(['erstens', 'zweitens'])
    expect(sicht.mitSchritten[0].weiterePunkte).toBe(3)
  })

  it('fuehrt Vorhaben ohne offenen Punkt nicht unter „was als Naechstes ansteht"', () => {
    const sicht = baueAktuellSicht([karte('A'), karte('B', { berichtOffenePunkte: ['x'], berichtOffeneAnzahl: 1 })], HEUTE)
    expect(sicht.mitSchritten.map((v) => v.name)).toEqual(['B'])
    expect(sicht.aktiv).toHaveLength(2)
  })
})

describe('baueAktuellSicht — alte Reports und Leerzustand', () => {
  it('zaehlt Karten aus Scans vor A7, statt leere Felder zu behaupten', () => {
    const alt = karte('Alt')
    delete alt.berichtOffenePunkte
    delete alt.berichtTerminFixiert
    const sicht = baueAktuellSicht([alt, karte('Neu')], HEUTE)
    expect(sicht.altKarten).toBe(1)
    // Die alte Karte bleibt trotzdem in der Liste — sie faellt nicht weg.
    expect(sicht.aktiv.map((v) => v.name).sort()).toEqual(['Alt', 'Neu'])
  })

  it('faellt auf den Ordnernamen zurueck, wenn der Bericht keine H1 traegt', () => {
    const sicht = baueAktuellSicht([karte('26.02 AECED', { berichtTitel: '' })], HEUTE)
    expect(sicht.aktiv[0].titel).toBe('26.02 AECED')
  })

  it('erkennt die leere Sicht (kein Vorhaben mit Bericht)', () => {
    const leer = baueAktuellSicht([karte('A', { hasBericht: false })], HEUTE)
    expect(sichtIstLeer(leer)).toBe(true)
    expect(sichtIstLeer(baueAktuellSicht([karte('A')], HEUTE))).toBe(false)
  })
})

describe('baueAktuellSicht — Postfach-Rueckstand (A7b)', () => {
  // 2026-09-05 ist KW 36/2026.
  const JETZT = new Date(2026, 8, 5, 12, 0, 0)

  it('ohne Schwelle mahnt die Sicht nicht — wie die Regel selbst', () => {
    const sicht = baueAktuellSicht([karte('A', { postfachBis: '2020-KW01' })], HEUTE, { jetzt: JETZT })
    expect(sicht.postfachRueckstaendig).toEqual([])
    // Der Stand steht trotzdem auf dem Vorhaben — nur gemahnt wird nicht.
    expect(sicht.aktiv[0].postfach).toMatchObject({ art: 'gelesen', jahr: 2020, woche: 1 })
  })

  it('mit Schwelle: nur die Vorhaben oberhalb der Schwelle', () => {
    const sicht = baueAktuellSicht(
      [
        karte('Frisch', { postfachBis: '2026-KW35' }), // Rueckstand 1
        karte('Alt', { postfachBis: '2026-KW29' }), // Rueckstand 7
        karte('Ohne'), // kein Feld
      ],
      HEUTE,
      { jetzt: JETZT, postfachMaxRueckstandWochen: 2 },
    )
    expect(sicht.postfachRueckstaendig.map((v) => v.name)).toEqual(['Alt'])
  })

  it('zaehlt unlesbare Angaben mit — „Feld da, aber unbrauchbar" ist ein Zustand', () => {
    const sicht = baueAktuellSicht(
      [karte('Kaputt', { postfachBis: 'letzte Woche' })],
      HEUTE,
      { jetzt: JETZT, postfachMaxRueckstandWochen: 52 },
    )
    expect(sicht.postfachRueckstaendig.map((v) => v.name)).toEqual(['Kaputt'])
    expect(sicht.aktiv[0].postfach).toEqual({ art: 'unlesbar', roh: 'letzte Woche' })
  })

  it('ruhende Vorhaben werden nicht gemahnt — nur was laeuft', () => {
    const sicht = baueAktuellSicht(
      [karte('Ruht', { berichtStatus: 'ruhend', postfachBis: '2020-KW01' })],
      HEUTE,
      { jetzt: JETZT, postfachMaxRueckstandWochen: 1 },
    )
    expect(sicht.postfachRueckstaendig).toEqual([])
  })
})
