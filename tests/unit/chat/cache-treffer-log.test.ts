/**
 * @fileoverview D12b: Ein Cache-Treffer auf eine Frage bekommt ein eigenes
 * Query-Log in der Sitzung der Person — mit Antwort, Belegen, Vorschlaegen
 * und Kurztitel aus dem Treffer, einem Cache-Schritt mit dessen Kennung und
 * Status `ok`. Vorher fehlte die Frage nach dem Neuladen im Verlauf.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  startQueryLog: vi.fn(),
  appendRetrievalStep: vi.fn(),
  updateQueryLogPartial: vi.fn(),
}))

vi.mock('@/lib/logging/query-logger', () => ({
  startQueryLog: h.startQueryLog,
  appendRetrievalStep: h.appendRetrievalStep,
}))
vi.mock('@/lib/db/queries-repo', () => ({ updateQueryLogPartial: h.updateQueryLogPartial }))

import { eigenesLogFuerCacheTreffer } from '@/lib/chat/cache-treffer-log'

const rahmen = {
  libraryId: 'lib',
  chatId: 'chat-1',
  userEmail: 'a@x.de',
  question: 'Was wurde beschlossen?',
  mode: 'chunks' as const,
  answerLength: 'mittel' as const,
  retriever: 'chunk' as const,
  documentCount: 42,
  llmModel: 'modell-x',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.startQueryLog.mockResolvedValue('eigene-id')
  h.appendRetrievalStep.mockResolvedValue(undefined)
  h.updateQueryLogPartial.mockResolvedValue(undefined)
})

describe('eigenesLogFuerCacheTreffer', () => {
  it('legt ein Frage-Log im Rahmen der Person an und uebernimmt die Antwort des Treffers', async () => {
    const id = await eigenesLogFuerCacheTreffer({
      rahmen,
      treffer: {
        queryId: 'fremde-id',
        answer: 'Antwort ①',
        references: [{ number: 1, fileName: 'a.md', fileId: 'f1', description: '' }],
        suggestedQuestions: ['Und dann?'],
        shortTitle: 'Beschluss',
      },
      cacheHash: 'hash-1',
      documentCount: 42,
      protokoll: (eigeneId) => [{ type: 'cache_check_complete', found: true, queryId: eigeneId }],
    })

    expect(id).toBe('eigene-id')
    expect(h.startQueryLog).toHaveBeenCalledWith({ ...rahmen, queryType: 'question' })

    const [schrittId, schritt] = h.appendRetrievalStep.mock.calls[0]
    expect(schrittId).toBe('eigene-id')
    expect(schritt).toMatchObject({ stage: 'cache_check', cacheFound: true, cachedQueryId: 'fremde-id', cacheHash: 'hash-1', documentCount: 42 })

    const [updateId, felder] = h.updateQueryLogPartial.mock.calls[0]
    expect(updateId).toBe('eigene-id')
    expect(felder).toEqual({
      status: 'ok',
      answer: 'Antwort ①',
      references: [{ number: 1, fileName: 'a.md', fileId: 'f1', description: '' }],
      suggestedQuestions: ['Und dann?'],
      shortTitle: 'Beschluss',
      processingLogs: [{ type: 'cache_check_complete', found: true, queryId: 'eigene-id' }],
    })
  })

  it('laesst den Kurztitel weg, wenn der Treffer keinen hat (alte Logs)', async () => {
    await eigenesLogFuerCacheTreffer({
      rahmen,
      treffer: { queryId: 'fremde-id', answer: 'A' },
      protokoll: () => [],
    })
    const felder = h.updateQueryLogPartial.mock.calls[0][1]
    expect(felder).not.toHaveProperty('shortTitle')
    expect(felder.references).toEqual([])
    expect(felder.suggestedQuestions).toEqual([])
  })

  it('reicht einen Fehler beim Anlegen durch — kein stilles Weiter', async () => {
    h.startQueryLog.mockRejectedValueOnce(new Error('Entweder userEmail oder sessionId muss angegeben werden'))
    await expect(
      eigenesLogFuerCacheTreffer({ rahmen: { ...rahmen, userEmail: undefined }, treffer: { queryId: 'x', answer: 'A' }, protokoll: () => [] }),
    ).rejects.toThrow(/userEmail oder sessionId/)
    expect(h.updateQueryLogPartial).not.toHaveBeenCalled()
  })
})
