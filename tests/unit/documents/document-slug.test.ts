import { describe, expect, it } from 'vitest'
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug'

describe('buildDocumentSlugFallback', () => {
  it('erzeugt stabilen Slug aus Artefaktnamen', () => {
    expect(buildDocumentSlugFallback('sammel-transkript_2026-03-22T21-14-50_de.off-aktionsbericht-de.de.md'))
      .toBe('sammel-transkript-2026-03-22t21-14-50-de-off-aktionsbericht-de-de')
  })

  it('fällt auf spätere Kandidaten zurück', () => {
    expect(buildDocumentSlugFallback('', undefined, 'Aktion Wasser'))
      .toBe('aktion-wasser')
  })

  it('verhindert führende Ziffern', () => {
    expect(buildDocumentSlugFallback('2025.md')).toBe('doc-2025')
  })
})
