// @vitest-environment jsdom

/**
 * `StoryAuswahlUrl` (D2): bindet `storyAuswahlAtom` an `q=<queryId>`.
 *
 * - Adresse → Auswahl beim Laden und beim Zurueck-Knopf; die Sitzung der
 *   Konversation wird ueber die gespeicherte Frage aufgeloest.
 * - Auswahl → Adresse mit Verlaufseintrag; der Nachtrag der Kennung an eine
 *   laufende Frage ersetzt nur.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { Provider, createStore } from 'jotai'
import { STORY_UEBERSICHT, storyAuswahlAtom, type StoryAuswahl } from '@ks/module-story/react'
import { StoryAuswahlUrl } from '@/components/library/story/story-auswahl-url'
import { useActiveChatId } from '@/components/library/chat/chat-panel/hooks/use-active-chat-id'

vi.mock('@/hooks/use-clerk-session-headers', () => ({ useClerkSessionHeaders: () => ({}) }))

function Sitzung() {
  const { activeChatId } = useActiveChatId('lib')
  return <output data-testid="sitzung">{activeChatId ?? '—'}</output>
}

function einrichten(searchParams: string, auswahl: StoryAuswahl = STORY_UEBERSICHT) {
  const store = createStore()
  store.set(storyAuswahlAtom, auswahl)
  const updates: UrlUpdateEvent[] = []
  render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={(e) => updates.push(e)}>
      <Provider store={store}>
        <StoryAuswahlUrl libraryId="lib" />
        <Sitzung />
      </Provider>
    </NuqsTestingAdapter>,
  )
  return { store, updates }
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Adresse → Auswahl', () => {
  it('q beim Laden waehlt die Konversation und stellt den Chat auf ihre Sitzung um', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ queryId: 'q7', chatId: 'chat-b' }) }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('chat-activeChatId-lib', 'chat-a')
    const { store } = einrichten('?q=q7')

    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'konversation', queryId: 'q7' })
    await waitFor(() => expect(screen.getByTestId('sitzung').textContent).toBe('chat-b'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/lib/queries/q7', expect.objectContaining({ cache: 'no-store' }))
  })

  it('nicht auffindbare Kennung bleibt gewaehlt, Sitzung bleibt, Warnung sichtbar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })))
    localStorage.setItem('chat-activeChatId-lib', 'chat-a')
    const { store } = einrichten('?q=fremd')

    await waitFor(() => expect(console.warn).toHaveBeenCalled())
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'konversation', queryId: 'fremd' })
    expect(screen.getByTestId('sitzung').textContent).toBe('chat-a')
  })

  it('ohne q beim Laden gilt die Uebersicht, auch wenn das Atom noch eine Konversation hielt', () => {
    vi.stubGlobal('fetch', vi.fn())
    const { store, updates } = einrichten('', { art: 'konversation', queryId: 'alt' })
    expect(store.get(storyAuswahlAtom)).toEqual(STORY_UEBERSICHT)
    expect(updates).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ohne q bleibt ein gewaehltes Thema stehen', () => {
    vi.stubGlobal('fetch', vi.fn())
    const { store } = einrichten('', { art: 'thema', themaId: 'verkehr' })
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'thema', themaId: 'verkehr' })
  })
})

describe('Auswahl → Adresse', () => {
  it('Klick auf eine Konversation schreibt q mit Verlaufseintrag; Uebersicht loescht q', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { store, updates } = einrichten('')

    act(() => store.set(storyAuswahlAtom, { art: 'konversation', queryId: 'q1', themaId: 'verkehr' }))
    await waitFor(() => expect(updates).toHaveLength(1))
    expect(updates[0].searchParams.get('q')).toBe('q1')
    expect(updates[0].options.history).toBe('push')

    act(() => store.set(storyAuswahlAtom, STORY_UEBERSICHT))
    await waitFor(() => expect(updates).toHaveLength(2))
    expect(updates[1].searchParams.get('q')).toBeNull()
    // Das eigene Schreiben loest keine Sitzungs-Aufloesung aus.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('eine laufende Frage steht nicht in der Adresse; ihr Nachtrag ersetzt statt zu pushen', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { store, updates } = einrichten('?q=q0', { art: 'konversation', queryId: 'q0' })

    act(() => store.set(storyAuswahlAtom, { art: 'konversation', frageId: 'lokal-1' }))
    await waitFor(() => expect(updates).toHaveLength(1))
    expect(updates[0].searchParams.get('q')).toBeNull()

    act(() => store.set(storyAuswahlAtom, { art: 'konversation', frageId: 'lokal-1', queryId: 'q9' }))
    await waitFor(() => expect(updates).toHaveLength(2))
    expect(updates[1].searchParams.get('q')).toBe('q9')
    expect(updates[1].options.history).toBe('replace')
  })
})
