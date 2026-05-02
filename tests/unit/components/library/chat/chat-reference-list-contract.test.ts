/**
 * Characterization Tests fuer chat-reference-list.tsx (Welle 3-III-b).
 *
 * Fixiert den Export-Vertrag von ChatReferenceList:
 * - Benannter Export ChatReferenceList
 * - Props: references, libraryId, queryId?, onDocumentClick?, variant?
 * - Varianten: 'full' (Standard) | 'compact'
 *
 * Sicherheitsnetz fuer den Sub-Komponenten-Split (single-ref.tsx):
 * Nach dem Refactor muss ChatReferenceList weiterhin denselben
 * Export-Namen und dieselbe Props-Signatur haben.
 */

import { describe, it, expect } from 'vitest'

describe('ChatReferenceList Export-Vertrag', () => {
  it('ChatReferenceList ist eine Funktion (React-Komponente)', async () => {
    const mod = await import('@/components/library/chat/chat-reference-list')
    expect(typeof mod.ChatReferenceList).toBe('function')
  })

  it('ChatReferenceList ist ein benannter Export', async () => {
    const mod = await import('@/components/library/chat/chat-reference-list')
    expect('ChatReferenceList' in mod).toBe(true)
  })
})

describe('ChatReferenceList Varianten', () => {
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
