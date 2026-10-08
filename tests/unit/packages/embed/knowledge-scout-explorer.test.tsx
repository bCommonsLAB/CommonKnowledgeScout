// @vitest-environment jsdom

/**
 * Beweis M5, Huelle: `<KnowledgeScoutExplorer>` laedt eine oeffentliche
 * Library von der hereingereichten Instanz — die Sprache als
 * `Accept-Language` — und montiert die Galerie im Rahmen `.ks-embed`. Eine
 * geschuetzte Library lehnt er ab, falsche Props meldet er im Rahmen. Ohne
 * Next-Router, ohne Clerk.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderToString } from 'react-dom/server'
import { Tooltip, TooltipTrigger } from '@ks/ui'

vi.mock('@ks/module-explorer/react', async (original) => ({
  ...(await original<typeof import('@ks/module-explorer/react')>()),
  // Die Galerie hat eigene Tests; hier geht es um die Huelle. Der Tooltip steht
  // fuer Galerie-Teile ohne eigenen TooltipProvider (Quellenverzeichnis): Ohne
  // Provider im Rahmen wirft Radix beim Rendern (Nachweis 08.10.2026).
  GalleryRoot: ({ libraryIdProp, storyPanel, storyChronik, storyHeader }: { libraryIdProp?: string; storyPanel?: unknown; storyChronik?: unknown; storyHeader?: unknown }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div data-testid="galerie" data-story={[storyPanel, storyChronik, storyHeader].filter(Boolean).length}>{`galerie:${libraryIdProp}`}</div>
      </TooltipTrigger>
    </Tooltip>
  ),
}))

import { KnowledgeScoutExplorer } from '../../../../packages/embed/src'

type Props = ComponentProps<typeof KnowledgeScoutExplorer>

const oeffentlich = { id: 'lib-aeced', label: 'AECED', slugName: 'aeced' }

/** Eine `fetch`-Attrappe, die je Pfad-Fragment antwortet. */
function stubFetch(antworten: Record<string, { ok: boolean; status?: number; body?: unknown }>) {
  const fetchMock = vi.fn(async (url: string) => {
    const treffer = Object.keys(antworten).find((fragment) => url.includes(fragment))
    if (!treffer) throw new Error(`Unerwarteter Request im Test: ${url}`)
    const antwort = antworten[treffer]
    return {
      ok: antwort.ok,
      status: antwort.status ?? (antwort.ok ? 200 : 404),
      json: async () => antwort.body ?? {},
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const GRUND: Props = { baseUrl: 'https://ks.example', library: 'aeced', view: 'gallery', locale: 'de' }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('KnowledgeScoutExplorer', () => {
  it('laedt die Library von der Instanz, mit der Sprache als Accept-Language, und montiert die Galerie', async () => {
    const fetchMock = stubFetch({ '/api/public/libraries/aeced': { ok: true, body: { library: oeffentlich } } })

    render(<KnowledgeScoutExplorer {...GRUND} locale="it" />)

    expect((await screen.findByTestId('galerie')).textContent).toBe('galerie:lib-aeced')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined]
    expect(url).toBe('https://ks.example/api/public/libraries/aeced')
    expect(new Headers(init?.headers).get('Accept-Language')).toBe('it')
  })

  it('D6b: view="story" montiert die drei Story-Slots, "gallery" keinen', async () => {
    stubFetch({ '/api/public/libraries/aeced': { ok: true, body: { library: oeffentlich } } })
    const { unmount } = render(<KnowledgeScoutExplorer {...GRUND} view="story" />)
    expect((await screen.findByTestId('galerie')).getAttribute('data-story')).toBe('3')
    unmount()
    render(<KnowledgeScoutExplorer {...GRUND} />)
    expect((await screen.findByTestId('galerie')).getAttribute('data-story')).toBe('0')
  })

  it('enableStory: view="gallery" bietet den Story-Modus an und startet in den Inhalten', async () => {
    stubFetch({ '/api/public/libraries/aeced': { ok: true, body: { library: oeffentlich } } })
    render(<KnowledgeScoutExplorer {...GRUND} enableStory />)
    expect((await screen.findByTestId('galerie')).getAttribute('data-story')).toBe('3')
  })

  it('enableStory={false} mit view="story" wird gemeldet, nicht still aufgeloest', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stubFetch({})
    render(<KnowledgeScoutExplorer {...GRUND} view="story" enableStory={false} />)
    expect(screen.getByRole('alert').textContent).toMatch(/widersprechen sich/)
    expect(screen.queryByTestId('galerie')).toBeNull()
    expect(fehler).toHaveBeenCalled()
  })

  it('legt alles in den Rahmen .ks-embed mit der gewuenschten Hoehe', async () => {
    stubFetch({ '/api/public/libraries/aeced': { ok: true, body: { library: oeffentlich } } })

    const { container } = render(<KnowledgeScoutExplorer {...GRUND} height="600px" />)

    const rahmen = container.firstElementChild as HTMLElement
    expect(rahmen.className).toBe('ks-embed')
    expect(rahmen.style.height).toBe('600px')
    await screen.findByTestId('galerie')
  })

  it('rendert auf dem Server nur den Rahmen — nichts, was beim Hydrieren von der Sprache abhaengt', () => {
    // Nachweis in einer Next-16-App (10.09.2026): Der Server renderte „Loading…",
    // der Browser „Lade…" — Hydrierungsfehler, danach zeichnete React die ganze
    // fremde Seite neu. Die Galerie montiert deshalb erst im Browser.
    const fetchMock = stubFetch({})

    const html = renderToString(<KnowledgeScoutExplorer {...GRUND} height="600px" />)

    expect(html).toMatch(/^<div class="ks-embed" style="[^"]*height:600px/)
    // Der Rahmen haelt, was in ihm `fixed` steht (Detailansicht): nicht das Fenster der fremden Seite.
    expect(html).toMatch(/^<div class="ks-embed" style="[^"]*contain:layout/)
    expect(html).not.toMatch(/Lade|Loading/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lehnt eine geschuetzte Library ab — das Embed zeigt nur Oeffentliches', async () => {
    stubFetch({
      '/api/public/libraries/aeced': { ok: true, body: { library: { ...oeffentlich, requiresAuth: true } } },
      '/access-check': { ok: true, body: { hasAccess: false, requiresAuth: true } },
    })

    render(<KnowledgeScoutExplorer {...GRUND} />)

    expect((await screen.findByRole('alert')).textContent).toMatch(/nicht öffentlich/)
    expect(screen.queryByTestId('galerie')).toBeNull()
  })

  it('meldet eine unbekannte Library, statt leer zu bleiben', async () => {
    stubFetch({ '/api/public/libraries/gibt-es-nicht': { ok: false, status: 404 } })

    render(<KnowledgeScoutExplorer {...GRUND} library="gibt-es-nicht" />)

    expect(await screen.findByRole('alert')).toBeDefined()
    expect(screen.queryByTestId('galerie')).toBeNull()
  })

  it.each([
    ['eine Basis-URL ohne Schema', { baseUrl: 'knowledgescout.org' }, /Basis-URL/],
    ['eine unbekannte Sprache', { locale: 'xx' }, /Sprache "xx"/],
    ['eine unbekannte Ansicht', { view: 'tabelle' }, /Ansicht "tabelle"/],
  ])('meldet %s im Rahmen, ohne einen Request', (_fall, falsch, meldung) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = stubFetch({})

    render(<KnowledgeScoutExplorer {...({ ...GRUND, ...falsch } as unknown as Props)} />)

    expect(screen.getByRole('alert').textContent).toMatch(meldung)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
