/**
 * Welle F1 (ADR 0012): Sterne-ZAHL ohne Namen — die Zaehl-Stages tragen
 * keine Voter-Felder, und die Auswahl der Stages folgt Rolle und Schalter.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/mongodb-service', () => ({ getCollection: vi.fn() }))

import {
  buildFavoriteCountStages,
  waehleSterneStages,
} from '@/lib/repositories/source-user-states-count'

describe('buildFavoriteCountStages', () => {
  it('zaehlt nur und projiziert keine Voter-Felder', () => {
    const stages = buildFavoriteCountStages('lib-1')
    const text = JSON.stringify(stages)
    expect(text).toContain('favoriteCount')
    expect(text).toContain('"$count":"n"')
    expect(text).not.toContain('favoriteVoters')
    expect(text).not.toContain('isFavorite')
    expect(text).not.toContain('userEmail')
    expect(text).not.toContain('userDisplayName')
    // Hilfsfeld verschwindet wieder
    expect(stages[stages.length - 1]).toEqual({ $project: { __sterne: 0 } })
  })

  it('ohne libraryId: Fehler statt Lookup ueber alle Libraries', () => {
    expect(() => buildFavoriteCountStages('')).toThrow(/libraryId/)
  })
})

describe('waehleSterneStages', () => {
  it('Mitglied: volle Stages mit Namen und isFavorite', () => {
    const text = JSON.stringify(waehleSterneStages({ libraryId: 'lib-1', userEmail: 'a@b.c', starCountsPublic: false }))
    expect(text).toContain('favoriteVoters')
    expect(text).toContain('isFavorite')
  })

  it('Gast mit Schalter: nur die Zahl', () => {
    const text = JSON.stringify(waehleSterneStages({ libraryId: 'lib-1', userEmail: '', starCountsPublic: true }))
    expect(text).toContain('favoriteCount')
    expect(text).not.toContain('favoriteVoters')
    expect(text).not.toContain('isFavorite')
  })

  it('Gast ohne Schalter: keine Stages', () => {
    expect(waehleSterneStages({ libraryId: 'lib-1', userEmail: undefined })).toEqual([])
    expect(waehleSterneStages({ libraryId: 'lib-1', userEmail: '', starCountsPublic: false })).toEqual([])
  })
})
