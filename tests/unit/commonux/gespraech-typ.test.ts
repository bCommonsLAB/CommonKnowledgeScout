// @vitest-environment node
/**
 * Abgleich der Typen (Plan `commonux-buehne-fragen-sektion`, 3.1): `@ks/module-website`
 * importiert den Player nicht und fuehrt das Gespraech als eigenen Typ. Aendert der Player
 * `Gespraech`, bricht hier `tsc` — und der Uebersetzer des Buendels nimmt das Ergebnis an.
 */
import { describe, it, expect } from 'vitest'
import { folgefrageId, gespraechDarstellerId, type Gespraech } from '@commonux/player/format'
import { gespraechAusStory, gespraechFrageId, type WebsiteGespraech } from '@ks/module-website'

/** Zuweisung ohne Umweg: Jedes Gespraech der Website ist ein Gespraech des Players. */
function alsGespraechDesPlayers(g: WebsiteGespraech): Gespraech {
  return g
}

describe('Gespraech der Website ↔ Gespraech des Players', () => {
  const { gespraech } = gespraechAusStory({
    paare: [{ frage: { text: 'Wie beginnt es?' }, antwort: { text: 'So [1].', belege: [{ number: 1, fileId: 'dok-a', description: 'x' }], anschlussfragen: ['Und dann?'] } }],
    laeuft: false,
    schritte: [],
    fehler: false,
    lesen: true,
  })

  it('das Ergebnis ist ein Gespraech des Players', () => {
    expect(gespraech).not.toBeNull()
    if (!gespraech) return
    expect(alsGespraechDesPlayers(gespraech).stand).toBe('fertig')
  })

  it('der Player nimmt die ID der Anschlussfrage, wie die Website sie setzt: Frage und Folgefrage treffen sich', () => {
    if (!gespraech) throw new Error('kein Gespraech')
    const folge = alsGespraechDesPlayers(gespraech).folgefragen[0]
    expect(folgefrageId(folge)).toBe(gespraechFrageId('Und dann?'))
    // Wird sie gestellt, entsteht die Frage an der Stelle dieser Folgefrage.
    expect(gespraechDarstellerId('folgefrage', folgefrageId(folge))).toBe(gespraechDarstellerId('folgefrage', gespraechFrageId('Und dann?')))
  })
})
