// @vitest-environment jsdom

/**
 * Characterization Tests fuer `TestimonialDetail` (Welle 3-II, Schritt 3).
 *
 * Fixiert das Render-Verhalten der `*-detail.tsx`-Familie am Beispiel
 * Testimonial. Wenn 3-II-d die Detail-Familie refactored, muss das
 * sichtbare Verhalten der Karte stabil bleiben.
 *
 * Sub-Komponenten (MarkdownPreview, AIGeneratedNotice) gemockt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TestimonialDetail } from '@/components/library/testimonial-detail'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/components/library/markdown-preview', () => ({
  MarkdownPreview: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="markdown-preview-mock">{children}</div>
  ),
}))

vi.mock('@/components/shared/ai-generated-notice', () => ({
  AIGeneratedNotice: () => <div data-testid="ai-notice-mock" />,
}))

describe('TestimonialDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert Default-Titel "Testimonial", wenn data.title fehlt', () => {
    render(<TestimonialDetail data={{}} />)
    // Titel taucht ueberall auf (Heading + Avatar-Alt etc.)
    expect(screen.getAllByText('Testimonial').length).toBeGreaterThan(0)
  })

  it('rendert eigenen Titel, wenn data.title gesetzt ist', () => {
    render(<TestimonialDetail data={{ title: 'Mein Erfahrungsbericht' }} />)
    expect(screen.getAllByText('Mein Erfahrungsbericht').length).toBeGreaterThan(0)
  })

  it('zeigt Back-Link nur, wenn showBackLink=true', () => {
    const { unmount, container: c1 } = render(<TestimonialDetail data={{}} showBackLink={false} />)
    expect(c1.querySelector('a[href]')).toBeNull()
    unmount()

    const { container: c2 } = render(<TestimonialDetail data={{}} showBackLink={true} backHref="/back-target" />)
    const link = c2.querySelector('a[href]')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('/back-target')
  })

  it('zeigt Author-Name, wenn data.author_name gesetzt ist', () => {
    render(
      <TestimonialDetail data={{ author_name: 'Maria Mustermann', author_role: 'Co-Creator' }} />
    )
    expect(screen.getByText('Maria Mustermann')).toBeTruthy()
  })

  it('faellt auf author_nickname zurueck, wenn author_name fehlt', () => {
    render(
      <TestimonialDetail data={{ author_nickname: 'mariam', author_role: 'Beobachter' }} />
    )
    expect(screen.getByText('mariam')).toBeTruthy()
  })
})
