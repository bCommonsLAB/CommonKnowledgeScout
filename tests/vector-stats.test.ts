import { describe, it, expect } from 'vitest'
import { accumulateVectorStats } from '@/lib/chat/vector-stats'

describe('accumulateVectorStats', () => {
  it('aggregiert counts korrekt', () => {
    const vectors = [
      { id: 'a-meta', metadata: { kind: 'doc', fileId: 'A' } },
      { id: 'a-0', metadata: { kind: 'chunk', fileId: 'A' } },
      { id: 'a-1', metadata: { kind: 'chunk', fileId: 'A' } },
      { id: 'a-chap-x', metadata: { kind: 'chapterSummary', fileId: 'A' } },
      { id: 'b-meta', metadata: { kind: 'doc', fileId: 'B' } },
      { id: 'b-0', metadata: { kind: 'chunk', fileId: 'B' } },
      { id: 'c-0', metadata: { kind: 'chunk', fileId: 'C' } },
    ]

    const res = accumulateVectorStats(vectors)
    expect(res.doc).toBe(2)
    expect(res.chapterSummary).toBe(1)
    expect(res.chunk).toBe(4)
    expect(res.uniqueDocs).toBe(3)
  })
})



