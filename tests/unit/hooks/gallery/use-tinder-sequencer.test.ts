// @vitest-environment jsdom

/**
 * Unit-Tests fuer `useTinderSequencer` (Welle C).
 *
 * Sicherheitsnetz fuer:
 * - Reduktion auf "noch nicht bewertete" Quellen wenn `onlyUnrated`
 * - Aktueller Doc bleibt in der Sequenz, auch wenn schon bewertet
 * - prev/next-Navigation
 * - Counter (favorite/notImportant/unrated) immer ueber Gesamtliste
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTinderSequencer } from '@/hooks/gallery/use-tinder-sequencer'
import type { DocCardMeta } from '@/lib/gallery/types'

function makeDoc(id: string): DocCardMeta {
  return { id, fileId: id, title: id, fileName: id } as DocCardMeta
}

describe('useTinderSequencer', () => {
  const docs = [makeDoc('a'), makeDoc('b'), makeDoc('c'), makeDoc('d'), makeDoc('e')]

  it('liefert volle Sequenz wenn onlyUnrated=false', () => {
    const { result } = renderHook(() =>
      useTinderSequencer({
        docs,
        currentFileId: 'b',
        isFavorite: () => false,
        isNotImportant: () => false,
        onlyUnrated: false,
      }),
    )
    expect(result.current.total).toBe(5)
    expect(result.current.index).toBe(1)
    expect(result.current.prevDoc?.fileId).toBe('a')
    expect(result.current.nextDoc?.fileId).toBe('c')
    expect(result.current.unratedCount).toBe(5)
  })

  it('reduziert Sequenz auf Unrated, behaelt aber den aktuellen Doc', () => {
    const favorites = new Set(['a', 'c'])
    const notImp = new Set(['e'])
    const { result } = renderHook(() =>
      useTinderSequencer({
        docs,
        currentFileId: 'a', // bereits "favorite", soll trotzdem bleiben
        isFavorite: (id) => favorites.has(id),
        isNotImportant: (id) => notImp.has(id),
        onlyUnrated: true,
      }),
    )
    // Sequenz sollte enthalten: a (current), b (unrated), d (unrated)
    expect(result.current.total).toBe(3)
    expect(result.current.index).toBe(0)
    expect(result.current.nextDoc?.fileId).toBe('b')
    expect(result.current.prevDoc).toBeNull()
    // Counter bleibt ueber gesamte Liste
    expect(result.current.favoriteCount).toBe(2)
    expect(result.current.notImportantCount).toBe(1)
    expect(result.current.unratedCount).toBe(2)
  })

  it('gibt nextDoc=null am Ende zurueck', () => {
    const { result } = renderHook(() =>
      useTinderSequencer({
        docs,
        currentFileId: 'e',
        isFavorite: () => false,
        isNotImportant: () => false,
        onlyUnrated: false,
      }),
    )
    expect(result.current.nextDoc).toBeNull()
    expect(result.current.prevDoc?.fileId).toBe('d')
  })

  it('prevDoc=null wenn aktueller Doc nicht in der reduzierten Sequenz waere', () => {
    // currentFileId fehlt komplett - sequenz wird leer/keinen index haben
    const { result } = renderHook(() =>
      useTinderSequencer({
        docs,
        currentFileId: 'unknown',
        isFavorite: () => false,
        isNotImportant: () => false,
        onlyUnrated: true,
      }),
    )
    expect(result.current.index).toBe(-1)
    expect(result.current.prevDoc).toBeNull()
    expect(result.current.nextDoc).toBeNull()
  })

  it('leere docs-Liste fuehrt zu total=0', () => {
    const { result } = renderHook(() =>
      useTinderSequencer({
        docs: [],
        currentFileId: 'a',
        isFavorite: () => false,
        isNotImportant: () => false,
        onlyUnrated: false,
      }),
    )
    expect(result.current.total).toBe(0)
    expect(result.current.unratedCount).toBe(0)
    expect(result.current.favoriteCount).toBe(0)
    expect(result.current.notImportantCount).toBe(0)
  })
})
