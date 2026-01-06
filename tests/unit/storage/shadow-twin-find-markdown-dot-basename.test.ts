import { describe, expect, it, vi } from 'vitest'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'

vi.mock('@/lib/storage/shadow-twin', () => ({
  findShadowTwinFolder: vi.fn(),
}))

describe('resolveArtifact (baseName with dots)', () => {
  it('findet Transcript im dotFolder, wenn baseName Punkte enthält', async () => {
    const items = [
      { id: 'x1', type: 'file' as const, metadata: { name: 'Commoning vs. Kommerz.de.md' } },
      { id: 'x2', type: 'file' as const, metadata: { name: 'Commoning vs.de.md' } },
      { id: 'x3', type: 'file' as const, metadata: { name: 'Commoning vs. Kommerz.md' } },
    ]

    const provider = {
      listItemsById: vi.fn(async () => items),
    } as any

    vi.mocked(findShadowTwinFolder).mockResolvedValue({
      id: 'folder-1',
      type: 'folder',
      parentId: 'parent-1',
      metadata: { name: '.Commoning vs. Kommerz.pdf' },
    } as any)

    const found = await resolveArtifact(provider, {
      sourceItemId: 'source-1',
      sourceName: 'Commoning vs. Kommerz.pdf',
      parentId: 'parent-1',
      targetLanguage: 'de',
      preferredKind: 'transcript',
    })

    expect(found?.fileName).toBe('Commoning vs. Kommerz.de.md')
  })
})


