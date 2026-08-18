/**
 * @fileoverview Unit-Tests fuer resolveSources + collectStorageOnlySource
 * (Welle 5a/5b): Ordner-Scope liefert doc-lose Dateien als Adoptions-Kandidaten,
 * Library-Scope = Root-Scan ∪ Mongo-Reste, Sibling-Artefakte sind keine Quellen,
 * sourceIds-Scope adoptiert doc-lose Quellen mit Storage-Datei (Welle 5b).
 */

import { describe, it, expect, vi } from 'vitest'
import { resolveSources } from '@/lib/shadow-twin/sync-engine/resolve-sources'
import { collectStorageOnlySource } from '@/lib/shadow-twin/sync-engine/collect-storage-only-source'
import { FolderCache } from '@/lib/shadow-twin/sync-engine/folder-cache'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const repoMocks = vi.hoisted(() => ({
  getShadowTwinsBySourceIds: vi.fn(async () => new Map<string, ShadowTwinDocument>()),
  getAllShadowTwins: vi.fn(async () => [] as ShadowTwinDocument[]),
}))
vi.mock('@/lib/repositories/shadow-twin-repo', () => repoMocks)

function file(id: string, name: string, parentId: string): StorageItem {
  return { id, type: 'file', parentId, metadata: { name } } as unknown as StorageItem
}
function folder(id: string, name: string, parentId: string): StorageItem {
  return { id, type: 'folder', parentId, metadata: { name } } as unknown as StorageItem
}
function makeProvider(tree: Record<string, StorageItem[]>): StorageProvider {
  return {
    listItemsById: vi.fn(async (id: string) => tree[id] ?? []),
    getItemById: vi.fn(async (id: string) => {
      const item = Object.values(tree).flat().find((it) => it.id === id)
      if (!item) throw new Error(`Item nicht gefunden: ${id}`)
      return item
    }),
  } as unknown as StorageProvider
}
function doc(sourceId: string): ShadowTwinDocument {
  return { libraryId: 'lib-1', sourceId, sourceName: '', parentId: '' } as unknown as ShadowTwinDocument
}

describe('resolveSources (Welle 5a)', () => {
  it('Ordner-Scope: doc-lose Dateien werden Adoptions-Kandidaten (doc=null), Twin-Ordner nicht gescannt', async () => {
    const tree = {
      top: [file('pdf-1', 'a.pdf', 'top'), file('pdf-2', 'b.pdf', 'top'), folder('twin-a', '_a.pdf', 'top')],
      'twin-a': [file('t-1', 'a.md', 'twin-a')],
    }
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValueOnce(new Map([['pdf-1', doc('pdf-1')]]))
    const provider = makeProvider(tree)
    const { pairs, scannedFiles } = await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'top' }, folderCache: new FolderCache(provider), provider,
    })
    expect(scannedFiles).toBe(2)
    expect(pairs).toHaveLength(2)
    expect(pairs[0].doc?.sourceId).toBe('pdf-1')
    expect(pairs[1].doc).toBeNull()
    expect(pairs[1].sourceItem?.id).toBe('pdf-2')
  })

  it('Sibling-Artefakte (X.md neben X.pdf) sind KEINE eigenen Quellen', async () => {
    const tree = {
      top: [file('pdf-1', 'a.pdf', 'top'), file('md-1', 'a.md', 'top'), file('md-2', 'a.alpha.de.md', 'top'), file('md-3', 'notes.md', 'top')],
    }
    const provider = makeProvider(tree)
    const { pairs } = await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'top' }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs.map((p) => p.sourceItem?.id)).toEqual(['pdf-1', 'md-3'])
  })

  it('Library-Scope: Root-Scan ∪ Mongo-Dokumente ohne Quelldatei', async () => {
    const tree = { root: [file('pdf-1', 'a.pdf', 'root')] }
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValueOnce(new Map([['pdf-1', doc('pdf-1')]]))
    repoMocks.getAllShadowTwins.mockResolvedValueOnce([doc('pdf-1'), doc('gone-1')])
    const provider = makeProvider(tree)
    const { pairs } = await resolveSources({
      libraryId: 'lib-1', scope: {}, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(2)
    expect(pairs[0].sourceItem?.id).toBe('pdf-1')
    expect(pairs[1].doc?.sourceId).toBe('gone-1')
    expect(pairs[1].sourceItem).toBeNull()
  })
})

