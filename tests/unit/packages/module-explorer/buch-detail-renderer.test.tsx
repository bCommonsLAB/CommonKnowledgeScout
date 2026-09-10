// @vitest-environment jsdom

/**
 * Beweis M5, Schritt Buch-Renderer: Das Embed zeigt ein Buch aus dem, was die
 * Detailansicht der Galerie schon geladen hat (`docMeta`) — mit den Mitteln
 * des Pakets: schlichtes `<img>` vom Gastgeber, Markdown aus `@ks/viewers`,
 * KI-Hinweis auf die Instanz. Ohne `next/*`, ohne Clerk, ohne weiteren Request.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createInstanceApi } from '@ks/api-client'
import {
  BuchDetailRenderer,
  EMBED_DETAIL_RENDERERS,
  EmbedGalleryProviders,
  type DetailRenderProps,
} from '@ks/module-explorer/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'defaultValue' in opts ? String(opts.defaultValue) : key,
    locale: 'de',
  }),
}))

const instanz = createInstanceApi({ baseUrl: 'https://knowledgescout.org' })

/** So liefert die Detailansicht `docMeta`: die doc-meta-Antwort, `docMetaJson` sprach-veredelt. */
const docMeta = {
  exists: true,
  fileId: 'file-1',
  fileName: 'baukultur.md',
  chapters: [{ order: 1, level: 1, title: 'Einleitung', summary: 'Worum es geht' }],
  docMetaJson: {
    title: 'Baukultur in den Alpen',
    authors: ['A. Muster'],
    year: 2024,
    coverImageUrl: 'https://blob.example/cover.jpg',
    url: 'https://example.org/buch.pdf',
    attachments_url: ['https://blob.example/plan.png', 'https://blob.example/anhang.pdf'],
    markdown: '---\ntitle: nur Frontmatter\n---\n# Inhalt\n\nErster **Absatz**.',
  },
}

function zeige(props: Partial<DetailRenderProps>) {
  return render(
    <EmbedGalleryProviders instanz={instanz}>
      <BuchDetailRenderer libraryId="lib-aeced" fileId="file-1" docMeta={null} isDocMetaReady={false} {...props} />
    </EmbedGalleryProviders>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BuchDetailRenderer (Embed)', () => {
  it('baut die Ansicht aus docMeta — ohne weiteren Request', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    zeige({ docMeta, isDocMetaReady: true })

    // Der Titel steht im h1 des Kopfes; das Markdown bringt mit `# Inhalt` ein eigenes h1 mit.
    expect(screen.getByText('Baukultur in den Alpen').tagName).toBe('H1')
    expect(screen.getByText('A. Muster')).toBeDefined()
    expect(screen.getByText('PDF öffnen')).toBeDefined()
    expect(screen.getByText('Einleitung')).toBeDefined()
    expect(screen.getByText('Dokumente & Links')).toBeDefined()
    expect(screen.getByText('anhang.pdf')).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rendert Cover und Anhang-Vorschau schlicht und Markdown ohne Frontmatter', () => {
    const { container } = zeige({ docMeta, isDocMetaReady: true })

    const quellen = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    expect(quellen).toContain('https://blob.example/cover.jpg')
    expect(quellen).toContain('https://blob.example/plan.png')
    expect(container.querySelector('strong')?.textContent).toBe('Absatz')
    expect(container.textContent).not.toContain('nur Frontmatter')
  })

  it('der KI-Hinweis verlinkt auf die Instanz, nicht auf die fremde Seite', () => {
    zeige({ docMeta, isDocMetaReady: true })

    const link = screen.getByText('common.aiGenerated.learnMore').closest('a')
    expect(link?.getAttribute('href')).toBe('https://knowledgescout.org/info?type=rechtliche-hinweise')
    expect(link?.getAttribute('target')).toBe('_blank')
  })

  it('zeigt den Ladezustand, solange die Detailansicht noch laedt', () => {
    zeige({ docMeta: null, isDocMetaReady: false })
    expect(screen.getByText('gallery.loading')).toBeDefined()
  })

  it('sagt ausdruecklich, wenn es kein Dokument gibt, statt leer zu bleiben', () => {
    zeige({ docMeta: null, isDocMetaReady: true })
    expect(screen.getByText('Dokument nicht gefunden.')).toBeDefined()
  })
})

describe('EMBED_DETAIL_RENDERERS', () => {
  it('Buch, Testimonial und Blog zeigen die Buch-Ansicht — wie in der App', () => {
    expect(EMBED_DETAIL_RENDERERS.book).toBe(BuchDetailRenderer)
    expect(EMBED_DETAIL_RENDERERS.testimonial).toBe(BuchDetailRenderer)
    expect(EMBED_DETAIL_RENDERERS.blog).toBe(BuchDetailRenderer)
  })

  it('andere Typen sagen, dass es ihre Ansicht im Embed noch nicht gibt', () => {
    const Session = EMBED_DETAIL_RENDERERS.session
    render(<Session libraryId="lib-aeced" fileId="file-1" docMeta={null} isDocMetaReady />)
    expect(screen.getByText('Diese Ansicht ist in der eingebetteten Galerie noch nicht verfügbar.')).toBeDefined()
  })
})
