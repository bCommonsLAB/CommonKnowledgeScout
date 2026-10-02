// @vitest-environment jsdom

/**
 * `useStoryStream` (D6b): Frage sofort als lokale Nachricht, Schritte aus dem
 * Stream, `complete` bringt Antwort, Belege, Kurztitel und Sitzung; die
 * Themenuebersicht geht an den Rueckruf statt in den Verlauf; ein Fehler
 * entfernt die Frage und wird gemeldet. Alles ueber `instanz.fetch`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { createInstanceApi } from '@ks/api-client'
import { STORY_TOC_QUESTION } from '@ks/contracts'
import { useStoryStream, type Nachricht, type Perspektive } from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({ useTranslation: () => ({ t: (key: string) => key, locale: 'de' }) }))

const perspektive: Perspektive = { targetLanguage: 'de', character: [], accessPerspective: [], socialContext: 'general', genderInclusive: true, llmModel: 'm' }

/** Eine Antwort mit SSE-Koerper, in zwei Chunks. */
function sseAntwort(zeilen: string[], ok = true) {
  const encoder = new TextEncoder()
  const text = zeilen.map((z) => `data: ${z}\n`).join('')
  const chunks = [encoder.encode(text.slice(0, 20)), encoder.encode(text.slice(20))]
  let i = 0
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Fehler',
    body: { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }) }) },
  }
}

function montieren(fetchMock: ReturnType<typeof vi.fn>, chatId: string | null = null) {
  vi.stubGlobal('fetch', fetchMock)
  const instanz = createInstanceApi({ baseUrl: 'https://ks.example' })
  const onSitzung = vi.fn()
  const onBelege = vi.fn()
  const onUebersicht = vi.fn()
  const onFehler = vi.fn()
  const hook = renderHook(() => {
    const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
    const stream = useStoryStream({
      libraryId: 'lib', instanz, isSignedIn: false,
      rahmen: { perspektive, antwortLaenge: 'kurz', chatId },
      nachrichten, setNachrichten, onSitzung, onBelege, onUebersicht, onFehler, maxZeichen: 50,
    })
    return { nachrichten, ...stream }
  })
  return { hook, onSitzung, onBelege, onUebersicht, onFehler }
}

afterEach(() => vi.unstubAllGlobals())

describe('useStoryStream', () => {
  it('Frage → Antwort mit Belegen, Kurztitel und neuer Sitzung, ueber die Instanz mit Sitzungskopf', async () => {
    const fetchMock = vi.fn(async () =>
      sseAntwort([
        JSON.stringify({ type: 'llm_start', model: 'm' }),
        JSON.stringify({ type: 'complete', answer: 'Antwort [1].', references: [{ number: 1, fileId: 'f', description: 'd' }], suggestedQuestions: ['Weiter?'], queryId: 'q9', chatId: 'c9', shortTitle: 'Kurz' }),
      ]),
    )
    const { hook, onSitzung, onBelege, onUebersicht } = montieren(fetchMock)
    await act(() => hook.result.current.frageSenden('Was?'))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/^https:\/\/ks\.example\/api\/chat\/lib\/stream\?/)
    expect(new Headers(init.headers).get('X-Session-ID')).toMatch(/^anon-/)
    expect(JSON.parse(String(init.body))).toEqual({ message: 'Was?', answerLength: 'kurz' })

    const n = hook.result.current.nachrichten
    expect(n.map((m) => [m.art, m.queryId])).toEqual([['frage', 'q9'], ['antwort', 'q9']])
    expect(n[0].kurztitel).toBe('Kurz')
    expect(n[1].belege).toHaveLength(1)
    expect(n[1].anschlussfragen).toEqual(['Weiter?'])
    expect(onSitzung).toHaveBeenCalledWith('c9')
    expect(onBelege).toHaveBeenCalledWith(n[1].belege, 'q9')
    expect(onUebersicht).not.toHaveBeenCalled()
    expect(hook.result.current.laeuft).toBe(false)
  })

  it('Themenuebersicht: Systemfrage, Ergebnis an den Rueckruf, nichts im Verlauf', async () => {
    const gliederung = { id: 'lib', title: 'T', tagline: '', intro: '', topics: [] }
    const fetchMock = vi.fn(async () =>
      sseAntwort([JSON.stringify({ type: 'complete', answer: 'x', references: [], suggestedQuestions: [], queryId: 'toc-1', chatId: 'c1', storyTopicsData: gliederung })]),
    )
    const { hook, onUebersicht } = montieren(fetchMock, 'c1')
    await act(() => hook.result.current.uebersichtLaden(true))
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ message: STORY_TOC_QUESTION, answerLength: 'kurz', chatId: 'c1', skipQueryCache: true })
    expect(onUebersicht).toHaveBeenCalledWith(gliederung, 'toc-1')
    expect(hook.result.current.nachrichten).toEqual([])
  })

  it('Themenuebersicht eroeffnet keine Sitzung, auch wenn der Server eine Kennung mitschickt (D8)', async () => {
    const gliederung = { id: 'lib', title: 'T', tagline: '', intro: '', topics: [] }
    const fetchMock = vi.fn(async () =>
      sseAntwort([JSON.stringify({ type: 'complete', answer: 'x', references: [], suggestedQuestions: [], queryId: 'toc-2', chatId: 'alt-1', storyTopicsData: gliederung })]),
    )
    const { hook, onSitzung, onUebersicht } = montieren(fetchMock, null)
    await act(() => hook.result.current.uebersichtLaden())
    expect(onUebersicht).toHaveBeenCalledWith(gliederung, 'toc-2')
    expect(onSitzung).not.toHaveBeenCalled()
  })

  it('Fehler-Schritt und HTTP-Fehler: Frage wieder weg, Meldung sichtbar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sseAntwort([JSON.stringify({ type: 'error', error: 'Kaputt' })]))
      .mockResolvedValueOnce(sseAntwort([], false))
    const { hook, onFehler } = montieren(fetchMock)
    await act(() => hook.result.current.frageSenden('Eins'))
    expect(onFehler).toHaveBeenLastCalledWith('Kaputt')
    await act(() => hook.result.current.frageSenden('Zwei'))
    expect(onFehler).toHaveBeenLastCalledWith('HTTP 500: Fehler')
    expect(hook.result.current.nachrichten).toEqual([])
  })

  it('Fehler mit Kennung: Klartext fuer die Person, technische Meldung als Detail (D10d)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () =>
      sseAntwort([JSON.stringify({ type: 'error', error: 'Secretary Service nicht erreichbar (http://127.0.0.1:5001/api/rag/embed-text)', code: 'dienst_nicht_erreichbar' })]),
    )
    const { hook, onFehler } = montieren(fetchMock)
    await act(() => hook.result.current.frageSenden('Eins'))
    expect(onFehler).toHaveBeenLastCalledWith('story.fehler.dienstNichtErreichbar', 'Secretary Service nicht erreichbar (http://127.0.0.1:5001/api/rag/embed-text)')
  })

  it('zu lange Frage wird gar nicht erst geschickt', async () => {
    const fetchMock = vi.fn()
    const { hook, onFehler } = montieren(fetchMock)
    await act(() => hook.result.current.frageSenden('x'.repeat(51)))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onFehler).toHaveBeenCalledTimes(1)
  })
})
