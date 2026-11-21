// @vitest-environment node
/**
 * Die Auffuehrung der Buehne hinter der Fragen-Sektion (Plan `commonux-buehne-fragen-sektion`,
 * 3.4 und P4), geprueft mit dem Buendel selbst: Leser, Masken, Uebersetzer, Farben.
 */
import { describe, it, expect } from 'vitest'
import {
  BLASS_DECKKRAFT,
  GESPRAECH_MASKEN_NAMEN,
  farbeFuerDokument,
  gespraechDarstellerId,
  gespraechMaskenAusSzene,
  readSceneFromJson,
  uebersetzeGespraech,
} from '@commonux/player'
import { gespraechAusStory } from '@ks/module-website'
import { GESPRAECH_AUFFUEHRUNG } from '@/components/library/website/buehne/gespraech-auffuehrung'
import { ankerFuerPlayer } from '@/components/library/website/buehne/buehne-anker'

/** Relative Leuchtdichte nach WCAG 2. */
function leuchtdichte(hex: string): number {
  const kanal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5)
}
function kontrast(a: string, b: string): number {
  const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x)
  return (hell + 0.05) / (dunkel + 0.05)
}
/** `farbe` mit `deckkraft` ueber Weiss. */
function ueberWeiss(farbe: string, deckkraft: number): string {
  const kanal = (i: number) => Math.round(parseInt(farbe.slice(i, i + 2), 16) * deckkraft + 255 * (1 - deckkraft)).toString(16).padStart(2, '0')
  return `#${kanal(1)}${kanal(3)}${kanal(5)}`
}

const DOKUMENTE = Array.from({ length: 400 }, (_, i) => `dokument-${i}`)

describe('Auffuehrung der Fragen-Sektion', () => {
  it('liest sich mit dem Leser des Buendels: eine leere Buehne', () => {
    const doc = readSceneFromJson(GESPRAECH_AUFFUEHRUNG)
    expect(doc.application.pages.map((p) => p.id)).toEqual(['v_gespraech'])
  })

  it('traegt alle acht Masken des Gespraechs', () => {
    expect(Object.keys(GESPRAECH_AUFFUEHRUNG.application.styles).sort()).toEqual(Object.values(GESPRAECH_MASKEN_NAMEN).sort())
    expect(gespraechMaskenAusSzene(GESPRAECH_AUFFUEHRUNG)).toMatchObject({ ok: true })
  })

  it('aus einer Antwort der Sektion werden Darsteller: Frage, Blatt, je Beleg ein Kreis mit seiner Nummer, je Anschlussfrage einer', () => {
    const masken = gespraechMaskenAusSzene(GESPRAECH_AUFFUEHRUNG)
    if (!masken.ok) throw new Error(`Masken fehlen: ${masken.fehlend.join(', ')}`)
    const { gespraech } = gespraechAusStory({
      paare: [{
        frage: { text: 'Wie beginnt es?' },
        antwort: { text: 'So [3] und so [11].', belege: [{ number: 3, fileId: 'dok-a', description: 'a' }, { number: 11, fileId: 'dok-b', description: 'b' }], anschlussfragen: ['Und dann?'] },
      }],
      laeuft: false, schritte: [], fehler: false, lesen: true,
    })
    if (!gespraech) throw new Error('kein Gespraech')
    const darsteller = uebersetzeGespraech(gespraech, masken.masken)
    const nachId = new Map(darsteller.map((d) => [d.id, d]))
    expect(darsteller).toHaveLength(5)
    // Die Nummer hinter dem Kreis ist die der Marke im Text (1, 2), nicht die der Antwort (3, 11).
    expect(nachId.get(gespraechDarstellerId('beleg', 'dok-a'))?.props.backgroundSign).toBe('1')
    expect(nachId.get(gespraechDarstellerId('beleg', 'dok-b'))?.props.backgroundSign).toBe('2')
    expect(nachId.get(gespraechDarstellerId('beleg', 'dok-a'))?.props.materialColor).toBe(farbeFuerDokument('dok-a'))
  })

  it('die Anker der Sektion zeigen auf die Darsteller der Belege', () => {
    expect(ankerFuerPlayer([{ belegId: 'dok-a', marken: [{ key: '1-0', x: 10, y: 20 }] }])).toEqual([
      { id: gespraechDarstellerId('beleg', 'dok-a'), marken: [{ key: '1-0', x: 10, y: 20 }] },
    ])
  })
})

describe('Kontrast ueber der Buehne (WCAG AA, 4,5 : 1)', () => {
  const SCHRIFT_DER_KARTE = '#171717' // neutral-900
  const SCHRIFT_DER_MARKE = '#16161d'

  it('die Schrift der Karte bleibt ueber jedem blassen Belegkreis lesbar', () => {
    const schwaechster = Math.min(...DOKUMENTE.map((d) => kontrast(SCHRIFT_DER_KARTE, ueberWeiss(farbeFuerDokument(d), BLASS_DECKKRAFT))))
    expect(schwaechster).toBeGreaterThanOrEqual(4.5)
  })

  it('die Schrift auf der Zitatmarke bleibt lesbar: Die Marke ist im Ton des Belegs gefuellt, so blass wie sein Kreis', () => {
    const schwaechster = Math.min(...DOKUMENTE.map((d) => kontrast(SCHRIFT_DER_MARKE, ueberWeiss(farbeFuerDokument(d), 0.3))))
    expect(schwaechster).toBeGreaterThanOrEqual(4.5)
  })

  it('voll gefuellt waere sie es nicht — deshalb der Ton (Befund 21.11.2026)', () => {
    const schwaechster = Math.min(...DOKUMENTE.map((d) => kontrast(SCHRIFT_DER_MARKE, farbeFuerDokument(d))))
    expect(schwaechster).toBeLessThan(4.5)
  })
})
