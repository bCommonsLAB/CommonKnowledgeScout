/** Befund 06.11.2026: publicationStatus muss als Token im Suchindex stehen, sonst gibt es keinen Gast-Filter darauf. */
import { describe, it, expect } from 'vitest'
import { buildVectorSearchIndexDefinition } from '@/lib/chat/vector-search-index'
import type { Library } from '@/types/library'

describe('buildVectorSearchIndexDefinition', () => {
  it('fuehrt publicationStatus als Token neben kind, libraryId, user und fileId', () => {
    const lib = { id: 'l', label: 'L', config: {} } as unknown as Library
    const { definition } = buildVectorSearchIndexDefinition(lib, 1536)
    const f = definition.mappings.fields
    expect(f.publicationStatus).toEqual({ type: 'token' })
    for (const k of ['kind', 'libraryId', 'user', 'fileId']) expect(f[k]).toEqual({ type: 'token' })
  })
})
