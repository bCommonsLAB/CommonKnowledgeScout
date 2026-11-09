/**
 * Verwerfen statt loeschen (chat-contracts §5): Ein Eintrag mit
 * `cacheInvalidatedAt` ist kein Cache-Treffer mehr; der Mongo-Filter nimmt
 * fehlende UND null-Werte als „nicht verworfen", damit alte Eintraege ohne
 * das Feld Treffer bleiben.
 */
import { describe, it, expect } from 'vitest'
import { cacheTrefferFilter, istCacheTreffer } from '@/lib/db/query-cache-regel'
import type { StoryTopicsData } from '@/types/story-topics'

describe('istCacheTreffer', () => {
  it('nimmt eine nicht-leere Antwort oder eine Themenuebersicht als Treffer', () => {
    expect(istCacheTreffer({ answer: 'Antwort' })).toBe(true)
    expect(istCacheTreffer({ storyTopicsData: { topics: [] } as unknown as StoryTopicsData })).toBe(true)
  })

  it('lehnt leere Antworten und Eintraege ohne beides ab', () => {
    expect(istCacheTreffer({ answer: '   ' })).toBe(false)
    expect(istCacheTreffer({})).toBe(false)
  })

  it('ist NIE ein Treffer, sobald cacheInvalidatedAt gesetzt ist', () => {
    expect(istCacheTreffer({ answer: 'Antwort', cacheInvalidatedAt: new Date('2026-11-09T10:00:00Z') })).toBe(false)
    expect(istCacheTreffer({ storyTopicsData: {} as StoryTopicsData, cacheInvalidatedAt: new Date() })).toBe(false)
  })

  it('bleibt Treffer, wenn das Feld fehlt oder null ist (alte Eintraege)', () => {
    expect(istCacheTreffer({ answer: 'A', cacheInvalidatedAt: undefined })).toBe(true)
    expect(istCacheTreffer({ answer: 'A', cacheInvalidatedAt: null as unknown as Date })).toBe(true)
  })
})

describe('cacheTrefferFilter', () => {
  it('filtert nach Hash, Library, Antwort/Uebersicht und NICHT verworfen', () => {
    const f = cacheTrefferFilter('hash-1', 'lib-1')
    expect(f).toMatchObject({ cacheHash: 'hash-1', libraryId: 'lib-1', cacheInvalidatedAt: null })
    expect(Array.isArray(f.$or)).toBe(true)
  })
})
