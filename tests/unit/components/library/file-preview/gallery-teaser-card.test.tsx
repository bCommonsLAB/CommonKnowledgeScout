// @vitest-environment jsdom

/**
 * Regressionstest fuer den Produktionsfehler nach #234.
 *
 * Adressierung Teil A hat `DocumentCard` den Router genommen: Sie sagt seit
 * dem nur noch `openDocument(slug)` an einen Anbieter und wirft ohne ihn —
 * absichtlich (no-silent-fallbacks). Die Welle hat die sechs Aufrufstellen IN
 * der Galerie umgestellt, aber zwei AUSSERHALB uebersehen: den Teaser im
 * Job-Report-Tab und die Root-Landingpage (`src/app/page.tsx`). Beide
 * rendern eine Galerie-Karte ohne den Galerie-Montagepunkt. oldiesforfuture.org
 * zeigte zehn Tage lang nur „Ein Fehler ist aufgetreten".
 *
 * Warum der Karten-Test das nicht sah: Er mockt den Kontext. Dieser Test
 * mockt ihn NICHT — nur `next/navigation`, damit der echte Anbieter laufen
 * kann.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DocumentCard } from '@ks/module-explorer/gallery/components/document-card'
import { GalleryTeaserCard } from '@/components/library/file-preview/gallery-teaser-card'
import type { DocCardMeta } from '@ks/module-explorer/gallery/lib/types'

const push = vi.fn()
const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/library',
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('next/image', () => ({
  default: (props: { src?: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}))

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
  }),
}))

vi.mock('@ks/module-explorer/gallery/lib/resolve-cover-url-client', () => ({
  coverRefNeedsApiResolution: () => false,
  resolveCoverUrlViaApi: vi.fn().mockResolvedValue(null),
}))

vi.mock('@ks/module-explorer/gallery/components/speaker-icons', () => ({
  SpeakerOrAuthorIcons: () => null,
}))
vi.mock('@ks/module-explorer/gallery/components/source-stars-badge', () => ({
  SourceStarsBadge: () => null,
}))
vi.mock('@ks/module-explorer/gallery/components/source-comments-badge', () => ({
  SourceCommentsBadge: () => null,
}))

const doc = {
  id: 'doc-1',
  fileId: 'file-1',
  title: 'Teaser-Dokument',
  fileName: 'teaser-dokument.md',
} as DocCardMeta

afterEach(() => {
  cleanup()
  push.mockClear()
  replace.mockClear()
})

describe('Galerie-Karte ausserhalb der Galerie', () => {
  it('eine nackte DocumentCard wirft ohne Anbieter — das ist der Fehler von #234', () => {
    // React meldet den Wurf zusaetzlich ueber console.error; hier stumm.
    const stillePost = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<DocumentCard doc={doc} />)).toThrow(/GalleryNavigationProvider/)
    } finally {
      stillePost.mockRestore()
    }
  })

  it('GalleryTeaserCard rendert die Karte, weil sie die Anbieter mitbringt', () => {
    render(<GalleryTeaserCard doc={doc} />)
    expect(screen.getByText('Teaser-Dokument')).toBeTruthy()
    // Nur gerendert, nicht navigiert: Der Teaser hat weder libraryId noch
    // onClick, ein Klick warnt (wie vor #234) — hier zaehlt das Rendern.
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })
})
