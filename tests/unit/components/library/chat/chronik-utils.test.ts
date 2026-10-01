import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/components/library/chat/utils/chat-utils'
import {
  fragenAusVerlauf,
  konversationAuswaehlen,
  neueFrage,
} from '@/components/library/chat/utils/chronik-utils'

const t = '2026-10-01T10:00:00.000Z'
const verlauf: ChatMessage[] = [
  { id: 'q1-question', type: 'question', content: 'Erste Frage?', queryId: 'q1', createdAt: t },
  { id: 'q1-answer', type: 'answer', content: 'Antwort eins', queryId: 'q1', createdAt: t },
  { id: 'question-1700', type: 'question', content: 'Zweite, laeuft noch?', createdAt: t },
]

describe('fragenAusVerlauf', () => {
  it('eine Frage je Konversation, die laufende als offen', () => {
    expect(fragenAusVerlauf(verlauf, true)).toEqual([
      { queryId: 'q1', frageId: 'q1-question', text: 'Erste Frage?', createdAt: t, offen: false },
      { queryId: undefined, frageId: 'question-1700', text: 'Zweite, laeuft noch?', createdAt: t, offen: true },
    ])
  })

  it('ohne laufenden Stream ist nichts offen — eine abgebrochene Frage bleibt stehen, nicht „laeuft"', () => {
    expect(fragenAusVerlauf(verlauf, false).map((f) => f.offen)).toEqual([false, false])
  })
})

describe('konversationAuswaehlen', () => {
  it('liefert Frage und Antwort der gewaehlten queryId', () => {
    expect(konversationAuswaehlen(verlauf, { art: 'konversation', queryId: 'q1' }).map((m) => m.id)).toEqual([
      'q1-question',
      'q1-answer',
    ])
  })

  it('findet eine laufende Frage ueber ihre lokale Kennung', () => {
    expect(konversationAuswaehlen(verlauf, { art: 'konversation', frageId: 'question-1700' }).map((m) => m.id)).toEqual([
      'question-1700',
    ])
  })

  it('haengt die Antwort an, sobald die Frage ihre queryId bekommen hat', () => {
    const fertig: ChatMessage[] = [
      { ...verlauf[2], queryId: 'q2' },
      { id: 'q2-answer', type: 'answer', content: 'Antwort zwei', queryId: 'q2', createdAt: t },
    ]
    expect(konversationAuswaehlen(fertig, { art: 'konversation', frageId: 'question-1700' }).map((m) => m.id)).toEqual([
      'question-1700',
      'q2-answer',
    ])
  })

  it('leer, wenn die Auswahl keine Konversation ist oder nichts passt', () => {
    expect(konversationAuswaehlen(verlauf, { art: 'uebersicht' })).toEqual([])
    expect(konversationAuswaehlen(verlauf, { art: 'konversation', queryId: 'fremd' })).toEqual([])
  })
})

describe('neueFrage', () => {
  it('erkennt genau eine neu gesendete Frage', () => {
    expect(neueFrage(2, verlauf)?.id).toBe('question-1700')
  })

  it('ignoriert Verlaufs-Laden (viele auf einmal) und neue Antworten', () => {
    expect(neueFrage(0, verlauf)).toBeNull()
    expect(neueFrage(1, verlauf.slice(0, 2))).toBeNull()
  })
})
