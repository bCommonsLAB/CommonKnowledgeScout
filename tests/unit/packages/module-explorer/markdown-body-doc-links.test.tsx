// @vitest-environment jsdom

/**
 * `?doc=<slug>`-Links in der Buch-Ansicht des Embeds (Anschlusskarten,
 * „passende Karten" der AECED-Vorlagen): Ein Klick oeffnet das Dokument ueber
 * die Adressierung der Galerie, nicht ueber die Adresszeile der fremden Seite.
 * Alles andere — fremde Adressen, Pfade, Klicks mit Zusatztaste — bleibt dem
 * Browser.
 */

import { describe, it, expect } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MarkdownBody } from '@ks/module-explorer/gallery/components/book-detail/markdown-body'
import { docSlugAusHref } from '@ks/module-explorer/gallery/lib/doc-link'
import { SpeicherGalleryNavigation } from '@ks/module-explorer/gallery/contexts/speicher-gallery-navigation'
import { useGalleryNavigation } from '@ks/module-explorer/gallery/contexts/gallery-navigation-context'

/** Zeigt, welches Dokument die Adressierung gerade fuehrt. */
function Sonde() {
  const { params } = useGalleryNavigation()
  return <output data-testid="doc">{params.get('doc') ?? ''}</output>
}

const INHALT = [
  '## Anschlusskarten',
  '',
  '- [Gemeinsame Absichten](?doc=gemeinsame-absichten-und-werte-kultivieren)',
  '- [Ohne Slug](?doc=)',
  '- [Instanz](https://knowledgescout.org/library/gallery?doc=fremd)',
  '- [Pfad](/library/gallery?doc=pfad)',
].join('\n')

function zeige() {
  return render(
    <SpeicherGalleryNavigation initialParams="view=gallery&doc=karte-01">
      <Sonde />
      <MarkdownBody content={INHALT} />
    </SpeicherGalleryNavigation>,
  )
}

afterEach(() => cleanup())

describe('docSlugAusHref', () => {
  it('liest den Slug nur aus Links, die mit ? beginnen und doc tragen', () => {
    expect(docSlugAusHref('?doc=karte-02')).toBe('karte-02')
    expect(docSlugAusHref('?view=gallery&doc=karte-02')).toBe('karte-02')
    expect(docSlugAusHref('?doc=')).toBeNull()
    expect(docSlugAusHref('?view=gallery')).toBeNull()
    expect(docSlugAusHref('/library/gallery?doc=karte-02')).toBeNull()
    expect(docSlugAusHref('https://knowledgescout.org/?doc=karte-02')).toBeNull()
    expect(docSlugAusHref('#seite-3')).toBeNull()
    expect(docSlugAusHref(null)).toBeNull()
  })
})

describe('MarkdownBody: ?doc=-Links', () => {
  it('ein Klick oeffnet das Dokument in der Galerie und laesst den Browser nicht navigieren', () => {
    zeige()
    const link = screen.getByText('Gemeinsame Absichten')
    expect(link.getAttribute('href')).toBe('?doc=gemeinsame-absichten-und-werte-kultivieren')

    const nichtVerhindert = fireEvent.click(link)

    expect(nichtVerhindert).toBe(false)
    expect(screen.getByTestId('doc').textContent).toBe('gemeinsame-absichten-und-werte-kultivieren')
  })

  it('fremde Adressen und Pfade bleiben dem Browser', () => {
    zeige()
    for (const text of ['Instanz', 'Pfad', 'Ohne Slug']) {
      const nichtVerhindert = fireEvent.click(screen.getByText(text))
      expect(nichtVerhindert, text).toBe(true)
    }
    expect(screen.getByTestId('doc').textContent).toBe('karte-01')
  })

  it('ein Klick mit Zusatztaste bleibt dem Browser', () => {
    zeige()
    const link = screen.getByText('Gemeinsame Absichten')
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true)
    expect(fireEvent.click(link, { metaKey: true })).toBe(true)
    expect(fireEvent.click(link, { button: 1 })).toBe(true)
    expect(screen.getByTestId('doc').textContent).toBe('karte-01')
  })
})
