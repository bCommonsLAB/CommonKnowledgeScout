/**
 * Characterization Tests fuer Pure-Helpers in
 * `src/components/library/chat/utils/chat-utils.ts` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-b (Chat-Modul-Split). Fixiert den
 * deterministischen Vertrag von:
 * - createMessagesFromQueryLog: QueryLog → ChatMessage[] (Frage+Antwort)
 * - groupMessagesToConversations: ChatMessage[] → ConversationPair[]
 *
 * Fuer beide Funktionen gilt: 1:1-portierter Code aus Bestand,
 * Verhalten darf in Sub-Wellen NICHT veraendert werden.
 */

import { describe, it, expect } from 'vitest'
import {
  createMessagesFromQueryLog,
  groupMessagesToConversations,
  type ChatMessage,
} from '@/components/library/chat/utils/chat-utils'

describe('createMessagesFromQueryLog', () => {
  it('liefert genau eine Question-Message, wenn keine Antwort vorhanden ist', () => {
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Was ist Klimaschutz?',
      createdAt: '2026-01-01T10:00:00Z',
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'q-1-question',
      type: 'question',
      content: 'Was ist Klimaschutz?',
      queryId: 'q-1',
    })
  })

  it('liefert Question + Answer, wenn Antwort vorhanden ist', () => {
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Was ist Klimaschutz?',
      answer: 'Klimaschutz ist ...',
      createdAt: '2026-01-01T10:00:00Z',
    })
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('question')
    expect(result[1].type).toBe('answer')
    expect(result[1].id).toBe('q-1-answer')
    expect(result[1].content).toBe('Klimaschutz ist ...')
  })

  it('konvertiert Date-Objekt zu ISO-String in createdAt', () => {
    const date = new Date('2026-01-01T10:00:00Z')
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Test?',
      createdAt: date,
    })
    expect(result[0].createdAt).toBe(date.toISOString())
  })

  it('bevorzugt cacheParams gegenueber Root-Feldern bei Cache-relevanten Werten', () => {
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Test?',
      createdAt: '2026-01-01T10:00:00Z',
      answerLength: 'short',
      cacheParams: {
        answerLength: 'long',
      },
    })
    expect(result[0].answerLength).toBe('long')
  })

  it('faellt auf Root-Felder zurueck, wenn cacheParams fehlt', () => {
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Test?',
      createdAt: '2026-01-01T10:00:00Z',
      answerLength: 'short',
    })
    expect(result[0].answerLength).toBe('short')
  })

  it('filtert nicht-string Eintraege aus suggestedQuestions', () => {
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Test?',
      answer: 'Antwort',
      // simuliertes Legacy-Datenformat — nicht-strings werden gefiltert
      suggestedQuestions: ['Frage 1', 42 as unknown as string, null as unknown as string, 'Frage 2'],
      createdAt: '2026-01-01T10:00:00Z',
    })
    const answer = result.find((m) => m.type === 'answer')
    expect(answer?.suggestedQuestions).toEqual(['Frage 1', 'Frage 2'])
  })

  it('liefert leeres references-Array, wenn references kein Array ist', () => {
    const result = createMessagesFromQueryLog({
      queryId: 'q-1',
      question: 'Test?',
      answer: 'Antwort',
      // Defekte Bestands-Daten: references ist null
      references: null as unknown as undefined,
      createdAt: '2026-01-01T10:00:00Z',
    })
    const answer = result.find((m) => m.type === 'answer')
    expect(answer?.references).toEqual([])
  })
})

describe('groupMessagesToConversations', () => {
  it('liefert ein leeres Array bei leerem Input', () => {
    expect(groupMessagesToConversations([])).toEqual([])
  })

  it('paart Question + Answer zu einer ConversationPair', () => {
    const messages: ChatMessage[] = [
      {
        id: 'q-1-question',
        type: 'question',
        content: 'Frage',
        queryId: 'q-1',
        createdAt: '2026-01-01T10:00:00Z',
      },
      {
        id: 'q-1-answer',
        type: 'answer',
        content: 'Antwort',
        queryId: 'q-1',
        createdAt: '2026-01-01T10:00:01Z',
      },
    ]
    const result = groupMessagesToConversations(messages)
    expect(result).toHaveLength(1)
    expect(result[0].question.id).toBe('q-1-question')
    expect(result[0].answer?.id).toBe('q-1-answer')
  })

  it('liefert ConversationPair ohne Antwort, wenn nur Frage vorhanden', () => {
    const messages: ChatMessage[] = [
      {
        id: 'q-1-question',
        type: 'question',
        content: 'Frage',
        queryId: 'q-1',
        createdAt: '2026-01-01T10:00:00Z',
      },
    ]
    const result = groupMessagesToConversations(messages)
    expect(result).toHaveLength(1)
    expect(result[0].answer).toBeUndefined()
  })

  it('paart mehrere Conversations korrekt nacheinander', () => {
    const messages: ChatMessage[] = [
      { id: 'a-question', type: 'question', content: 'F1', queryId: 'a', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'a-answer', type: 'answer', content: 'A1', queryId: 'a', createdAt: '2026-01-01T10:00:01Z' },
      { id: 'b-question', type: 'question', content: 'F2', queryId: 'b', createdAt: '2026-01-01T10:01:00Z' },
      { id: 'b-answer', type: 'answer', content: 'A2', queryId: 'b', createdAt: '2026-01-01T10:01:01Z' },
    ]
    const result = groupMessagesToConversations(messages)
    expect(result).toHaveLength(2)
    expect(result[0].question.id).toBe('a-question')
    expect(result[1].question.id).toBe('b-question')
  })

  it('verwendet eindeutige conversationIds (queryId+message-id), wenn queryId vorhanden', () => {
    const messages: ChatMessage[] = [
      { id: 'q-1-question', type: 'question', content: 'F', queryId: 'q-1', createdAt: '2026-01-01T10:00:00Z' },
    ]
    const result = groupMessagesToConversations(messages)
    expect(result[0].conversationId).toBe('q-1-q-1-question')
  })
})
