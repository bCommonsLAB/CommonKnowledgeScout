// @vitest-environment jsdom

/**
 * Characterization Tests fuer `DetailViewRenderer` (Welle 3-II, Schritt 3).
 *
 * Fixiert den **Switch-Vertrag**: anhand `detailViewType` wird die
 * jeweils passende `*-Detail`-Komponente gerendert. Ohne diesen Test
 * koennten Sub-Wellen 3-II-c und 3-II-d unbemerkt einen ViewType
 * "verlieren" (siehe `detail-view-type-checklist.mdc` Punkt 6).
 *
 * Alle Sub-Komponenten sind gemockt — der Test prueft NUR den Switch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DetailViewRenderer } from '@/components/library/detail-view-renderer'

vi.mock('@/components/library/book-detail', () => ({
  BookDetail: () => <div data-testid="book-detail-mock" />,
}))
vi.mock('@/components/library/session-detail', () => ({
  SessionDetail: () => <div data-testid="session-detail-mock" />,
}))
vi.mock('@/components/library/testimonial-detail', () => ({
  TestimonialDetail: () => <div data-testid="testimonial-detail-mock" />,
}))
vi.mock('@/components/library/climate-action-detail', () => ({
  ClimateActionDetail: () => <div data-testid="climate-action-detail-mock" />,
}))
vi.mock('@/components/library/diva-document-detail', () => ({
  DivaDocumentDetail: () => <div data-testid="diva-document-detail-mock" />,
}))
vi.mock('@/components/library/diva-texture-detail', () => ({
  DivaTextureDetail: () => <div data-testid="diva-texture-detail-mock" />,
}))

describe('DetailViewRenderer (Switch-Vertrag)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert BookDetail bei detailViewType="book"', () => {
    render(<DetailViewRenderer detailViewType="book" metadata={{ title: 't' }} />)
    expect(screen.getByTestId('book-detail-mock')).toBeTruthy()
  })

  it('rendert TestimonialDetail bei detailViewType="testimonial"', () => {
    render(
      <DetailViewRenderer
        detailViewType="testimonial"
        metadata={{ title: 't', author_name: 'a' }}
      />
    )
    expect(screen.getByTestId('testimonial-detail-mock')).toBeTruthy()
  })

  it('rendert ClimateActionDetail bei detailViewType="climateAction"', () => {
    render(
      <DetailViewRenderer
        detailViewType="climateAction"
        metadata={{ title: 't', category: 'energy' }}
      />
    )
    expect(screen.getByTestId('climate-action-detail-mock')).toBeTruthy()
  })

  it('rendert DivaDocumentDetail bei detailViewType="divaDocument"', () => {
    render(
      <DetailViewRenderer
        detailViewType="divaDocument"
        metadata={{
          title: 't',
          dokumentTyp: 'Preisliste',
          produktname: 'Stoff',
          lieferant: 'X',
        }}
      />
    )
    expect(screen.getByTestId('diva-document-detail-mock')).toBeTruthy()
  })

  it('rendert SessionDetail als Default bei unbekanntem Typ', () => {
    render(
      <DetailViewRenderer
        detailViewType={'unknown' as never}
        metadata={{ title: 't' }}
      />
    )
    expect(screen.getByTestId('session-detail-mock')).toBeTruthy()
  })

  it('rendert SessionDetail explizit bei detailViewType="session"', () => {
    render(<DetailViewRenderer detailViewType="session" metadata={{ title: 't' }} />)
    expect(screen.getByTestId('session-detail-mock')).toBeTruthy()
  })
})
