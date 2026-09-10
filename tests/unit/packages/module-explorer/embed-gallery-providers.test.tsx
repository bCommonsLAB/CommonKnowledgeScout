// @vitest-environment jsdom

/**
 * Beweis M5, Schritt Embed-Adressierung: Die Galerie laeuft mit den drei
 * Embed-Antworten — anonymer Betrachter, stiller Gastgeber mit zentraler
 * Instanz, Adressierung im Speicher — ohne Next-Router und ohne Clerk.
 *
 * Hier gibt es weder `next/navigation` noch einen Auth-Anbieter; die Karte
 * und der Teilen-Knopf sind die echten Komponenten aus dem Paket.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstanceApi } from '@ks/api-client'
import {
  DocumentCard,
  EmbedGalleryProviders,
  useGalleryHost,
  useGalleryNavigation,
  useGalleryViewer,
} from '@ks/module-explorer/react'
import { DocumentShareButton } from '@ks/module-explorer/gallery/components/document-share-button'
import type { DocCardMeta } from '@ks/module-explorer/gallery/lib/types'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
    locale: 'de',
  }),
}))

// Die Abzeichen haben eigene Tests; hier geht es um die Anbieter.
vi.mock('@ks/module-explorer/gallery/components/speaker-icons', () => ({
  SpeakerOrAuthorIcons: () => null,
}))
vi.mock('@ks/module-explorer/gallery/components/source-stars-badge', () => ({
  SourceStarsBadge: () => null,
}))
vi.mock('@ks/module-explorer/gallery/components/source-comments-badge', () => ({
  SourceCommentsBadge: () => null,
}))

const instanz = createInstanceApi({ baseUrl: 'https://knowledgescout.org' })

const buch = {
  id: 'doc-1',
  fileId: 'file-1',
  title: 'Ein Buch',
  fileName: 'ein-buch.md',
} as DocCardMeta

/** Zeigt, was die Galerie ueber ihre drei Kontexte sieht. */
function Sonde() {
  const { params } = useGalleryNavigation()
  const { isSignedIn } = useGalleryViewer()
  const { instanz: hostInstanz } = useGalleryHost()
  return <output data-testid="sonde">{`${params.toString()}|${String(isSignedIn)}|${hostInstanz.baseUrl}`}</output>
}

afterEach(() => {
  cleanup()
})

describe('EmbedGalleryProviders', () => {
  it('beantwortet die drei Fragen der Galerie: anonym, zentrale Instanz, Speicher', () => {
    render(
      <EmbedGalleryProviders instanz={instanz} initialParams="view=gallery">
        <Sonde />
      </EmbedGalleryProviders>,
    )

    expect(screen.getByTestId('sonde').textContent).toBe('view=gallery|false|https://knowledgescout.org')
  })

  it('eine Karte oeffnen setzt doc im Speicher, nicht in der Adresse der Seite', () => {
    const vorher = window.location.href
    render(
      <EmbedGalleryProviders instanz={instanz} initialParams="view=gallery">
        <DocumentCard doc={buch} libraryId="lib-aeced" />
        <Sonde />
      </EmbedGalleryProviders>,
    )

    fireEvent.click(screen.getByText('Ein Buch'))

    const [params] = (screen.getByTestId('sonde').textContent ?? '').split('|')
    const zustand = new URLSearchParams(params)
    expect(zustand.get('view')).toBe('gallery')
    expect(zustand.get('doc')).toBeTruthy()
    expect(window.location.href).toBe(vorher)
  })

  it('der Teilen-Knopf blendet sich aus — im Embed gibt es keine teilbare Adresse', () => {
    const { container } = render(
      <EmbedGalleryProviders instanz={instanz}>
        <DocumentShareButton doc={buch} />
      </EmbedGalleryProviders>,
    )

    expect(container.innerHTML).toBe('')
  })
})
