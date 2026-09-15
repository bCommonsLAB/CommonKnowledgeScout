/**
 * Platzhalter-Karten fuer den ungeladenen Rest der Galerie (2026-09-15).
 *
 * Fixiert die reine Zaehl-Logik: Wie viele Platzhalter stehen hinter den
 * geladenen Karten, und wann keine.
 */

import { describe, it, expect } from 'vitest'
import {
  MAX_PLACEHOLDER_CARDS,
  placeholderCardCount,
  placeholderShapeClass,
} from '@ks/module-explorer/gallery/components/items-grid-placeholders'

describe('placeholderCardCount', () => {
  it('liefert die Restzahl, wenn Gesamtzahl bekannt und noch Seiten kommen', () => {
    expect(placeholderCardCount({ totalCount: 200, loadedCount: 50, hasMore: true })).toBe(150)
  })

  it('liefert 0, wenn keine weiteren Seiten kommen', () => {
    expect(placeholderCardCount({ totalCount: 606, loadedCount: 50, hasMore: false })).toBe(0)
  })

  it('liefert 0, wenn die Gesamtzahl unbekannt ist (clientseitige Filter)', () => {
    expect(placeholderCardCount({ totalCount: undefined, loadedCount: 50, hasMore: true })).toBe(0)
    expect(placeholderCardCount({ totalCount: Number.NaN, loadedCount: 50, hasMore: true })).toBe(0)
  })

  it('liefert 0, wenn schon alles geladen ist, auch wenn hasMore noch true meldet', () => {
    // Flacher Modus: hasMore = "letzte Seite war voll" — bei 100 Docs und
    // Seitengroesse 50 meldet die zweite Seite noch hasMore=true.
    expect(placeholderCardCount({ totalCount: 100, loadedCount: 100, hasMore: true })).toBe(0)
    expect(placeholderCardCount({ totalCount: 100, loadedCount: 120, hasMore: true })).toBe(0)
  })

  it('deckelt sehr grosse Restzahlen', () => {
    expect(placeholderCardCount({ totalCount: 10_000, loadedCount: 50, hasMore: true })).toBe(
      MAX_PLACEHOLDER_CARDS,
    )
  })
})

describe('placeholderShapeClass', () => {
  it('spiegelt die Seitenverhaeltnisse der Karten', () => {
    expect(placeholderShapeClass('climateAction')).toContain('aspect-[4/3]')
    expect(placeholderShapeClass('refurbedDevice')).toContain('aspect-[4/3]')
    expect(placeholderShapeClass('session')).toContain('aspect-[16/9]')
    expect(placeholderShapeClass('divaTexture')).toContain('aspect-square')
  })

  it('nutzt fuer alle uebrigen Typen die Form der Standard-Karte', () => {
    expect(placeholderShapeClass('book')).toContain('min-h-')
    expect(placeholderShapeClass(undefined)).toContain('min-h-')
  })
})
