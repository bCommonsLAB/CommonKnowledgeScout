// @vitest-environment jsdom

/** G5: Mitreden-Band — nur mit Überschrift und Ziel, Knopf mit Vorgabe-Text. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MitredenBand } from '@ks/module-explorer/gallery/components/mitreden-band'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'defaultValue' in opts ? String(opts.defaultValue) : key),
    locale: 'de',
  }),
}))

describe('MitredenBand', () => {
  afterEach(() => cleanup())

  it('zeigt Überschrift, Zeile und Link mit eigenem Knopftext', () => {
    render(<MitredenBand texte={{ headline: 'Wer kommentiert, ist Expertin', text: 'Deine Erfahrung hilft.', buttonLabel: 'Jetzt mitreden', href: 'https://example.org/mitreden' }} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Wer kommentiert, ist Expertin')
    expect(screen.getByText('Deine Erfahrung hilft.')).toBeTruthy()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://example.org/mitreden')
    expect(link.textContent).toContain('Jetzt mitreden')
  })

  it('ohne Knopftext „Mitreden"; ohne Überschrift oder Ziel kein Band', () => {
    render(<MitredenBand texte={{ headline: 'H', href: '/x' }} />)
    expect(screen.getByRole('link').textContent).toContain('Mitreden')
    cleanup()
    expect(render(<MitredenBand texte={{ headline: 'H', href: ' ' }} />).container.innerHTML).toBe('')
    cleanup()
    expect(render(<MitredenBand texte={{ text: 'nur Zeile', href: '/x' }} />).container.innerHTML).toBe('')
    cleanup()
    expect(render(<MitredenBand />).container.innerHTML).toBe('')
  })
})
