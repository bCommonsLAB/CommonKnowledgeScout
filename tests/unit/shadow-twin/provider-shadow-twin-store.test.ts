/**
 * @fileoverview Unit-Tests: ProviderShadowTwinStore (Spiegel-Write-Pfad).
 *
 * Testsession 25.08.2026 §2: (a) die Artefakt-Aufloesung laeuft je
 * Store-Instanz (= je Request) nur EINMAL statt bei jedem Zugriff, (b) ein
 * vom Aufrufer bereits aufgeloestes Spiegel-Ziel (`knownMirrorFile`) macht
 * die Suche komplett ueberfluessig — auch als expliziter null-Fall
 * („aufgeloest, keine vorhanden").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProviderShadowTwinStore } from '@/lib/shadow-twin/store/provider-shadow-twin-store'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

vi.mock('@/lib/shadow-twin/artifact-resolver', () => ({
  resolveArtifact: vi.fn(),
}))

const KEY: ArtifactKey = { sourceId: 'src-1', kind: 'transcript', targetLanguage: '' }

function uploadedItem(name: string): StorageItem {
  return { id: 'file-neu', parentId: 'twin-1', type: 'file', metadata: { name } } as StorageItem
}

function mockProvider() {
  return {
    getBinary: vi.fn(async () => ({ blob: new Blob(['# Inhalt']), mimeType: 'text/markdown' })),
    uploadFile: vi.fn(async (_parentId: string, file: File) => uploadedItem(file.name)),
    deleteItem: vi.fn(async () => undefined),
  } as unknown as StorageProvider
}

describe('ProviderShadowTwinStore — Aufloesung je Request', () => {
  beforeEach(() => {
    vi.mocked(resolveArtifact).mockReset()
  })

  it('memoisiert resolveArtifact: exists + getMarkdown suchen nur einmal', async () => {
    vi.mocked(resolveArtifact).mockResolvedValue({
      kind: 'transcript', fileId: 'file-1', fileName: 'audio.md', location: 'dotFolder', shadowTwinFolderId: 'twin-1',
    })
    const store = new ProviderShadowTwinStore(mockProvider(), 'audio.m4a', 'parent-1')

    await expect(store.existsArtifact(KEY)).resolves.toBe(true)
    const markdown = await store.getArtifactMarkdown(KEY)
    expect(markdown?.id).toBe('file-1')
    expect(resolveArtifact).toHaveBeenCalledTimes(1)
  })

  it('nach einem Write ist der Memo leer — die naechste Aufloesung liest frisch', async () => {
    vi.mocked(resolveArtifact).mockResolvedValue(null)
    const store = new ProviderShadowTwinStore(mockProvider(), 'audio.m4a', 'parent-1')

    await store.existsArtifact(KEY)
    await store.upsertArtifact(KEY, '# Neu', undefined, {
      libraryId: 'lib', userEmail: 'p@x', sourceName: 'audio.m4a', parentId: 'twin-1',
      knownMirrorFile: null,
    })
    await store.existsArtifact(KEY)
    // 1. exists + 2. exists nach dem Write; der Write selbst suchte nicht (knownMirrorFile).
    expect(resolveArtifact).toHaveBeenCalledTimes(2)
  })

  it('knownMirrorFile ueberspringt die Suche und aktualisiert exakt die Datei', async () => {
    const provider = mockProvider()
    const store = new ProviderShadowTwinStore(provider, 'audio.m4a', 'parent-1')

    const ergebnis = await store.upsertArtifact(KEY, '# Patch', undefined, {
      libraryId: 'lib', userEmail: 'p@x', sourceName: 'audio.m4a', parentId: 'twin-1',
      knownMirrorFile: { fileId: 'file-alt', fileName: 'audio.md' },
    })

    expect(resolveArtifact).not.toHaveBeenCalled()
    expect(provider.uploadFile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(provider.uploadFile).mock.calls[0][0]).toBe('twin-1')
    expect(ergebnis.name).toBe('audio.md')
  })

  it('knownMirrorFile: null legt ohne Suche neu an', async () => {
    const provider = mockProvider()
    const store = new ProviderShadowTwinStore(provider, 'audio.m4a', 'parent-1')

    await store.upsertArtifact(KEY, '# Neu', undefined, {
      libraryId: 'lib', userEmail: 'p@x', sourceName: 'audio.m4a', parentId: 'twin-1',
      knownMirrorFile: null,
    })

    expect(resolveArtifact).not.toHaveBeenCalled()
    expect(provider.deleteItem).not.toHaveBeenCalled()
    expect(provider.uploadFile).toHaveBeenCalledTimes(1)
  })

  it('ohne knownMirrorFile loest der Store selbst auf (Bestandsverhalten)', async () => {
    vi.mocked(resolveArtifact).mockResolvedValue({
      kind: 'transcript', fileId: 'file-alt', fileName: 'audio.md', location: 'dotFolder', shadowTwinFolderId: 'twin-1',
    })
    const provider = mockProvider()
    const store = new ProviderShadowTwinStore(provider, 'audio.m4a', 'parent-1')

    await store.upsertArtifact(KEY, '# Patch', undefined, {
      libraryId: 'lib', userEmail: 'p@x', sourceName: 'audio.m4a', parentId: 'twin-1',
    })

    expect(resolveArtifact).toHaveBeenCalledTimes(1)
    expect(provider.uploadFile).toHaveBeenCalledTimes(1)
  })
})
