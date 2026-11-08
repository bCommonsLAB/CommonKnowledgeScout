// @vitest-environment jsdom

/**
 * `useStoryKonversation` (08.11.2026): Kommt der Hook mit einer Auswahl zur
 * Welt, die nur eine lokale Frage-Kennung traegt (Startseite → Story-Modus,
 * waehrend die Frage lief), zeigt er nach dem Laden des Verlaufs das juengste
 * Paar der Sitzung statt dauerhaft „nicht im geladenen Verlauf" — und warnt.
 * Eine gespeicherte Kennung, die fehlt, bleibt gewaehlt.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider, createStore } from 'jotai'
import { createInstanceApi } from '@ks/api-client'
import { STORY_UEBERSICHT, storyAuswahlAtom, useStoryKonversation, type Perspektive, type StoryAuswahl } from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({ useTranslation: () => ({ t: (key: string) => key, locale: 'de' }) }))

const perspektive: Perspektive = { targetLanguage: 'de', character: [], accessPerspective: [], socialContext: 'general', genderInclusive: true, llmModel: 'm' }
const eintrag = { queryId: 'q1', question: 'Erste?', createdAt: '2026-11-08T10:00:00.000Z', answer: 'Eins.' }

function montieren(libraryId: string, auswahl: StoryAuswahl, items: unknown[]) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/queries?')) return { ok: true, status: 200, json: async () => ({ items }) }
    throw new Error(`Unerwarteter Request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  // Dieselbe Sitzung wie der andere Gastgeber: ueber localStorage (useStorySitzungId).
  localStorage.setItem(`chat-activeChatId-${libraryId}`, 'c1')
  const store = createStore()
  store.set(storyAuswahlAtom, auswahl)
  const instanz = createInstanceApi({ baseUrl: 'https://ks.example' })
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>
  const hook = renderHook(
    () => useStoryKonversation({ libraryId, instanz, isSignedIn: true, perspektive, dokumente: null, ohneUebersicht: true }),
    { wrapper },
  )
  return { hook, store, fetchMock }
}

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  warn.mockRestore()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('useStoryKonversation – Rueckfall der Auswahl', () => {
  it('lokale Kennung aus anderem Gastgeber → juengstes Paar der Sitzung, mit Warnung', async () => {
    const { hook, store } = montieren('lib-a', { art: 'konversation', frageId: 'question-123' }, [eintrag])
    await waitFor(() => expect(store.get(storyAuswahlAtom)).toEqual({ art: 'konversation', queryId: 'q1', frageId: 'q1-question' }))
    expect(hook.result.current.paareDerAuswahl).toHaveLength(1)
    expect(hook.result.current.paareDerAuswahl[0].antwort?.text).toBe('Eins.')
    expect(warn).toHaveBeenCalledWith('[useStoryKonversation] Auswahl nicht im geladenen Verlauf — Rueckfall', expect.objectContaining({ frageId: 'question-123', chatId: 'c1' }))
  })

  it('lokale Kennung in leerer Sitzung → Uebersicht', async () => {
    const { store } = montieren('lib-b', { art: 'konversation', frageId: 'question-123' }, [])
    await waitFor(() => expect(store.get(storyAuswahlAtom)).toEqual(STORY_UEBERSICHT))
  })

  it('gespeicherte Kennung ohne Treffer bleibt gewaehlt — Mitte meldet sichtbar, kein Rueckfall', async () => {
    const { hook, store, fetchMock } = montieren('lib-c', { art: 'konversation', queryId: 'bogus' }, [eintrag])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(hook.result.current.nachrichten).toHaveLength(2))
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'konversation', queryId: 'bogus' })
    expect(hook.result.current.paareDerAuswahl).toHaveLength(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it('gespeicherte Kennung mit Treffer wird im neu geladenen Verlauf gefunden', async () => {
    const { hook } = montieren('lib-d', { art: 'konversation', queryId: 'q1' }, [eintrag])
    await waitFor(() => expect(hook.result.current.paareDerAuswahl).toHaveLength(1))
    expect(warn).not.toHaveBeenCalled()
  })
})
