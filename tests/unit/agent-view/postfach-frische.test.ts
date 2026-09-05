/**
 * @fileoverview Unit-Tests: Postfach-Frische (Welle A7b).
 *
 * Der Rueckstand der E-Mail-Auswertung entscheidet sich an der ISO-
 * Kalenderwoche — inklusive der Jahreswechsel, an denen Kalenderjahr und
 * Wochenjahr auseinanderfallen. Geprueft werden ausserdem die drei benannten
 * Zustaende (`ohne_angabe` / `unlesbar` / `gelesen`): ein unlesbares
 * `postfach_bis` darf NICHT wie ein fehlendes behandelt werden.
 */

import { describe, it, expect } from 'vitest'
import {
  isoKalenderwoche,
  istPostfachImRueckstand,
  kalenderwocheLabel,
  lesePostfachStand,
  postfachStandLabel,
} from '@/lib/agent-view/postfach-frische'

/** Lokale Mittagszeit — schliesst Zeitzonen-Rutscher am Tagesrand aus. */
function tag(iso: string): Date {
  const [jahr, monat, tagImMonat] = iso.split('-').map(Number)
  return new Date(jahr, monat - 1, tagImMonat, 12, 0, 0)
}

describe('isoKalenderwoche', () => {
  it('zaehlt die Woche mit dem ersten Donnerstag als KW 1', () => {
    // 2026-01-01 ist ein Donnerstag ⇒ diese Woche ist KW 1/2026.
    expect(isoKalenderwoche(tag('2026-01-01'))).toEqual({ jahr: 2026, woche: 1 })
    expect(isoKalenderwoche(tag('2026-09-05'))).toEqual({ jahr: 2026, woche: 36 })
  })

  it('haelt Wochenjahr und Kalenderjahr am Jahreswechsel auseinander', () => {
    // 2025-12-29 (Mo) gehoert bereits zu KW 1 des Wochenjahres 2026.
    expect(isoKalenderwoche(tag('2025-12-29'))).toEqual({ jahr: 2026, woche: 1 })
    // 2027-01-01 (Fr) gehoert noch zu KW 53 des Wochenjahres 2026.
    expect(isoKalenderwoche(tag('2027-01-01'))).toEqual({ jahr: 2026, woche: 53 })
  })
})

describe('lesePostfachStand — benannte Zustaende', () => {
  const jetzt = tag('2026-09-05') // KW 36/2026

  it('ohne Feld: `ohne_angabe` — der Bericht sagt nichts, das ist kein Rueckstand', () => {
    expect(lesePostfachStand(null, jetzt)).toEqual({ art: 'ohne_angabe' })
    expect(lesePostfachStand(undefined, jetzt)).toEqual({ art: 'ohne_angabe' })
    expect(lesePostfachStand('   ', jetzt)).toEqual({ art: 'ohne_angabe' })
  })

  it('unlesbarer Wert bleibt sichtbar, statt wie ein fehlender zu gelten', () => {
    expect(lesePostfachStand('KW35', jetzt)).toEqual({ art: 'unlesbar', roh: 'KW35' })
    expect(lesePostfachStand('2026-08', jetzt)).toEqual({ art: 'unlesbar', roh: '2026-08' })
    // Woche ausserhalb 1..53 ist ein Tippfehler, kein Nachbarwert.
    expect(lesePostfachStand('2026-KW54', jetzt)).toEqual({ art: 'unlesbar', roh: '2026-KW54' })
    expect(lesePostfachStand('2026-KW0', jetzt)).toEqual({ art: 'unlesbar', roh: '2026-KW0' })
  })

  it('misst den Rueckstand in vollen Wochen gegen die laufende Woche', () => {
    expect(lesePostfachStand('2026-KW36', jetzt)).toEqual({ art: 'gelesen', jahr: 2026, woche: 36, rueckstandWochen: 0 })
    expect(lesePostfachStand('2026-KW35', jetzt)).toEqual({ art: 'gelesen', jahr: 2026, woche: 35, rueckstandWochen: 1 })
    expect(lesePostfachStand('2026-KW29', jetzt)).toEqual({ art: 'gelesen', jahr: 2026, woche: 29, rueckstandWochen: 7 })
  })

  it('rechnet ueber den Jahreswechsel hinweg richtig', () => {
    // KW 51/2025 → KW 2/2026 sind drei Wochen (2025 hat 52 ISO-Wochen).
    const anfangJanuar = tag('2026-01-08') // KW 2/2026
    expect(lesePostfachStand('2025-KW51', anfangJanuar)).toMatchObject({ rueckstandWochen: 3 })
  })

  it('meldet eine Woche in der Zukunft als negativen Rueckstand (Datenfehler)', () => {
    expect(lesePostfachStand('2026-KW40', jetzt)).toMatchObject({ rueckstandWochen: -4 })
  })
})

describe('istPostfachImRueckstand', () => {
  const jetzt = tag('2026-09-05') // KW 36

  it('ohne Schwelle ist die Regel inaktiv — auch bei grossem Rueckstand', () => {
    expect(istPostfachImRueckstand(lesePostfachStand('2020-KW01', jetzt), null)).toBe(false)
  })

  it('mahnt erst OBERHALB der Schwelle', () => {
    const zweiWochen = lesePostfachStand('2026-KW34', jetzt) // Rueckstand 2
    expect(istPostfachImRueckstand(zweiWochen, 2)).toBe(false)
    expect(istPostfachImRueckstand(zweiWochen, 1)).toBe(true)
  })

  it('urteilt nicht ueber unlesbare oder fehlende Angaben', () => {
    expect(istPostfachImRueckstand({ art: 'unlesbar', roh: 'x' }, 0)).toBe(false)
    expect(istPostfachImRueckstand({ art: 'ohne_angabe' }, 0)).toBe(false)
  })
})

describe('Beschriftungen', () => {
  const jetzt = tag('2026-09-05')

  it('formuliert jeden Zustand in einem Satz — dieselbe Sprache fuer Sicht und Befund', () => {
    expect(postfachStandLabel({ art: 'ohne_angabe' })).toBe('Postfach-Fenster nicht angegeben')
    expect(postfachStandLabel({ art: 'unlesbar', roh: 'KW35' })).toContain('unlesbar')
    expect(postfachStandLabel(lesePostfachStand('2026-KW36', jetzt))).toBe('Postfach bis KW 36/2026 — aktuell')
    expect(postfachStandLabel(lesePostfachStand('2026-KW35', jetzt))).toBe('Postfach bis KW 35/2026 — 1 Woche offen')
    expect(postfachStandLabel(lesePostfachStand('2026-KW33', jetzt))).toBe('Postfach bis KW 33/2026 — 3 Wochen offen')
    expect(postfachStandLabel(lesePostfachStand('2026-KW40', jetzt))).toContain('Zukunft')
  })

  it('kalenderwocheLabel schreibt Woche und Jahr aus', () => {
    expect(kalenderwocheLabel(2026, 35)).toBe('KW 35/2026')
  })
})
