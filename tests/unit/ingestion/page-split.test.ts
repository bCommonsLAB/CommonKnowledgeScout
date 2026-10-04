/**
 * Char-Tests fuer pure Helper aus `src/lib/ingestion/page-split.ts`.
 *
 * Welle 3, Schritt 3: Festschreibung des aktuellen Verhaltens
 * (Markdown-Seiten-Span-Aufloesung anhand `--- Seite N ---`-Marker).
 *
 * Vertrag (siehe `.cursor/rules/ingestion-contracts.mdc` §1, §4):
 * - Pure Funktion, deterministisch.
 * - Liefert leeres Array bei Input ohne Marker (kein Wurf).
 */

import { describe, expect, it } from 'vitest'
import { splitByPages, type PageSpan } from '@/lib/ingestion/page-split'

describe('splitByPages — Markdown ohne Marker', () => {
  it('liefert leeres Array bei leerem Markdown', () => {
    expect(splitByPages('')).toEqual([])
  })

  it('liefert leeres Array bei Text ohne Marker', () => {
    const md = 'Nur normaler Text\nMit Zeilenumbruch\nKeine Marker'
    expect(splitByPages(md)).toEqual([])
  })

  it('liefert leeres Array, wenn die Marker-Zeile nicht alleine steht', () => {
    // Marker mit vorangehendem Text in derselben Zeile darf NICHT matchen
    // (Regex hat ^ und $ mit /m-Flag).
    const md = 'Text vor --- Seite 1 --- mehr Text'
    expect(splitByPages(md)).toEqual([])
  })
})

describe('splitByPages — einzelner Marker', () => {
  it('liefert eine Span fuer ein Dokument mit einem einzigen Marker', () => {
    const md = ['--- Seite 1 ---', 'Inhalt der Seite eins'].join('\n')
    const spans = splitByPages(md)

    expect(spans).toHaveLength(1)
    expect(spans[0].page).toBe(1)
    // Inhalt beginnt nach der Markerzeile (also nach erstem '\n')
    expect(md.slice(spans[0].startIdx, spans[0].endIdx)).toContain('Inhalt der Seite eins')
  })

  it('endIdx der letzten Span ist `markdown.length`', () => {
    const md = '--- Seite 7 ---\nText'
    const spans = splitByPages(md)

    expect(spans).toHaveLength(1)
    expect(spans[0].endIdx).toBe(md.length)
  })
})

describe('splitByPages — mehrere Marker', () => {
  it('liefert eine Span pro Marker, in Reihenfolge', () => {
    const md = [
      '--- Seite 1 ---',
      'Erste Seite',
      '--- Seite 2 ---',
      'Zweite Seite',
      '--- Seite 3 ---',
      'Dritte Seite',
    ].join('\n')

    const spans = splitByPages(md)
    expect(spans.map((s: PageSpan) => s.page)).toEqual([1, 2, 3])
  })

  it('Spans sind disjunkt: endIdx[i] === naechster anchorStart[i+1]', () => {
    const md = [
      '--- Seite 1 ---',
      'A',
      '--- Seite 2 ---',
      'B',
    ].join('\n')

    const spans = splitByPages(md)
    expect(spans).toHaveLength(2)

    // Span 1 endet, wo Marker fuer Seite 2 beginnt
    const seite2MarkerStart = md.indexOf('--- Seite 2 ---')
    expect(spans[0].endIdx).toBe(seite2MarkerStart)
    expect(md.slice(spans[0].startIdx, spans[0].endIdx).trim()).toBe('A')
    expect(md.slice(spans[1].startIdx, spans[1].endIdx).trim()).toBe('B')
  })

  it('akzeptiert Whitespace-Varianten im Marker', () => {
    // Regex erlaubt \s* zwischen "---", "Seite", Zahl und "---"
    const md = [
      '---  Seite  1  ---',
      'Inhalt eins',
      '---Seite 2---',
      'Inhalt zwei',
    ].join('\n')

    const spans = splitByPages(md)
    expect(spans).toHaveLength(2)
    expect(spans[0].page).toBe(1)
    expect(spans[1].page).toBe(2)
  })

  it('uebernimmt die Page-Nummer direkt aus dem Marker (keine Sortierung/Lueckenfuellung)', () => {
    // Reihenfolge im Dokument bestimmt Reihenfolge im Result; Page-Nummer
    // ist Roh-Wert aus dem Marker.
    const md = [
      '--- Seite 5 ---',
      'A',
      '--- Seite 2 ---',
      'B',
    ].join('\n')

    const spans = splitByPages(md)
    expect(spans.map((s) => s.page)).toEqual([5, 2])
  })
})

describe('seiteFuerOffset — Seite je Zeichen-Offset (D7)', async () => {
  const { seiteFuerOffset } = await import('@/lib/ingestion/page-split')
  const md = 'Praefix\n--- Seite 1 ---\nEins\n--- Seite 2 ---\nZwei\n--- Seite 3 ---\nDrei'
  const spans = splitByPages(md)

  it('liefert die Seite der Spanne, Ankerzeilen gehoeren zur folgenden Seite', () => {
    expect(seiteFuerOffset(spans, md.indexOf('Eins'))).toBe(1)
    expect(seiteFuerOffset(spans, md.indexOf('Zwei'))).toBe(2)
    expect(seiteFuerOffset(spans, md.indexOf('--- Seite 3'))).toBe(3)
    expect(seiteFuerOffset(spans, md.length - 1)).toBe(3)
  })

  it('vor dem ersten Anker und ohne Spannen keine Seite', () => {
    expect(seiteFuerOffset(spans, 0)).toBeUndefined()
    expect(seiteFuerOffset([], 5)).toBeUndefined()
  })
})
