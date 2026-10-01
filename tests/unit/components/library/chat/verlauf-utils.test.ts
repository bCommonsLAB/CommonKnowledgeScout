/**
 * Verlauf aus der Fragenliste (D6): Themenuebersicht und unbeantwortete
 * Eintraege fallen weg, cacheParams gehen vor Root-Feldern, Kurztitel
 * haengt an der Frage, Reihenfolge chronologisch.
 */
import { describe, it, expect } from 'vitest'
import { verlaufZuNachrichten, type VerlaufEintrag } from '@/components/library/chat/utils/verlauf-utils'

const items: VerlaufEintrag[] = [
  { queryId: 'q2', question: 'Zweite?', createdAt: '2026-10-01T11:00:00.000Z', answer: 'Antwort zwei', shortTitle: 'Zweite Frage',
    references: [{ number: 1, fileId: 'f', description: 'x' }, { kaputt: true }], suggestedQuestions: ['Und?', 7],
    answerLength: 'kurz', cacheParams: { answerLength: 'mittel', retriever: 'chunk', llmModel: 'm' } },
  { queryId: 'toc', question: 'What topics?', createdAt: '2026-10-01T09:00:00.000Z', answer: '# Themen', cacheParams: { queryType: 'toc' } },
  { queryId: 'q1', question: 'Erste?', createdAt: '2026-10-01T10:00:00.000Z', answer: 'Antwort eins' },
  { queryId: 'q3', question: 'Laeuft?', createdAt: '2026-10-01T12:00:00.000Z' },
]

describe('verlaufZuNachrichten', () => {
  it('baut Frage und Antwort je beantwortetem Eintrag, chronologisch, ohne Themenuebersicht', () => {
    const n = verlaufZuNachrichten(items)
    expect(n.map((m) => m.id)).toEqual(['q1-question', 'q1-answer', 'q2-question', 'q2-answer'])
  })

  it('cacheParams vor Root-Feldern, Kurztitel an der Frage, nur gueltige Belege und Fragen', () => {
    const n = verlaufZuNachrichten(items)
    const frage = n.find((m) => m.id === 'q2-question')
    const antwort = n.find((m) => m.id === 'q2-answer')
    expect(frage?.shortTitle).toBe('Zweite Frage')
    expect(antwort?.answerLength).toBe('mittel')
    expect(antwort?.llmModel).toBe('m')
    expect(antwort?.references).toEqual([{ number: 1, fileId: 'f', description: 'x' }])
    expect(antwort?.suggestedQuestions).toEqual(['Und?'])
  })

  it('leere Liste → keine Nachrichten', () => {
    expect(verlaufZuNachrichten([])).toEqual([])
  })
})
