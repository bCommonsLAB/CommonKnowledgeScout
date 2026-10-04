// @vitest-environment jsdom

/**
 * Quellen-Blatt der schmalen Ansicht (D12m): zeigt dieselben Listen wie die
 * Spalte am Desktop — Quellenliste fuer die Uebersicht, Belegliste fuer eine
 * Antwort; das X schliesst das Blatt, der Katalog-Weg schliesst und bittet
 * um die Uebersicht.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { GalleryNavigationProvider, type GalleryNavigation } from '@ks/module-explorer/react'
import { ReferencesSheet } from '../../../../packages/module-explorer/src/gallery/components/references-sheet'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

afterEach(cleanup)

const docs: DocCardMeta[] = [{ id: 'f-a', fileId: 'f-a', title: 'Radwege ausbauen', slug: 'radwege' }]
const references: DocReference[] = [{ number: 1, fileId: 'f-a', title: 'Radwege ausbauen', description: 'd', passages: [{ excerpt: 'x' }] }]

function montieren(props: Partial<React.ComponentProps<typeof ReferencesSheet>>) {
  const navigation: GalleryNavigation = {
    openDocument: vi.fn(),
    closeDocument: vi.fn(),
    documentShareUrl: () => '',
    params: new URLSearchParams(),
    replaceParams: vi.fn(),
    pushParams: vi.fn(),
    applyModeParams: vi.fn(),
  }
  const onOpenChange = vi.fn()
  const onKatalog = vi.fn()
  render(
    <GalleryNavigationProvider navigation={navigation}>
      <ReferencesSheet open onOpenChange={onOpenChange} libraryId="lib" mode="toc" onKatalog={onKatalog} {...props} />
    </GalleryNavigationProvider>,
  )
  return { onOpenChange, onKatalog }
}

describe('ReferencesSheet (D12m)', () => {
  it('Uebersicht: die Quellenliste mit Zaehler und Filter-Slot; X schliesst', () => {
    const { onOpenChange } = montieren({ mode: 'toc', docs, anzahl: 606, filterAnzeige: <span>chips</span> })
    expect(screen.getByText('606 gallery.sources')).toBeTruthy()
    expect(screen.getByText('chips')).toBeTruthy()
    expect(screen.getByText('Radwege ausbauen')).toBeTruthy()
    expect(document.querySelector('[data-quellen-liste]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'story.beleg.close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Antwort: die Belegliste mit Marke; Katalog schliesst und bittet um die Uebersicht', () => {
    const { onOpenChange, onKatalog } = montieren({ mode: 'answer', references, usedDocs: docs, anzahl: 606 })
    expect(document.querySelector('[data-beleg-liste]')).not.toBeNull()
    expect(document.getElementById('beleg-1')).not.toBeNull()
    expect(screen.getByText('story.beleg.count.one')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'story.beleg.catalog:606' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onKatalog).toHaveBeenCalledTimes(1)
  })
})
