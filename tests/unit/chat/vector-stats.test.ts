/**
 * Characterization Tests fuer src/lib/chat/vector-stats.ts.
 * Welle 2.3 Schritt 3 — pure Funktion.
 */

import { describe, expect, it } from 'vitest'
import { accumulateVectorStats } from '@/lib/chat/vector-stats'

describe('accumulateVectorStats', () => {
  it('liefert Nullen bei leerem Array', () => {
    expect(accumulateVectorStats([])).toEqual({
      doc: 0,
      chapterSummary: 0,
      chunk: 0,
      uniqueDocs: 0,
    })
  })

  it('zaehlt nach kind', () => {
    const r = accumulateVectorStats([
      { id: '1', metadata: { kind: 'doc', fileId: 'a' } },
      { id: '2', metadata: { kind: 'chapterSummary', fileId: 'a' } },
      { id: '3', metadata: { kind: 'chunk', fileId: 'a' } },
      { id: '4', metadata: { kind: 'chunk', fileId: 'b' } },
    ])
    expect(r.doc).toBe(1)
    expect(r.chapterSummary).toBe(1)
    expect(r.chunk).toBe(2)
    expect(r.uniqueDocs).toBe(2)
  })

  it('ignoriert unbekannte kind-Werte', () => {
    const r = accumulateVectorStats([
      { id: '1', metadata: { kind: 'andere', fileId: 'a' } },
      { id: '2', metadata: { kind: 'chunk', fileId: 'a' } },
    ])
    expect(r.chunk).toBe(1)
    expect(r.doc).toBe(0)
    expect(r.uniqueDocs).toBe(1)
  })

  it('zaehlt uniqueDocs auch ohne kind-Vermerk', () => {
    const r = accumulateVectorStats([
      { id: '1', metadata: { fileId: 'a' } },
      { id: '2', metadata: { fileId: 'b' } },
      { id: '3', metadata: { fileId: 'a' } }, // duplikat
    ])
    expect(r.uniqueDocs).toBe(2)
    expect(r.chunk).toBe(0)
  })

  it('robust gegen fehlende metadata', () => {
    const r = accumulateVectorStats([
      { id: '1' },
      { id: '2', metadata: undefined as never },
    ])
    expect(r.uniqueDocs).toBe(0)
    expect(r.chunk).toBe(0)
  })
})
