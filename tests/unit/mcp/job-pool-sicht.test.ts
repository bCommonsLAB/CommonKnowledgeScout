/**
 * @fileoverview Riegel fuer die Pool-Sicht von `job_liste`/`jobs_aufraeumen`.
 *
 * Befund 29.08.2026 (Prod): Sechs Jobs belegten ab 19:08 alle Worker-Slots und
 * gaben ab 19:13–19:18 kein Lebenszeichen mehr; neunzehn wartende Jobs standen
 * dahinter. Ueber die Bruecke war der Grund unsichtbar — die Liste ist pro
 * Library, die Concurrency-Grenze gilt pool-weit.
 *
 * Getestet wird genau die Unterscheidung, an der das haengt: „alle Slots
 * belegt, weil gearbeitet wird" gegen „alle Slots belegt, weil Leichen sie
 * halten". Wer die verwechselt, wartet auf etwas, das nie fertig wird.
 */

import { describe, it, expect } from 'vitest'
import {
  bauePoolSicht,
  baueErgebnisHinweis,
  poolNichtAbrufbar,
} from '@/lib/mcp/job-pool-sicht'

const SCHWELLE_MS = 30 * 60 * 1000

describe('bauePoolSicht', () => {
  it('nennt Karteileichen als Grund, wenn sie alle Slots halten (Befund 29.08.)', () => {
    const sicht = bauePoolSicht(
      { slots: 6, laufend: 6, steckengeblieben: 6, schwelleMs: SCHWELLE_MS },
      19,
    )
    expect(sicht.freieSlots).toBe(0)
    expect(sicht.stillstandSchwelleMinuten).toBe(30)
    expect(sicht.hinweis).toContain('6 Worker-Slots')
    expect(sicht.hinweis).toContain('19 wartende')
    expect(sicht.hinweis).toContain('jobs_aufraeumen')
  })

  it('sagt bei voller, aber lebendiger Auslastung ausdruecklich „nur warten“', () => {
    const sicht = bauePoolSicht(
      { slots: 6, laufend: 6, steckengeblieben: 0, schwelleMs: SCHWELLE_MS },
      19,
    )
    expect(sicht.hinweis).toContain('Lebenszeichen')
    expect(sicht.hinweis).toContain('warten')
    // Kein Aufruf zum Aufraeumen — hier waere er falsch und wuerde Arbeit toeten.
    expect(sicht.hinweis).not.toContain('jobs_aufraeumen')
  })

  it('meldet Leichen auch dann, wenn sie gerade niemanden blockieren', () => {
    const sicht = bauePoolSicht(
      { slots: 6, laufend: 2, steckengeblieben: 2, schwelleMs: SCHWELLE_MS },
      0,
    )
    expect(sicht.freieSlots).toBe(4)
    expect(sicht.hinweis).toContain('blockieren gerade nichts')
  })

  it('schweigt, wenn es nichts zu erklaeren gibt', () => {
    const sicht = bauePoolSicht(
      { slots: 6, laufend: 2, steckengeblieben: 0, schwelleMs: SCHWELLE_MS },
      0,
    )
    expect(sicht.hinweis).toBeNull()
  })

  it('meldet keine negativen freien Slots, wenn mehr laeuft als erlaubt', () => {
    // Kann nach einer Konfig-Senkung real vorkommen: Slots 3, aber 6 laufen noch.
    const sicht = bauePoolSicht(
      { slots: 3, laufend: 6, steckengeblieben: 0, schwelleMs: SCHWELLE_MS },
      5,
    )
    expect(sicht.freieSlots).toBe(0)
  })

  it('rundet die Schwelle nie auf 0 Minuten ab', () => {
    const sicht = bauePoolSicht(
      { slots: 6, laufend: 0, steckengeblieben: 0, schwelleMs: 10_000 },
      0,
    )
    expect(sicht.stillstandSchwelleMinuten).toBe(1)
  })
})

describe('baueErgebnisHinweis', () => {
  it('sagt nach dem Aufraeumen, dass die Jobs gescheitert und nicht erledigt sind', () => {
    const text = baueErgebnisHinweis(6, { slots: 6, freieSlots: 6, steckengeblieben: 0 })
    expect(text).toContain('6 Karteileiche')
    expect(text).toContain('GESCHEITERT')
  })

  it('liest „0 aufgeraeumt“ bei vollem Pool NICHT als Entwarnung', () => {
    const text = baueErgebnisHinweis(0, { slots: 6, freieSlots: 0, steckengeblieben: 4 })
    expect(text).toContain('anderen Library')
    expect(text).toContain('Reaper')
  })

  it('bleibt bei freien Slots und 0 Treffern schlicht', () => {
    const text = baueErgebnisHinweis(0, { slots: 6, freieSlots: 5, steckengeblieben: 0 })
    expect(text).toContain('Slots frei')
  })

  it('behauptet ohne Pool-Zahlen nichts ueber den Pool', () => {
    const text = baueErgebnisHinweis(0, null)
    expect(text).toContain('keinen eigenen Job')
    expect(text).not.toContain('Slots')
  })
})

describe('poolNichtAbrufbar', () => {
  it('benennt den Fehler und verbietet die Lesart „nicht blockiert“', () => {
    const text = poolNichtAbrufbar('Mongo timeout')
    expect(text).toContain('Mongo timeout')
    expect(text).toContain('UNBEKANNT')
  })
})
