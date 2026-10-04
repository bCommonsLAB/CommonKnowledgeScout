/**
 * Reine Helfer der Konversation im Story-Paket (D6b): Fragenliste → Nachrichten,
 * Paare, Chronik-Fragen, Auswahl, Mischen mit lokalen Nachrichten, SSE-Zeilen
 * und die Anfrage an den Stream.
 */
import { describe, it, expect, vi } from 'vitest'
import { STORY_TOC_QUESTION } from '@ks/contracts'
import {
  fehlerText,
  fragenAusVerlauf,
  gespraechsverlauf,
  konversationAuswaehlen,
  paare,
  sseSchritte,
  streamAdresse,
  streamKoerper,
  verlaufMischen,
  verlaufZuNachrichten,
  type Nachricht,
  type Perspektive,
} from '@ks/module-story/react'
import { TOC_QUESTION } from '@/lib/chat/constants'

const perspektive: Perspektive = {
  targetLanguage: 'de', character: ['technical', 'ecology'], accessPerspective: [], socialContext: 'general', genderInclusive: true, llmModel: 'google/gemini-2.5-flash',
}

const liste = [
  { queryId: 'q1', question: 'Was kostet es?', shortTitle: 'Kosten', createdAt: '2026-10-01T10:00:00.000Z', answer: 'Viel [1].', references: [{ number: 1, fileId: 'f-a', description: 'A' }, { kaputt: true }], suggestedQuestions: ['Und dann?', 7] },
  { queryId: 'q0', question: 'Themen?', createdAt: '2026-10-01T09:00:00.000Z', answer: 'Themen …', cacheParams: { queryType: 'toc' } },
  { queryId: 'q2', question: 'Offen', createdAt: '2026-10-01T11:00:00.000Z' },
  { queryId: 'q-alt', question: 'Aeltere Frage', createdAt: '2026-10-01T08:00:00.000Z', answer: 'Alt.' },
]

describe('verlaufZuNachrichten / paare', () => {
  it('nimmt nur beantwortete Fragen ohne Themenuebersicht, chronologisch, mit Belegen und Kurztitel', () => {
    const n = verlaufZuNachrichten(liste)
    expect(n.map((m) => [m.art, m.queryId])).toEqual([
      ['frage', 'q-alt'], ['antwort', 'q-alt'], ['frage', 'q1'], ['antwort', 'q1'],
    ])
    expect(n[2].kurztitel).toBe('Kosten')
    expect(n[3].belege).toEqual([{ number: 1, fileId: 'f-a', description: 'A' }])
    expect(n[3].anschlussfragen).toEqual(['Und dann?'])
    const p = paare(n)
    expect(p.map((x) => x.kennung)).toEqual(['q-alt-q-alt-question', 'q1-q1-question'])
  })

  it('eine laufende Frage ohne Kennung bildet ein Paar ohne Antwort', () => {
    const n: Nachricht[] = [{ id: 'question-1', art: 'frage', text: 'Neu', createdAt: '2026-10-01T12:00:00.000Z' }]
    expect(paare(n)).toEqual([{ kennung: 'question-1', frage: n[0], antwort: undefined }])
    expect(fragenAusVerlauf(n, true)[0].offen).toBe(true)
    expect(fragenAusVerlauf(n, false)[0].offen).toBe(false)
  })
})

describe('konversationAuswaehlen / verlaufMischen', () => {
  const n = verlaufZuNachrichten(liste)
  it('waehlt Frage und Antwort ueber queryId oder lokale Kennung', () => {
    expect(konversationAuswaehlen(n, { art: 'konversation', queryId: 'q1' }).map((m) => m.id)).toEqual(['q1-question', 'q1-answer'])
    expect(konversationAuswaehlen(n, { art: 'konversation', frageId: 'q-alt-question' })).toHaveLength(2)
    expect(konversationAuswaehlen(n, { art: 'konversation', queryId: 'nix' })).toEqual([])
    expect(konversationAuswaehlen(n, { art: 'uebersicht' })).toEqual([])
  })

  it('behaelt lokale Nachrichten ohne gespeicherte Kennung und sortiert chronologisch', () => {
    const lokal: Nachricht[] = [
      { id: 'question-9', art: 'frage', text: 'Laeuft', createdAt: '2026-10-01T12:00:00.000Z' },
      { id: 'q1-question', art: 'frage', text: 'doppelt', createdAt: '2026-10-01T10:00:00.000Z', queryId: 'q1' },
    ]
    const gemischt = verlaufMischen(lokal, n)
    expect(gemischt.map((m) => m.id)).toEqual(['q-alt-question', 'q-alt-answer', 'q1-question', 'q1-answer', 'question-9'])
    expect(verlaufMischen(lokal, [])).toBe(lokal)
  })
})

describe('sseSchritte', () => {
  it('liest vollstaendige Zeilen, puffert den Rest, meldet kaputte Zeilen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const [a, rest] = sseSchritte('data: {"type":"llm_start","model":"m"}\ndata: kaputt\ndata: {"type":"comp', '')
    expect(a).toEqual([{ type: 'llm_start', model: 'm' }])
    expect(rest).toBe('data: {"type":"comp')
    expect(warn).toHaveBeenCalledTimes(1)
    const [b, rest2] = sseSchritte('lete","answer":"x"}\n\n', rest)
    expect(b).toEqual([{ type: 'complete', answer: 'x' }])
    expect(rest2).toBe('')
    warn.mockRestore()
  })
})

describe('Anfrage an den Stream', () => {
  it('Adresse traegt Perspektive, Modell, Temperatur und Filter; die Themenfrage ist die der App', () => {
    const url = streamAdresse('lib/1', { perspektive, antwortLaenge: 'kurz', filter: { jahr: ['2024', '2025'] }, chatId: null })
    const u = new URL(url, 'http://x')
    expect(u.pathname).toBe('/api/chat/lib%2F1/stream')
    expect(u.searchParams.getAll('jahr')).toEqual(['2024', '2025'])
    expect(u.searchParams.get('character')).toBe('technical,ecology')
    expect(u.searchParams.get('accessPerspective')).toBe('')
    expect(u.searchParams.get('llmModel')).toBe('google/gemini-2.5-flash')
    expect(u.searchParams.get('llmTemperature')).toBe('0.3')
    expect(TOC_QUESTION).toBe(STORY_TOC_QUESTION)
  })

  it('Koerper: Frage, Laenge, bis fuenf Paare Verlauf, Sitzung, Cache-Umgehung', () => {
    const n = verlaufZuNachrichten(liste)
    expect(gespraechsverlauf(n)).toEqual([{ question: 'Aeltere Frage', answer: 'Alt.' }, { question: 'Was kostet es?', answer: 'Viel [1].' }])
    expect(streamKoerper('Neu?', { perspektive, antwortLaenge: 'mittel', chatId: 'c1' }, n, { ohneCache: true })).toEqual({
      message: 'Neu?', answerLength: 'mittel', chatHistory: gespraechsverlauf(n), chatId: 'c1', skipQueryCache: true,
    })
    expect(streamKoerper('Neu?', { perspektive, antwortLaenge: 'mittel', chatId: null }, [])).toEqual({ message: 'Neu?', answerLength: 'mittel' })
  })

  it('Fehlertext maskiert Schluessel und kuerzt', () => {
    expect(fehlerText('Error: invalid_api_key')).toMatch(/API-Schlüssel/)
    expect(fehlerText('x'.repeat(300))).toHaveLength(200)
  })
})
