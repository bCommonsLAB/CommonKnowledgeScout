// @vitest-environment jsdom

/**
 * WE4 — `<KnowledgeScoutSite>`: die Startseite einer oeffentlichen Library in
 * einer fremden Seite. Jeder Weg hinaus ist ein Link aus `hrefFor` (Menue,
 * Kacheln, Handlungsaufruf, Markdown-Links, Banner); `null` laesst das Element
 * weg. Unbekannte Seite, Library ohne Website und falsche Props stehen als
 * Fehler im Rahmen. Ohne Next-Router, ohne Clerk.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { KnowledgeScoutSite, ksZielAlsParameter, type KsZiel } from '../../../../packages/embed/src'
import { embedSiteNavigation } from '../../../../packages/embed/src/embed-site-navigation'

type Props = ComponentProps<typeof KnowledgeScoutSite>

const LIBRARY = { id: 'lib-aeced', label: 'AECED', slugName: 'aeced', siteEnabled: true, gallery: { menuLabel: 'Karten' } }
const SEITEN = [
  { id: 'home', fileId: 'home', title: 'Start', slug: 'start', detailViewType: 'website', menu_area: 'main', menu_order: 1 },
  { id: 'mit', fileId: 'mit', title: 'Mitmachen', slug: 'mitmachen', detailViewType: 'website', menu_area: 'main', menu_order: 2 },
]
const MARKDOWN = [
  '<!-- section layout=text-only -->',
  '## Willkommen',
  'Mehr dazu [im Archiv](?view=gallery) oder [auf unserer Seite](/kontakt).',
  '',
  '<!-- cards -->',
  '- **Archiv** Stoebern. [Zum Archiv](?view=gallery)',
  '- **Themen** Fragen. [Zu den Themen](?mode=story)',
  '<!-- /section -->',
].join('\n')
const DETAIL = { exists: true, fileId: 'home', docMetaJson: { title: 'Start', hero_layout: 'band', cta_label: 'Mitmachen', cta_url: '?site=mitmachen', banner_hidden: true, markdown: MARKDOWN } }

/** Eine `fetch`-Attrappe, die je Pfad-Fragment antwortet (erstes passendes Fragment gewinnt). */
function stubFetch(antworten: Array<[string, unknown]>) {
  const fetchMock = vi.fn(async (url: string) => {
    const treffer = antworten.find(([fragment]) => url.includes(fragment))
    if (!treffer) throw new Error(`Unerwarteter Request im Test: ${url}`)
    return { ok: true, status: 200, json: async () => treffer[1] }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const STANDARD: Array<[string, unknown]> = [
  ['/api/public/libraries/aeced', { library: LIBRARY }],
  ['/llm-models', [{ modelId: 'm1' }]],
  ['detailViewType=website', { items: SEITEN }],
  ['/doc-meta', DETAIL],
]

/** Container-Anwendung mit Seiten fuer Galerie und Story, aber keiner fuer Website-Seiten. */
function hrefFor(ziel: KsZiel): string | null {
  const q = new URLSearchParams(ksZielAlsParameter(ziel)).toString()
  if (ziel.art === 'galerie' || ziel.art === 'dokument') return `/inhalte${q ? `?${q}` : ''}`
  if (ziel.art === 'story') return `/fragen-story${q ? `?${q}` : ''}`
  return null
}

const GRUND: Props = { baseUrl: 'https://ks.example', library: 'aeced', locale: 'de', hrefFor }

// jsdom kennt `Element.scrollTo` nicht; die Seite rollt beim Seitenwechsel nach oben.
beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.querySelectorAll('[data-ks-site-portal]').forEach((n) => n.remove())
})

function hrefVon(text: string): string | null {
  return screen.getByText(text).closest('a')?.getAttribute('href') ?? null
}

describe('KnowledgeScoutSite', () => {
  it('rendert die Startseite; Menue, Kacheln und Markdown-Links tragen die Adressen aus hrefFor', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stubFetch(STANDARD)
    const { container } = render(<KnowledgeScoutSite {...GRUND} />)
    expect(await screen.findByText('Willkommen')).toBeTruthy()
    // Menue: Website-Seiten haben in dieser Container-Anwendung keine Adresse (entfallen), Inhalte und Story schon.
    const menue = container.querySelector('[data-ks-site-menue]')
    expect(menue?.textContent).toContain('Karten')
    expect(menue?.textContent).not.toContain('Mitmachen')
    expect(hrefVon('Karten')).toBe('/inhalte')
    expect(hrefVon('Zum Archiv')).toBe('/inhalte')
    expect(hrefVon('Zu den Themen')).toBe('/fragen-story')
    expect(hrefVon('im Archiv')).toBe('/inhalte')
    // Relative Fremd-Adresse und Handlungsaufruf auf eine Website-Seite: ohne Adresse, also kein Link.
    const anker = [...container.querySelectorAll('a')].map((a) => a.textContent)
    expect(container.textContent).toContain('auf unserer Seite')
    expect(anker).not.toContain('auf unserer Seite')
    expect(screen.queryByText('Mitmachen', { selector: 'a' })).toBeNull()
    // Der Rahmen bindet `fixed` nicht an sich (Detailansicht ueber dem Fenster), der Portal-Ort steht am body.
    expect((container.querySelector('[data-ks-site]') as HTMLElement).style.contain).toBe('')
    expect(document.body.querySelector('[data-ks-site-portal].ks-embed')).not.toBeNull()
  })

  it('Abrufe gehen an die Instanz, mit der Sprache als Accept-Language', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetchMock = stubFetch(STANDARD)
    render(<KnowledgeScoutSite {...GRUND} locale="it" />)
    await screen.findByText('Willkommen')
    const seiten = fetchMock.mock.calls.find(([url]) => String(url).includes('detailViewType=website')) as unknown as [string, RequestInit]
    expect(seiten[0].startsWith('https://ks.example/api/chat/lib-aeced/docs?')).toBe(true)
    expect(new Headers(seiten[1]?.headers).get('Accept-Language')).toBe('it')
  })

  it('menu={false} blendet die Menuezeile aus', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stubFetch(STANDARD)
    const { container } = render(<KnowledgeScoutSite {...GRUND} menu={false} />)
    await screen.findByText('Willkommen')
    expect(container.querySelector('[data-ks-site-menue]')).toBeNull()
  })

  it('unbekannte page: Fehler im Rahmen, kein Rueckfall auf die Startseite', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch(STANDARD)
    render(<KnowledgeScoutSite {...GRUND} page="gibt-es-nicht" />)
    expect((await screen.findByText(/Die Seite "gibt-es-nicht" gibt es in dieser Library nicht/)).textContent).toBeTruthy()
    expect(screen.queryByText('Willkommen')).toBeNull()
  })

  it('Library ohne Website wird gemeldet', async () => {
    stubFetch([['/api/public/libraries/aeced', { library: { ...LIBRARY, siteEnabled: false } }], ['/llm-models', [{ modelId: 'm1' }]]])
    render(<KnowledgeScoutSite {...GRUND} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/hat keine Website/)
  })

  it('falsche Props stehen im Rahmen: ohne hrefFor, leere page, fremde Sprache', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch([])
    const ohne = { ...GRUND, hrefFor: undefined } as unknown as Props
    const { unmount } = render(<KnowledgeScoutSite {...ohne} />)
    expect(screen.getByRole('alert').textContent).toMatch(/hrefFor fehlt/)
    unmount()
    const r2 = render(<KnowledgeScoutSite {...GRUND} page=" " />)
    expect(screen.getByRole('alert').textContent).toMatch(/page ist leer/)
    r2.unmount()
    render(<KnowledgeScoutSite {...GRUND} locale={'xx' as Props['locale']} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Sprache "xx"/)
    expect(fehler).toHaveBeenCalled()
  })
})

describe('embedSiteNavigation', () => {
  it('Adresse aus hrefFor, Klick oeffnet dieselbe Adresse; null, Wurf und Unsinn heissen: kein Weg', () => {
    const zu = vi.fn()
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const nav = embedSiteNavigation((z) => (z.art === 'galerie' ? '/inhalte' : z.art === 'story' ? null : z.art === 'seite' ? '' : (() => { throw new Error('kaputt') })()), zu)
    const weg = nav.weg({ art: 'galerie' })
    expect(weg?.href).toBe('/inhalte')
    weg?.ausfuehren?.()
    expect(zu).toHaveBeenCalledWith('/inhalte')
    expect(nav.weg({ art: 'story' })).toBeNull()
    expect(nav.weg({ art: 'seite', seite: 'x' })).toBeNull()
    expect(nav.weg({ art: 'dokument', slug: 'd' })).toBeNull()
    expect(fehler).toHaveBeenCalledTimes(2)
    // Relative Fremd-Adressen kennt das Embed nicht.
    expect(nav.fremd).toBeUndefined()
  })
})
