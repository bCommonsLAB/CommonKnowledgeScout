// @vitest-environment jsdom

/**
 * `StoryRoot` (D6b): holt die Themenuebersicht ueber den Stream der Instanz,
 * zeigt Themen und Themenseite, uebernimmt eine Frage in die Eingabe, sendet
 * sie und zeigt die Konversation allein in der Mitte — mit Belegen an den
 * Gastgeber und der Sitzung an die Chronik-Atome. Alles ohne Clerk, ohne
 * Next, ohne nacktes `fetch`.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { createInstanceApi } from '@ks/api-client'
import { STORY_TOC_QUESTION } from '@ks/contracts'
import { StoryRoot, storyAktiveSitzungAtom, storyAuswahlAtom, storyGliederungAtom, type Perspektive } from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
    locale: 'de',
  }),
}))

const perspektive: Perspektive = { targetLanguage: 'de', character: [], accessPerspective: [], socialContext: 'general', genderInclusive: true, llmModel: 'm' }
const gliederung = {
  id: 'lib', title: 'Klima', tagline: '', intro: '',
  topics: [{ id: 'verkehr', title: 'Verkehr', questions: [{ id: 'q1', text: 'Welche Massnahmen gibt es zum Verkehr?' }] }],
}

function sse(schritte: unknown[]) {
  const text = schritte.map((s) => `data: ${JSON.stringify(s)}\n`).join('')
  let gelesen = false
  return {
    ok: true, status: 200, statusText: 'OK',
    body: { getReader: () => ({ read: async () => (gelesen ? { done: true, value: undefined } : ((gelesen = true), { done: false, value: new TextEncoder().encode(text) })) }) },
  }
}

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes('/queries?')) return { ok: true, status: 200, json: async () => ({ items: [] }) }
  if (init?.method === 'DELETE') return { ok: true, status: 200, json: async () => ({}) }
  if (url.includes('/stream?')) {
    const body = JSON.parse(String(init?.body)) as { message: string }
    if (body.message === STORY_TOC_QUESTION) {
      return sse([{ type: 'complete', answer: 'x', references: [], suggestedQuestions: [], queryId: 'toc', chatId: 'c1', storyTopicsData: gliederung }])
    }
    return sse([
      { type: 'llm_start', model: 'm' },
      { type: 'complete', answer: 'Es gibt Radwege [1].', references: [{ number: 1, fileId: 'f', fileName: 'Radwege.md', description: 'd', passages: [{ excerpt: 'r' }] }], suggestedQuestions: ['Wie viele?'], queryId: 'q9', chatId: 'c1', shortTitle: 'Radwege' }
    ])
  }
  throw new Error(`Unerwarteter Request: ${url}`)
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function montieren(dokumente = 12) {
  const store = createStore()
  const onBelege = vi.fn()
  render(
    <Provider store={store}>
      <StoryRoot
        libraryId="lib"
        instanz={createInstanceApi({ baseUrl: 'https://ks.example' })}
        viewer={{ isSignedIn: false }}
        perspektive={perspektive}
        kopf={{ titel: 'Klimaplan', beschreibung: 'Beschreibung', themenTitel: 'Themen' }}
        dokumente={dokumente}
        eingabe={{ placeholder: 'Frag mich', maxZeichen: 500 }}
        onBelege={onBelege}
        antwortFuss={() => <span data-testid="fuss">KI</span>}
        uebersichtFuss={({ queryId }) => <span data-testid="uebersicht-fuss">{queryId ?? '—'}</span>}
        loeschenErlaubt
      />
    </Provider>,
  )
  return { store, onBelege }
}

describe('StoryRoot', () => {
  it('holt die Themenuebersicht ueber die Instanz und zeigt die Themen; ohne Dokumente nicht', async () => {
    const { store } = montieren()
    expect(screen.getByText('Klimaplan')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Verkehr')).toBeTruthy())
    const tocCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/stream?'))
    expect(String(tocCall?.[0])).toMatch(/^https:\/\/ks\.example\/api\/chat\/lib\/stream\?.*llmModel=m/)
    expect(new Headers(tocCall?.[1]?.headers).get('X-Session-ID')).toMatch(/^anon-/)
    expect(store.get(storyGliederungAtom)).toEqual(gliederung)
    expect(screen.getByTestId('uebersicht-fuss').textContent).toBe('toc')
    // Nur einmal geholt, auch nach weiteren Renders.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/stream?'))).toHaveLength(1)
  })

  it('ohne Dokumente keine Anfrage', () => {
    montieren(0)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/stream?'))).toHaveLength(0)
  })

  it('Thema → Frage uebernehmen → senden: Konversation allein in der Mitte, Belege an den Gastgeber, Sitzung in den Atomen', async () => {
    const { store, onBelege } = montieren()
    await waitFor(() => expect(screen.getByText('Verkehr')).toBeTruthy())
    fireEvent.click(screen.getByText('Verkehr'))
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'thema', themaId: 'verkehr' })
    fireEvent.click(screen.getByText('Welche Massnahmen gibt es zum Verkehr?'))
    const feld = screen.getByPlaceholderText('Frag mich') as HTMLTextAreaElement
    expect(feld.value).toBe('Welche Massnahmen gibt es zum Verkehr?')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'chat.input.ask' }))
    })
    // Die Marke ① ist ein eigener Anker im Absatz — darum ueber den Absatztext pruefen.
    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Es gibt Radwege ①.')).toBeTruthy())
    expect(screen.queryByText('Verkehr')).toBeNull()
    expect(screen.getByTestId('fuss')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Wie viele?' })).toBeTruthy()
    expect(onBelege).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ fileId: 'f' })]), 'q9')
    const auswahl = store.get(storyAuswahlAtom)
    expect(auswahl).toMatchObject({ art: 'konversation', queryId: 'q9', themaId: 'verkehr' })
    expect(store.get(storyAktiveSitzungAtom)).toMatchObject({ chatId: 'c1', fragen: [expect.objectContaining({ queryId: 'q9', kurztitel: 'Radwege', offen: false })] })
    expect(localStorage.getItem('chat-activeChatId-lib')).toBe('c1')
  })

  it('D6c: Frage loeschen fragt nach, loescht ueber die Instanz und kehrt zur Uebersicht zurueck; „neu stellen" fuellt die Eingabe', async () => {
    const { store } = montieren()
    await waitFor(() => expect(screen.getByText('Verkehr')).toBeTruthy())
    fireEvent.click(screen.getByText('Verkehr'))
    fireEvent.click(screen.getByText('Welche Massnahmen gibt es zum Verkehr?'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'chat.input.ask' }))
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'story.konversation.delete' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'story.konversation.again' }))
    expect((screen.getByPlaceholderText('Frag mich') as HTMLTextAreaElement).value).toBe('Welche Massnahmen gibt es zum Verkehr?')

    vi.stubGlobal('confirm', vi.fn(() => false))
    fireEvent.click(screen.getByRole('button', { name: 'story.konversation.delete' }))
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)

    vi.stubGlobal('confirm', vi.fn(() => true))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'story.konversation.delete' }))
    })
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(String(del?.[0])).toBe('https://ks.example/api/chat/lib/queries/q9')
    expect(new Headers(del?.[1]?.headers).get('X-Session-ID')).toMatch(/^anon-/)
    await waitFor(() => expect(screen.getByText('Verkehr')).toBeTruthy())
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'uebersicht' })
    expect(store.get(storyAktiveSitzungAtom).fragen).toEqual([])
  })
})
