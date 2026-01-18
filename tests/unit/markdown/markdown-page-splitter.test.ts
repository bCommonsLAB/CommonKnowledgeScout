import { describe, expect, it } from 'vitest'
import { splitMarkdownByPageMarkers } from '@/lib/markdown/markdown-page-splitter'

describe('splitMarkdownByPageMarkers', () => {
  it('splits markdown by explicit page markers', () => {
    const markdown = [
      '---',
      'title: Test',
      '---',
      '--- Seite 1 ---',
      'Erste Seite',
      '',
      '--- Seite 2 ---',
      'Zweite Seite',
      '',
    ].join('\n')

    // Erwartung: zwei Seiten, korrekte Nummern und Inhalte.
    const result = splitMarkdownByPageMarkers(markdown)
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0].pageNumber).toBe(1)
    expect(result.pages[0].content).toContain('Erste Seite')
    expect(result.pages[1].pageNumber).toBe(2)
    expect(result.pages[1].content).toContain('Zweite Seite')
  })

  it('returns empty result when no markers exist', () => {
    const markdown = 'Ohne Marker\nNur Text'
    const result = splitMarkdownByPageMarkers(markdown)
    expect(result.pages).toHaveLength(0)
    expect(result.markerCount).toBe(0)
  })
})
