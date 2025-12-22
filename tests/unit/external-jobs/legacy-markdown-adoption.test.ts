import { describe, expect, it, vi } from 'vitest'

// Wichtig: Module-Mock MUSS vor dem Import des SUT passieren,
// da `legacy-markdown-adoption.ts` die Funktionen beim Laden importiert.
vi.mock('@/lib/storage/shadow-twin', () => {
  return {
    // In diesem Test reicht es, ein existierendes Shadow-Twin-Verzeichnis zu simulieren.
    findShadowTwinFolder: vi.fn(async () => ({
      id: 'shadow-twin-folder-1',
      parentId: 'parent-1',
      type: 'folder' as const,
      metadata: { name: '.x.pdf', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' },
    })),
    generateShadowTwinFolderName: (originalName: string) => `.${originalName}`,
  }
})

describe('adoptLegacyMarkdownToShadowTwin', () => {
  it('does NOT delete when legacyMarkdownId equals existingTransformed.id (regression)', async () => {
    const legacyId = 'same-id'

    const provider = {
      listItemsById: vi.fn(async () => [
        { id: legacyId, parentId: 'shadow-twin-folder-1', type: 'file' as const, metadata: { name: 'Doc.de.md', size: 1, modifiedAt: new Date(), mimeType: 'text/markdown' } },
      ]),
      createFolder: vi.fn(async () => { throw new Error('not used') }),
      moveItem: vi.fn(async () => { throw new Error('not used') }),
      deleteItem: vi.fn(async () => { /* should not be called */ }),
    } as any

    const repo = {
      traceAddEvent: vi.fn(async () => {}),
    } as any

    const ctx = {
      jobId: 'job-1',
      request: new Request('http://localhost'),
      body: {},
      callbackToken: undefined,
      internalBypass: true,
      job: {
        correlation: {
          source: { name: 'Doc.pdf', parentId: 'parent-1' },
          options: { targetLanguage: 'de' },
        },
      },
    } as any

    const preTemplateResult = {
      markdownFileId: legacyId,
      hasFrontmatter: true,
      frontmatterValid: true,
    } as any

    const { adoptLegacyMarkdownToShadowTwin } = await import('@/lib/external-jobs/legacy-markdown-adoption')
    const ok = await adoptLegacyMarkdownToShadowTwin(ctx, preTemplateResult, provider, repo)

    expect(ok).toBe(true)
    expect(provider.deleteItem).not.toHaveBeenCalled()
    expect(provider.moveItem).not.toHaveBeenCalled()
  })
})


