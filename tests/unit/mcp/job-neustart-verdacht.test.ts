/**
 * Welle W8 — Prozess-Neustart am Muster erkennen.
 *
 * Beleg: Beim Server-Neustart um 12:45 verstummten alle sechs Slots
 * innerhalb einer Minute. `job_liste` sagte „nichts zu tun ausser warten" —
 * es gab nichts mehr, worauf zu warten war. Zweimal 30 Minuten Stillstand.
 */
import { describe, expect, it } from 'vitest'
import { pruefeNeustart } from '@/lib/mcp/job-neustart-verdacht'
import { bauePoolSicht } from '@/lib/mcp/job-pool-sicht'

const JETZT = new Date('2026-09-02T13:20:00Z')
const vor = (minuten: number, sekunden = 0) =>
  new Date(JETZT.getTime() - minuten * 60_000 - sekunden * 1000)

describe('pruefeNeustart', () => {
  it('erkennt sechs Slots, die binnen einer Minute verstummt sind', () => {
    const r = pruefeNeustart(
      [vor(35), vor(35, 10), vor(35, 25), vor(35, 40), vor(34, 50), vor(34, 30)],
      JETZT,
    )
    expect(r.verdacht).toBe(true)
    expect(r.spanneSekunden).toBeLessThanOrEqual(120)
    expect(r.stilleMinuten).toBe(35)
    expect(r.hinweis).toContain('PROZESS-NEUSTARTS')
    expect(r.hinweis).toContain('jobs_aufraeumen')
  })

  it('schweigt bei Jobs, die unabhaengig voneinander arbeiten', () => {
    // Auseinanderliegende Lebenszeichen = jeder Job hat seinen eigenen Takt.
    expect(pruefeNeustart([vor(30), vor(12), vor(2)], JETZT).verdacht).toBe(false)
  })

  it('schweigt, solange die Stille kurz ist — das kann ein langer Schritt sein', () => {
    expect(pruefeNeustart([vor(1), vor(1, 20)], JETZT).verdacht).toBe(false)
  })

  it('beweist nichts aus einem einzelnen stillen Job', () => {
    expect(pruefeNeustart([vor(45)], JETZT).verdacht).toBe(false)
    expect(pruefeNeustart([], JETZT).verdacht).toBe(false)
  })
})

describe('bauePoolSicht mit Neustart-Verdacht', () => {
  const zahlen = { slots: 6, laufend: 6, steckengeblieben: 0, schwelleMs: 30 * 60_000 }

  it('widerspricht dem „nichts zu tun ausser warten" — der Verdacht steht vorn', () => {
    const neustart = pruefeNeustart([vor(35), vor(35, 20)], JETZT)
    const sicht = bauePoolSicht(zahlen, 19, neustart)
    expect(sicht.hinweis?.startsWith('Alle 2 laufenden Jobs')).toBe(true)
    expect(sicht.hinweis).toContain('nichts zu tun ausser warten')
    expect(sicht.neustartVerdacht?.verdacht).toBe(true)
  })

  it('laesst die Sicht unveraendert, wenn kein Verdacht besteht', () => {
    const sicht = bauePoolSicht(zahlen, 19, pruefeNeustart([vor(30), vor(2)], JETZT))
    expect(sicht.neustartVerdacht).toBeUndefined()
    expect(sicht.hinweis).toContain('normal in der Schlange')
  })
})
