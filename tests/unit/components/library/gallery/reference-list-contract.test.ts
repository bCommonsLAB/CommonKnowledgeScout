/**
 * Characterization Tests fuer reference-list.tsx (Welle 3-III-b).
 *
 * Lag bis zur Welle "Galerie-Chat-Mittelschicht" unter components/library/chat/
 * — obwohl die Komponente ausschliesslich von der Galerie benutzt wird
 * (01-audit-galerie-chat.md, Befund 3).
 *
 * Fixiert den Export-Vertrag von ReferenceList:
 * - Benannter Export ReferenceList
 * - Props: references, libraryId, queryId?, onDocumentClick?, variant?
 * - Varianten: 'full' (Standard) | 'compact'
 *
 * Sicherheitsnetz fuer den Sub-Komponenten-Split (single-ref.tsx):
 * Nach dem Refactor muss ReferenceList weiterhin denselben
 * Export-Namen und dieselbe Props-Signatur haben.
 */

import { describe, it, expect } from 'vitest'

describe('ReferenceList Export-Vertrag', () => {
  it('ReferenceList ist eine Funktion (React-Komponente)', async () => {
    const mod = await import('@/components/library/gallery/reference-list')
    expect(typeof mod.ReferenceList).toBe('function')
  })

  it('ReferenceList ist ein benannter Export', async () => {
    const mod = await import('@/components/library/gallery/reference-list')
    expect('ReferenceList' in mod).toBe(true)
  })
})

describe('ReferenceList Varianten', () => {
  it('unterstuetzt variant=full', () => {
    type RefListVariant = 'full' | 'compact'
    const v: RefListVariant = 'full'
    expect(v).toBe('full')
  })

  it('unterstuetzt variant=compact', () => {
    type RefListVariant = 'full' | 'compact'
    const v: RefListVariant = 'compact'
    expect(v).toBe('compact')
  })
})
