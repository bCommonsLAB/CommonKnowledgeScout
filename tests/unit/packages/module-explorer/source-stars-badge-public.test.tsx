// @vitest-environment jsdom

/**
 * Welle F2 (ADR 0012): Sterne-Badge fuer Besucher — nur die Zahl, lesend,
 * ohne Knopf und ohne Namen; ohne Schalter nichts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SourceStarsBadge } from '@ks/module-explorer/gallery/components/source-stars-badge'

let mockIsMember = false
let mockStarCountsPublic = false

vi.mock('@ks/module-explorer/gallery/hooks/use-star-counts-public', () => ({
  useSterneSichtbar: () => ({
    isMember: mockIsMember,
    starCountsPublic: mockStarCountsPublic,
    sterneSichtbar: mockIsMember || mockStarCountsPublic,
  }),
}))
vi.mock('@ks/module-explorer/gallery/hooks/use-user-states', () => ({
  useUserStates: () => ({ setState: vi.fn() }),
}))
vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts || !('defaultValue' in opts)) return key
      return String(opts.defaultValue).replace('{count}', String(opts.count ?? ''))
    },
    locale: 'de',
  }),
}))

const voters = [{ email: 'a@b.c', name: 'Geheimer Name' }]

describe('SourceStarsBadge fuer Besucher', () => {
  afterEach(() => {
    cleanup()
    mockIsMember = false
    mockStarCountsPublic = false
  })

  it('ohne Schalter: nichts', () => {
    const { container } = render(
      <SourceStarsBadge libraryId="lib-1" fileId="f1" isFavorite={false} favoriteCount={3} favoriteVoters={voters} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('mit Schalter: Zahl lesend, kein Knopf, keine Namen', () => {
    mockStarCountsPublic = true
    const { container } = render(
      <SourceStarsBadge libraryId="lib-1" fileId="f1" isFavorite={false} favoriteCount={3} favoriteVoters={voters} />,
    )
    expect(screen.getByLabelText('3 Sterne')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.innerHTML).not.toContain('Geheimer Name')
  })

  it('mit Schalter, aber 0 Sterne: nichts', () => {
    mockStarCountsPublic = true
    const { container } = render(
      <SourceStarsBadge libraryId="lib-1" fileId="f1" isFavorite={false} favoriteCount={0} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('Mitglied: Knopf zum Bewerten bleibt', () => {
    mockIsMember = true
    render(<SourceStarsBadge libraryId="lib-1" fileId="f1" isFavorite={false} favoriteCount={1} favoriteVoters={voters} />)
    expect(screen.getByRole('button')).toBeTruthy()
  })
})
