/**
 * @fileoverview Cache-Suche bei automatischer Antwortsprache (Befund 24.11.2026)
 *
 * @description
 * Die Startseite fragt mit `targetLanguage: 'global'` (Sprache der Oberflaeche). Gespeichert
 * wird das Log mit der aufgeloesten Sprache, die Stream-Route rechnet ihren Hash ebenso
 * (`uiLocale`). Die Suche rechnete OHNE `uiLocale` neu und fand deshalb nie etwas: jede
 * Themenuebersicht und jede Frage der Startseite wurde bei jedem Laden neu berechnet.
 * Jetzt sucht sie mit dem Hash des Aufrufers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const findOne = vi.hoisted(() => vi.fn())
const ladeKontext = vi.hoisted(() => vi.fn())
vi.mock('@/lib/mongodb-service', () => ({
  getCollection: async () => ({ findOne, createIndex: async () => 'ok' }),
}))
vi.mock('@/lib/chat/loader', () => ({ loadLibraryChatContext: ladeKontext }))
vi.mock('@/lib/repositories/vector-repo', () => ({ getCollectionNameForLibrary: () => 'c', getCollectionOnly: async () => ({ countDocuments: async () => 3 }) }))

import { findQueryByQuestionAndContext } from '@/lib/db/queries-repo'
import { buildCacheHashParams } from '@/lib/chat/utils/cache-hash-builder'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'

const BASIS = { libraryId: 'lib-1', question: 'Welche Themen?', queryType: 'toc' as const, answerLength: 'ausführlich', retriever: 'summary', documentCount: 3, llmModel: 'm' }

beforeEach(() => { findOne.mockReset(); ladeKontext.mockReset() })

describe('Cache-Hash und Sprache der Oberflaeche', () => {
  it("'global' mit Locale ergibt denselben Hash wie die aufgeloeste Sprache — ohne Locale einen anderen", async () => {
    const mitLocale = createCacheHash(await buildCacheHashParams({ ...BASIS, targetLanguage: 'global', uiLocale: 'de' }))
    const aufgeloest = createCacheHash(await buildCacheHashParams({ ...BASIS, targetLanguage: 'de' }))
    const ohneLocale = createCacheHash(await buildCacheHashParams({ ...BASIS, targetLanguage: 'global' }))
    expect(mitLocale).toBe(aufgeloest)
    expect(ohneLocale).not.toBe(aufgeloest)
  })
})

describe('findQueryByQuestionAndContext mit cacheHash', () => {
  it('sucht mit genau dem uebergebenen Hash und rechnet nicht neu', async () => {
    findOne.mockResolvedValue({ queryId: 'q1', answer: 'x' })
    const treffer = await findQueryByQuestionAndContext({ libraryId: 'lib-1', question: 'Welche Themen?', targetLanguage: 'global', cacheHash: 'abc123' })
    expect(treffer?.queryId).toBe('q1')
    expect(findOne).toHaveBeenCalledTimes(1)
    expect(findOne.mock.calls[0][0]).toMatchObject({ cacheHash: 'abc123', libraryId: 'lib-1', cacheInvalidatedAt: null })
    expect(ladeKontext).not.toHaveBeenCalled()
  })

  it('kein Treffer ergibt null; ein leerer Hash ist ein Fehler, kein stilles Weitersuchen', async () => {
    findOne.mockResolvedValue(null)
    expect(await findQueryByQuestionAndContext({ libraryId: 'lib-1', question: 'x', cacheHash: 'abc123' })).toBeNull()
    await expect(findQueryByQuestionAndContext({ libraryId: 'lib-1', question: 'x', cacheHash: '' })).rejects.toThrow(/Leerer cacheHash/)
  })
})
