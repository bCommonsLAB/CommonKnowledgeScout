/**
 * Gemeinsame Breite der Website-Sektionen (Owner 24.11.2026): Kopf, Sektionen,
 * Fragebox, Raster, Fusszeile und Detail fluchten an EINER linken Kante. Die
 * Breite steht in `SECTION_WIDTH` (`surface-style.ts`); kein Baustein setzt
 * daneben eine eigene Sektionsbreite.
 *
 * Ausnahme: der Kopf `band` — sein Text steht mittig, er hat keine linke Kante.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SECTION_WIDTH, SECTION_READING_WIDTH } from '../../../../packages/module-website/src/surface-style'

const REACT = join(process.cwd(), 'packages/module-website/src/react')
/** Eigene Sektionsbreite: eine grosse `max-w-*`-Stufe oder ein mittig gesetzter Behaelter. */
const EIGENE_BREITE = /max-w-[4-7]xl|mx-auto\s+max-w-|max-w-\S+\s+mx-auto/
const AUSNAHMEN = new Set(['hero-band.tsx'])

describe('Sektionsbreite der Website', () => {
  it('die Konstante gibt Breite und Kante vor, die Lesebreite bleibt links', () => {
    expect(SECTION_WIDTH).toContain('mx-auto')
    expect(SECTION_WIDTH).toContain('max-w-5xl')
    expect(SECTION_READING_WIDTH).not.toContain('mx-auto')
  })

  it('kein Baustein setzt eine eigene Sektionsbreite', () => {
    const treffer = readdirSync(REACT)
      .filter((name) => name.endsWith('.tsx') && !AUSNAHMEN.has(name))
      .flatMap((name) =>
        readFileSync(join(REACT, name), 'utf8')
          .split('\n')
          .map((zeile, i) => ({ ort: `${name}:${i + 1}`, zeile }))
          .filter(({ zeile }) => EIGENE_BREITE.test(zeile))
          .map(({ ort }) => ort),
      )
    expect(treffer).toEqual([])
  })
})
