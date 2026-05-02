// @vitest-environment jsdom

/**
 * Characterization Tests fuer `ItemsGrid` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-a. Fixiert:
 * - Render-Smoke mit Items-Mock pro Gruppe
 * - Gruppen-Header werden angezeigt, wenn groupByField !== 'none'
 * - Bei groupByField='none' werden keine Header gerendert
 * - DocumentCard wird pro Item gerendert (Mock)
 *
 * DocumentCard wird gemockt, weil sie 638 Zeilen hat und nicht
 * zentral fuer den ItemsGrid-Vertrag ist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ItemsGrid } from '@/components/library/gallery/items-grid'
import type { DocCardMeta } from '@/lib/gallery/types'

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'year' in opts) return `${key}:${String(opts.year)}`
      return key
    },
  }),
}))

vi.mock('@/components/library/gallery/document-card', () => ({
  DocumentCard: ({ doc }: { doc: DocCardMeta }) => (
    <div data-testid="document-card-mock" data-id={doc.id}>{doc.title || doc.fileName}</div>
  ),
}))

function makeDoc(id: string, title: string): DocCardMeta {
  return {
    id,
    title,
    fileName: title,
  } as DocCardMeta
}

describe('ItemsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert nichts, wenn docsByYear leer ist', () => {
    const { container } = render(<ItemsGrid docsByYear={[]} />)
    // Aeusseres div + keine Children
    expect(container.querySelectorAll('[data-testid="document-card-mock"]').length).toBe(0)
  })

  it('rendert Gruppen-Header bei groupByField="year" (Default)', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      [2023, [makeDoc('a', 'Doc A')]],
      [2024, [makeDoc('b', 'Doc B')]],
    ]
    render(<ItemsGrid docsByYear={docs} />)
    expect(screen.getByText('gallery.year:2023')).toBeTruthy()
    expect(screen.getByText('gallery.year:2024')).toBeTruthy()
  })

  it('rendert NoYear-Label fuer "Ohne Jahrgang"-Gruppe', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      ['Ohne Jahrgang', [makeDoc('x', 'Doc X')]],
    ]
    render(<ItemsGrid docsByYear={docs} />)
    expect(screen.getByText('gallery.noYear')).toBeTruthy()
  })

  it('rendert Gruppen-Schluessel als String bei groupByField="category"', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      ['Politik', [makeDoc('a', 'Doc A')]],
      ['Wissenschaft', [makeDoc('b', 'Doc B')]],
    ]
    render(<ItemsGrid docsByYear={docs} groupByField="category" />)
    expect(screen.getByText('Politik')).toBeTruthy()
    expect(screen.getByText('Wissenschaft')).toBeTruthy()
  })

  it('rendert KEINE Gruppen-Header bei groupByField="none"', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      [2023, [makeDoc('a', 'Doc A')]],
    ]
    render(<ItemsGrid docsByYear={docs} groupByField="none" />)
    // Kein Header sichtbar — nur das DocumentCard-Mock
    expect(screen.queryByText('gallery.year:2023')).toBeNull()
    expect(screen.getByTestId('document-card-mock')).toBeTruthy()
  })

  it('rendert pro Document ein DocumentCard-Mock', () => {
    const docs: Array<[number | string, DocCardMeta[]]> = [
      [2023, [makeDoc('a', 'Doc A'), makeDoc('b', 'Doc B'), makeDoc('c', 'Doc C')]],
    ]
    render(<ItemsGrid docsByYear={docs} />)
    const cards = screen.getAllByTestId('document-card-mock')
    expect(cards).toHaveLength(3)
    expect(cards[0].getAttribute('data-id')).toBe('a')
    expect(cards[2].getAttribute('data-id')).toBe('c')
  })
})
