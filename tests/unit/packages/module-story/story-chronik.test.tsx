// @vitest-environment jsdom

/**
 * `StoryChronik` — die linke Spalte (D1, lesend).
 *
 * Klickmodell (Plan): Gliederung beim Einstieg zu; sobald ein Thema gewaehlt
 * ist, klappt sie auf und markiert es. Fragen der aktiven Sitzung kommen live
 * aus dem Atom, als Kurztitel; Klick waehlt die Konversation und ordnet das
 * Thema ueber den Fragetext zu. Fragen anderer Sitzungen stellen die App um.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { SAME_ORIGIN_API } from '@ks/api-client'
import type { StoryTopicsData } from '@ks/contracts'
import {
  StoryChronik,
  storyAktiveSitzungAtom,
  storyAuswahlAtom,
  storyGliederungAtom,
} from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
    locale: 'de',
  }),
}))

const gliederung: StoryTopicsData = {
  id: 'lib', title: 'Klima', tagline: '', intro: '',
  topics: [
    { id: 'verkehr', title: 'Verkehr', questions: [{ id: 'q1', text: 'Welche Massnahmen gibt es zum Verkehr?' }] },
    { id: 'heizen', title: 'Heizen', questions: [{ id: 'q2', text: 'Wie heizen wir morgen?' }] },
  ],
}

function stubChats() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/chats?limit=50')) {
      return { ok: true, status: 200, json: async () => ({ items: [
        { chatId: 'aktiv', title: 'Heute', createdAt: '2026-10-01T10:00:00.000Z' },
        { chatId: 'alt', title: 'Gestern', createdAt: '2026-09-30T10:00:00.000Z' },
      ] }) }
    }
    if (url.includes('chatId=alt')) {
      return { ok: true, status: 200, json: async () => ({ items: [
        { queryId: 'alt-1', question: 'Wer hat das entschieden?', createdAt: '2026-09-30T10:00:00.000Z', status: 'ok' },
      ] }) }
    }
    throw new Error(`Unerwarteter Request: ${url}`)
  }))
}

function renderChronik(onGewaehlt?: () => void) {
  const store = createStore()
  store.set(storyGliederungAtom, gliederung)
  store.set(storyAktiveSitzungAtom, { chatId: 'aktiv', fragen: [
    { queryId: 'q-a', text: 'Wie heizen wir morgen?', createdAt: '2026-10-01T10:01:00.000Z', offen: false },
    { frageId: 'question-1', text: 'Und was kostet das alles zusammen?', createdAt: '2026-10-01T10:02:00.000Z', offen: true },
  ] })
  const onSitzungWaehlen = vi.fn()
  const onNeueSitzung = vi.fn()
  render(
    <Provider store={store}>
      <StoryChronik
        libraryId="lib"
        instanz={SAME_ORIGIN_API}
        viewer={{ isSignedIn: true }}
        onSitzungWaehlen={onSitzungWaehlen}
        onNeueSitzung={onNeueSitzung}
        onGewaehlt={onGewaehlt}
      />
    </Provider>,
  )
  return { store, onSitzungWaehlen, onNeueSitzung }
}

describe('StoryChronik', () => {
  beforeEach(() => stubChats())
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('Gliederung ist beim Einstieg zu und klappt auf, sobald ein Thema gewaehlt ist', async () => {
    const { store } = renderChronik()
    expect(screen.queryByRole('button', { name: 'Verkehr' })).toBeNull()

    store.set(storyAuswahlAtom, { art: 'thema', themaId: 'heizen' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Heizen' }).getAttribute('aria-current')).toBe('true'))
    expect(screen.getByRole('button', { name: 'Verkehr' }).getAttribute('aria-current')).toBeNull()
  })

  it('zeigt die Fragen der aktiven Sitzung live als Kurztitel, laufende als „laeuft"', async () => {
    renderChronik()
    await waitFor(() => expect(screen.getByText('Heute')).toBeTruthy())
    expect(screen.getByText('heizen wir morgen')).toBeTruthy()
    expect(screen.getByText('story.running')).toBeTruthy()
  })

  it('Klick auf eine Frage waehlt die Konversation und ordnet das Thema zu', async () => {
    const { store } = renderChronik()
    await waitFor(() => screen.getByText('heizen wir morgen'))
    fireEvent.click(screen.getByText('heizen wir morgen'))
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'konversation', queryId: 'q-a', frageId: undefined, themaId: 'heizen' })
    // Die Gliederung markiert jetzt das Thema der Frage.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Heizen' }).getAttribute('aria-current')).toBe('true'))
  })

  it('aeltere Sitzung aufklappen laedt ihre Fragen; Klick stellt die App auf diese Sitzung um', async () => {
    const { store, onSitzungWaehlen } = renderChronik()
    await waitFor(() => screen.getByText('Gestern'))
    fireEvent.click(screen.getByText('Gestern'))
    await waitFor(() => screen.getByText('hat das entschieden'))
    fireEvent.click(screen.getByText('hat das entschieden'))
    expect(onSitzungWaehlen).toHaveBeenCalledWith('alt')
    expect(store.get(storyAuswahlAtom)).toMatchObject({ art: 'konversation', queryId: 'alt-1', themaId: undefined })
  })

  it('erste Frage einer neuen Sitzung steht sofort als „laeuft" unter einer vorlaeufigen Sitzung', async () => {
    const { store } = renderChronik()
    await waitFor(() => screen.getByText('Heute'))
    store.set(storyAktiveSitzungAtom, { chatId: null, fragen: [
      { frageId: 'question-9', text: 'Was passiert mit dem Bahnhof?', createdAt: '2026-10-01T11:00:00.000Z', offen: true },
    ] })
    await waitFor(() => expect(screen.getByText('story.running')).toBeTruthy())
    // Vorlaeufige Sitzung traegt den Namen „Neue Sitzung" (neben dem Knopf) und laesst sich nicht umbenennen.
    expect(screen.getAllByText('story.newSession').length).toBe(2)
    expect(screen.getAllByRole('button', { name: 'story.renameSession' })).toHaveLength(2) // nur „Heute" und „Gestern"
    // Klick waehlt die laufende Frage ueber ihre lokale Kennung, ohne die App auf eine Sitzung umzustellen.
    fireEvent.click(screen.getByText('story.running'))
    expect(store.get(storyAuswahlAtom)).toMatchObject({ art: 'konversation', frageId: 'question-9', queryId: undefined })
  })

  it('meldet jede Auswahl nach aussen (D4: das Sheet schliesst sich mobil)', async () => {
    const onGewaehlt = vi.fn()
    const { store } = renderChronik(onGewaehlt)
    await waitFor(() => screen.getByText('heizen wir morgen'))
    fireEvent.click(screen.getByText('heizen wir morgen'))
    expect(onGewaehlt).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Verkehr' }))
    expect(onGewaehlt).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'story.topicsOverview' }))
    expect(onGewaehlt).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole('button', { name: /story.newSession/ }))
    expect(onGewaehlt).toHaveBeenCalledTimes(4)
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'uebersicht' })
  })

  it('„Themenuebersicht" und „Neue Sitzung" fuehren zur Uebersicht zurueck', async () => {
    const { store, onNeueSitzung } = renderChronik()
    store.set(storyAuswahlAtom, { art: 'thema', themaId: 'heizen' })
    fireEvent.click(screen.getByRole('button', { name: 'story.topicsOverview' }))
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'uebersicht' })

    store.set(storyAuswahlAtom, { art: 'thema', themaId: 'heizen' })
    fireEvent.click(screen.getByRole('button', { name: /story.newSession/ }))
    expect(onNeueSitzung).toHaveBeenCalledTimes(1)
    expect(store.get(storyAuswahlAtom)).toEqual({ art: 'uebersicht' })
  })
})
