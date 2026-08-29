// @vitest-environment jsdom

/**
 * Unit-Tests: `ExplorerRoot` aus `@ks/module-explorer/react` (Welle M4).
 *
 * **Das Beweis-Ziel der Welle** (Modul-Landkarte §5, Zeile M4): Der Explorer
 * laesst sich aus dem Paket montieren — ohne Next.js-Datei-Routing (der Slug
 * ist eine Prop, kein `useParams()`) und ohne Auth-Anbieter (die Identitaet
 * kommt als Prop, die Anmelde-Aufforderung als Slot). Genau das braucht der
 * AECED-Embed in M5, und genau das prueft dieser Test: Hier gibt es weder
 * einen Next-Router noch Clerk.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { ExplorerRoot } from '@ks/module-explorer/react'
import type { ExplorerLibraryPayload } from '@ks/module-explorer/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

const oeffentlich: ExplorerLibraryPayload = {
  id: 'lib-1',
  label: 'Oldies for Future',
  slugName: 'oldies',
  siteEnabled: false,
}

/** Baut eine `fetch`-Attrappe, die je Pfad-Fragment antwortet. */
function stubFetch(routes: Record<string, { ok: boolean; status?: number; body?: unknown }>) {
  const fetchMock = vi.fn(async (url: string) => {
    const treffer = Object.keys(routes).find((fragment) => url.includes(fragment))
    if (!treffer) throw new Error(`Unerwarteter Request im Test: ${url}`)
    const route = routes[treffer]
    return {
      ok: route.ok,
      status: route.status ?? (route.ok ? 200 : 404),
      json: async () => route.body ?? {},
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderRoot(props: Partial<React.ComponentProps<typeof ExplorerRoot>> = {}) {
  const store = createStore()
  render(
    <Provider store={store}>
      <ExplorerRoot
        slug="oldies"
        viewer={{ isLoaded: true, isSignedIn: false }}
        renderGallery={({ libraryId, showSiteTab }) => (
          <div data-testid="galerie">{`galerie:${libraryId}:${showSiteTab}`}</div>
        )}
        renderSignInPrompt={({ slug }) => <button>{`anmelden:${slug}`}</button>}
        {...props}
      />
    </Provider>,
  )
  return store
}

describe('ExplorerRoot — montierbar ohne Next-Routing und ohne Clerk', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { ...console, error: vi.fn(), warn: vi.fn() })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('laedt die Library ueber den Slug-Prop und montiert die Galerie', async () => {
    stubFetch({ '/api/public/libraries/': { ok: true, body: { library: oeffentlich } } })

    renderRoot()

    await waitFor(() => expect(screen.getByTestId('galerie')).toBeDefined())
    expect(screen.getByTestId('galerie').textContent).toBe('galerie:lib-1:false')
    expect(screen.getByText('Oldies for Future')).toBeDefined()
  })

  it('reicht siteEnabled als showSiteTab an die Galerie durch', async () => {
    stubFetch({
      '/api/public/libraries/': { ok: true, body: { library: { ...oeffentlich, siteEnabled: true } } },
    })

    renderRoot()

    await waitFor(() => expect(screen.getByTestId('galerie').textContent).toBe('galerie:lib-1:true'))
  })

  it('schreibt die geladene Library in den Auswahl-Zustand der Schale', async () => {
    stubFetch({ '/api/public/libraries/': { ok: true, body: { library: oeffentlich } } })

    renderRoot()

    // Sichtbar am Ergebnis: die Galerie bekommt genau diese Library-Id.
    await waitFor(() => expect(screen.getByTestId('galerie').textContent).toContain('lib-1'))
  })

  it('zeigt den Anmelde-Slot, wenn Freigabe noetig ist und niemand angemeldet ist', async () => {
    stubFetch({
      '/api/public/libraries/': { ok: true, body: { library: { ...oeffentlich, requiresAuth: true } } },
      '/access-check': { ok: true, body: { hasAccess: false, requiresAuth: true } },
    })

    renderRoot()

    await waitFor(() => expect(screen.getByText('anmelden:oldies')).toBeDefined())
    expect(screen.queryByTestId('galerie')).toBeNull()
  })

  it('zeigt den Wartezustand, wenn die Zugriffsanfrage laeuft', async () => {
    stubFetch({
      '/api/public/libraries/': { ok: true, body: { library: { ...oeffentlich, requiresAuth: true } } },
      // Angemeldet: Das Protokoll versucht zusaetzlich die Member-Sicht.
      // 404 = kein Mitglied, es bleibt bei der oeffentlichen Antwort.
      '/explore-by-slug/': { ok: false, status: 404 },
      '/access-check': { ok: true, body: { hasAccess: false, status: 'pending' } },
    })

    renderRoot({ viewer: { isLoaded: true, isSignedIn: true } })

    await waitFor(() => expect(screen.getByText('Ihre Anfrage wird bearbeitet')).toBeDefined())
  })

  it('meldet eine unbekannte Library, statt still leer zu bleiben', async () => {
    stubFetch({ '/api/public/libraries/': { ok: false, status: 404 } })

    renderRoot()

    await waitFor(() => expect(screen.getByText('explore.libraryNotFound')).toBeDefined())
  })

  it('rendert den Hinweis-Slot der Anwendung unter dem Kopf', async () => {
    stubFetch({ '/api/public/libraries/': { ok: true, body: { library: oeffentlich } } })

    renderRoot({
      renderNotice: ({ libraryId }) => <div data-testid="hinweis">{`hinweis:${libraryId}`}</div>,
    })

    await waitFor(() => expect(screen.getByTestId('hinweis').textContent).toBe('hinweis:lib-1'))
  })

  it('kommt ohne Hinweis-Slot aus (er ist optional)', async () => {
    stubFetch({ '/api/public/libraries/': { ok: true, body: { library: oeffentlich } } })

    renderRoot()

    await waitFor(() => expect(screen.getByTestId('galerie')).toBeDefined())
    expect(screen.queryByTestId('hinweis')).toBeNull()
  })
})