describe('resolveSources sourceIds-Scope (Welle 5b)', () => {
  it('mit Doc: Paar aus Doc + Quell-Item (wie bisher)', async () => {
    const tree = { top: [file('pdf-1', 'a.pdf', 'top')] }
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValueOnce(new Map([['pdf-1', doc('pdf-1')]]))
    const provider = makeProvider(tree)
    const { pairs, skippedWithoutDoc } = await resolveSources({
      libraryId: 'lib-1', scope: { sourceIds: ['pdf-1'] }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(1)
    expect(pairs[0].doc?.sourceId).toBe('pdf-1')
    expect(pairs[0].sourceItem?.id).toBe('pdf-1')
    expect(skippedWithoutDoc).toBe(0)
  })

  it('ohne Doc, Datei im Storage: Adoptions-Kandidat (doc=null)', async () => {
    const tree = { top: [file('pdf-2', 'b.pdf', 'top')] }
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValueOnce(new Map())
    const provider = makeProvider(tree)
    const { pairs, skippedWithoutDoc } = await resolveSources({
      libraryId: 'lib-1', scope: { sourceIds: ['pdf-2'] }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(1)
    expect(pairs[0].doc).toBeNull()
    expect(pairs[0].sourceItem?.id).toBe('pdf-2')
    expect(skippedWithoutDoc).toBe(0)
  })

  it('ohne Doc und ohne Datei (bzw. Ordner-Id): uebersprungen', async () => {
    const tree = { top: [folder('twin-a', '_a.pdf', 'top')] }
    repoMocks.getShadowTwinsBySourceIds.mockResolvedValueOnce(new Map())
    const provider = makeProvider(tree)
    const { pairs, skippedWithoutDoc } = await resolveSources({
      libraryId: 'lib-1', scope: { sourceIds: ['gone-1', 'twin-a'] }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(0)
    expect(skippedWithoutDoc).toBe(2)
  })
})

describe('collectStorageOnlySource (Welle 5a)', () => {
  it('findet Twin-Ordner via Namens-Variante und plant die Adoption', async () => {
    const source = file('pdf-1', 'a.pdf', 'top')
    const tree = {
      top: [source, folder('twin-a', '_a.pdf', 'top')],
      'twin-a': [file('t-1', 'a.md', 'twin-a'), file('t-2', 'a.alpha.de.md', 'twin-a'), file('img', 'page_001.jpeg', 'twin-a')],
    }
    const provider = makeProvider(tree)
    const adoption = await collectStorageOnlySource({ sourceItem: source, folderCache: new FolderCache(provider), provider })
    expect(adoption).not.toBeNull()
    expect(adoption?.plan.operations).toHaveLength(1)
    expect(adoption?.plan.operations[0].type).toBe('adopt-storage-only-source')
    expect(adoption?.plan.operations[0].count).toBe(2)
    expect(adoption?.collected.shadowTwinFolderId).toBe('twin-a')
    expect(adoption?.collected.sourceItem).toBe(source)
  })

  it('ohne adoptierbare Artefakte: null (Quelle bleibt uebersprungen)', async () => {
    const source = file('pdf-1', 'a.pdf', 'top')
    const provider = makeProvider({ top: [source] })
    const adoption = await collectStorageOnlySource({ sourceItem: source, folderCache: new FolderCache(provider), provider })
    expect(adoption).toBeNull()
  })
})

describe('resolveSources — Ausschluss-Muster (Welle 0b)', () => {
  it('ausgeschlossene Teilbaeume und Dateien werden uebersprungen und GEZAEHLT', async () => {
    const tree = {
      top: [
        file('pdf-1', 'a.pdf', 'top'),
        file('tmp-1', 'entwurf.tmp', 'top'),
        folder('tempdir', 'temp', 'top'),
        folder('sub', 'projekte', 'top'),
      ],
      tempdir: [file('t-1', 'muell1.md', 'tempdir'), file('t-2', 'muell2.md', 'tempdir')],
      sub: [file('pdf-2', 'b.pdf', 'sub')],
    }
    const provider = makeProvider(tree)
    const { pairs, scannedFiles, skippedExcluded } = await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'top' }, folderCache: new FolderCache(provider), provider,
      excludeGlobs: ['temp', '*.tmp'],
    })
    // temp/ (1 Ordner, inkl. Inhalt ungescannt) + entwurf.tmp = 2 gezaehlte Ausschluesse
    expect(skippedExcluded).toBe(2)
    expect(scannedFiles).toBe(2)
    expect(pairs.map((p) => p.sourceItem?.id).sort()).toEqual(['pdf-1', 'pdf-2'])
    // Der ausgeschlossene Ordner wurde NICHT gelistet (kein Provider-Aufruf verschwendet)
    expect((provider.listItemsById as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).not.toContain('tempdir')
  })

  it('ohne Muster bleibt alles wie bisher (skippedExcluded = 0)', async () => {
    const tree = { top: [file('pdf-1', 'a.pdf', 'top')] }
    const provider = makeProvider(tree)
    const { skippedExcluded } = await resolveSources({
      libraryId: 'lib-1', scope: { folderId: 'top' }, folderCache: new FolderCache(provider), provider,
    })
    expect(skippedExcluded).toBe(0)
  })
})

describe('resolveSources — sourceIds-Scope filtert Artefakt-Dateien (Welle 0g)', () => {
  it('X.md neben X.pdf wird beim Einzeldatei-Abgleich KEINE eigene Quelle', async () => {
    const tree = {
      top: [file('pdf-1', 'a.pdf', 'top'), file('md-1', 'a.md', 'top')],
    }
    const provider = makeProvider(tree)
    const { pairs, skippedWithoutDoc } = await resolveSources({
      libraryId: 'lib-1', scope: { sourceIds: ['md-1'] }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(0)
    expect(skippedWithoutDoc).toBe(1)
  })

  it('Datei im _-Twin-Ordner wird ebenfalls uebersprungen', async () => {
    const tree = {
      top: [folder('twin-a', '_a.pdf', 'top')],
      'twin-a': [file('t-1', 'a.template.de.md', 'twin-a')],
    }
    const provider = makeProvider(tree)
    const { pairs, skippedWithoutDoc } = await resolveSources({
      libraryId: 'lib-1', scope: { sourceIds: ['t-1'] }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(0)
    expect(skippedWithoutDoc).toBe(1)
  })

  it('eine ECHTE Markdown-Quelle ohne Doc bleibt Adoptions-Kandidat', async () => {
    const tree = { top: [file('md-solo', 'notizen.md', 'top')] }
    const provider = makeProvider(tree)
    const { pairs } = await resolveSources({
      libraryId: 'lib-1', scope: { sourceIds: ['md-solo'] }, folderCache: new FolderCache(provider), provider,
    })
    expect(pairs).toHaveLength(1)
    expect(pairs[0].doc).toBeNull()
  })
})
