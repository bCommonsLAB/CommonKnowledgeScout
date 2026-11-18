// @vitest-environment jsdom

/**
 * WE0 (Plan `startseite-als-embed`): `<KnowledgeScoutExplorer start>` beginnt
 * mit offenem Dokument und Liste (Adressierung im Speicher) bzw. mit einer
 * Frage im Story-Modus (Auswahl im Speicher, Sitzung von der Instanz).
 * Ein Einstieg, der nicht zur Ansicht passt, steht als Fehler im Rahmen.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'

vi.mock('@ks/module-explorer/react', async (original) => {
  const echt = await original<typeof import('@ks/module-explorer/react')>()
  const { useAtomValue } = await import('jotai')
  const { storyAuswahlAtom } = await import('@ks/module-story/react')
  return {
    ...echt,
    // Die Galerie hat eigene Tests; hier zaehlt, womit sie beginnt.
    GalleryRoot: ({ libraryIdProp }: { libraryIdProp?: string }) => {
      const navigation = echt.useGalleryNavigation()
      const auswahl = useAtomValue(storyAuswahlAtom)
      return <div data-testid="galerie" data-params={navigation.params.toString()} data-auswahl={JSON.stringify(auswahl)}>{libraryIdProp}</div>
    },
  }
})

import { KnowledgeScoutExplorer } from '../../../../packages/embed/src'

type Props = ComponentProps<typeof KnowledgeScoutExplorer>

const GRUND: Props = { baseUrl: 'https://ks.example', library: 'aeced', view: 'gallery', locale: 'de' }
const LIBRARY = { library: { id: 'lib-1', label: 'L', slugName: 'aeced' } }

function stubFetch(antworten: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    const treffer = Object.keys(antworten).find((fragment) => url.includes(fragment))
    if (!treffer) throw new Error(`Unerwarteter Request im Test: ${url}`)
    return { ok: true, status: 200, json: async () => antworten[treffer] }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('KnowledgeScoutExplorer: Einstieg', () => {
  it('beginnt in der Galerie mit offenem Dokument, Seite und Rangliste', async () => {
    stubFetch({ '/api/public/libraries/aeced': LIBRARY })
    render(<KnowledgeScoutExplorer {...GRUND} start={{ dokument: 'karte-1', seitenzahl: 3, liste: { nurMitStern: true, sortierung: 'stars' } }} />)
    const galerie = await screen.findByTestId('galerie')
    expect(galerie.getAttribute('data-params')).toBe('doc=karte-1&page=3&starred=1&sort=stars')
  })

  it('beginnt im Story-Modus auf der Frage und stellt die Sitzung auf die der Frage um', async () => {
    const fetchMock = stubFetch({
      '/api/public/libraries/aeced': LIBRARY,
      '/llm-models': [{ modelId: 'm1' }],
      '/queries/q-42': { chatId: 'chat-7' },
    })
    render(<KnowledgeScoutExplorer {...GRUND} view="story" start={{ frage: 'q-42' }} />)

    const galerie = await screen.findByTestId('galerie')
    expect(galerie.getAttribute('data-params')).toBe('mode=story')
    expect(JSON.parse(galerie.getAttribute('data-auswahl') ?? '{}')).toEqual({ art: 'konversation', queryId: 'q-42' })

    await waitFor(() => expect(localStorage.getItem('chat-activeChatId-lib-1')).toBe('chat-7'))
    const aufruf = fetchMock.mock.calls.find(([url]) => String(url).includes('/queries/q-42')) as unknown as [string, RequestInit]
    expect(aufruf[0]).toBe('https://ks.example/api/chat/lib-1/queries/q-42')
    // Anonym: die Sitzungskennung des Browsers, keine Anmeldung.
    expect(new Headers(aufruf[1].headers).get('X-Session-ID')).toBeTruthy()
  })

  it('meldet einen Einstieg, der nicht zur Ansicht passt, im Rahmen — ohne Request', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = stubFetch({})
    render(<KnowledgeScoutExplorer {...GRUND} start={{ frage: 'q-42' }} />)
    expect(screen.getByRole('alert').textContent).toMatch(/view="story"/)
    expect(screen.queryByTestId('galerie')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(fehler).toHaveBeenCalled()
  })

  it('ein neuer Einstieg beginnt neu; derselbe Inhalt als neues Objekt nicht', async () => {
    const fetchMock = stubFetch({ '/api/public/libraries/aeced': LIBRARY })
    const { rerender } = render(<KnowledgeScoutExplorer {...GRUND} start={{ dokument: 'a' }} />)
    expect((await screen.findByTestId('galerie')).getAttribute('data-params')).toBe('doc=a')
    const libraryAbrufe = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/public/libraries/')).length
    const vorher = libraryAbrufe()

    // Die Container-Seite rendert neu und reicht denselben Einstieg als neues Objekt.
    rerender(<KnowledgeScoutExplorer {...GRUND} start={{ dokument: 'a' }} />)
    expect(screen.getByTestId('galerie').getAttribute('data-params')).toBe('doc=a')
    expect(libraryAbrufe()).toBe(vorher)

    // Die Container-Seite wechselt ihre Adresse: anderes Dokument.
    rerender(<KnowledgeScoutExplorer {...GRUND} start={{ dokument: 'b' }} />)
    await waitFor(() => expect(screen.getByTestId('galerie').getAttribute('data-params')).toBe('doc=b'))
  })
})
