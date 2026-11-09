/**
 * Aktualitaet eines Eintrags (chat-contracts §5): Hash aus den gespeicherten
 * cacheParams mit den HEUTIGEN Werten neu rechnen. Gleiche Werte → aktuell;
 * andere Antwortregeln, anderer Facetten-Kontext oder andere Dokumentzahl →
 * veraltet; ohne Hash/Parameter → unbekannt.
 */
import { describe, it, expect } from 'vitest'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'
import { aktualitaetAusParams } from '@/lib/chat/utils/cache-aktualitaet-regel'
import type { CacheParams } from '@/types/query-log'

const params: CacheParams = {
  libraryId: 'lib-1',
  question: 'Was wurde beschlossen?',
  queryType: 'question',
  answerLength: 'mittel',
  targetLanguage: 'de',
  character: [],
  accessPerspective: [],
  socialContext: 'formal',
  genderInclusive: false,
  retriever: 'chunk',
  facetsSelected: { jahr: ['2026'] },
  documentCount: 42,
  llmModel: 'modell-x',
  antwortregeln: 'Antworte knapp.',
  facettenKontext: 'jahr: Jahr',
}
const eintrag = { cacheHash: createCacheHash(params), cacheParams: params }
const heute = { documentCount: 42, antwortregeln: 'Antworte knapp.', facettenKontext: 'jahr: Jahr' }

describe('aktualitaetAusParams', () => {
  it('ist aktuell, wenn Dokumentzahl, Antwortregeln und Facetten-Kontext unveraendert sind', () => {
    expect(aktualitaetAusParams(eintrag, heute)).toBe('aktuell')
  })

  it('ist veraltet bei geaenderten Antwortregeln, Facetten-Kontext oder Dokumentzahl', () => {
    expect(aktualitaetAusParams(eintrag, { ...heute, antwortregeln: 'Antworte ausfuehrlich.' })).toBe('veraltet')
    expect(aktualitaetAusParams(eintrag, { ...heute, facettenKontext: 'jahr: Erscheinungsjahr' })).toBe('veraltet')
    expect(aktualitaetAusParams(eintrag, { ...heute, documentCount: 43 })).toBe('veraltet')
  })

  it('behandelt leere Antwortregeln wie fehlende (Hash-Regel von createCacheHash)', () => {
    const ohne: CacheParams = { ...params, antwortregeln: undefined }
    const e = { cacheHash: createCacheHash(ohne), cacheParams: ohne }
    expect(aktualitaetAusParams(e, { ...heute, antwortregeln: '' })).toBe('aktuell')
    expect(aktualitaetAusParams(e, { ...heute, antwortregeln: undefined })).toBe('aktuell')
  })

  it('ist unbekannt ohne Hash oder ohne Cache-Parameter', () => {
    expect(aktualitaetAusParams({ cacheHash: null, cacheParams: params }, heute)).toBe('unbekannt')
    expect(aktualitaetAusParams({ cacheHash: 'abc', cacheParams: null }, heute)).toBe('unbekannt')
  })
})
