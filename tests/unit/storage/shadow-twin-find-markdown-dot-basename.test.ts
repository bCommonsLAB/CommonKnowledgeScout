import { describe, expect, it } from 'vitest'
import { findShadowTwinMarkdown } from '@/lib/storage/shadow-twin'

describe('findShadowTwinMarkdown (baseName with dots)', () => {
  it('finds transformed markdown when baseName contains a dot', async () => {
    const items = [
      { id: 'x1', type: 'file' as const, metadata: { name: 'Commoning vs. Kommerz.de.md' } },
      { id: 'x2', type: 'file' as const, metadata: { name: 'Commoning vs.de.md' } },
      { id: 'x3', type: 'file' as const, metadata: { name: 'Commoning vs. Kommerz.md' } },
    ]

    const provider = {
      listItemsById: async () => items,
    } as any

    const found = await findShadowTwinMarkdown('folder-1', 'Commoning vs. Kommerz', 'de', provider, true)
    expect(found?.metadata?.name).toBe('Commoning vs. Kommerz.de.md')
  })
})


