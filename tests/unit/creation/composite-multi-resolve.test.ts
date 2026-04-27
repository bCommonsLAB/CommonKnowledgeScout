/**
 * @fileoverview Unit-Tests für `resolveCompositeMulti`.
 *
 * Geprüft wird:
 * - Happy-Path (alle Bilder im Verzeichnis vorhanden)
 * - Edge-Case: ein Bild fehlt im Verzeichnis (kein Throw, sondern unresolvedSources)
 * - Edge-Case: Composite-Markdown ohne _source_files (Throw)
 * - Reihenfolge der imageBinaries entspricht _source_files
 * - MIME-Type-Fallback aus Dateiendung, falls Provider nichts liefert
 */

import { describe, expect, it, vi } from 'vitest'
import {
  resolveCompositeMulti,
  buildCompositeMultiReference,
} from '@/lib/creation/composite-multi'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'

/**
 * Erzeugt ein Mock-StorageItem (file) mit Minimal-Metadaten.
 * Nicht alle Felder werden vom Resolver genutzt — wir setzen nur, was gebraucht wird.
 */
function makeFileItem(id: string, name: string, parentId = 'parent-1'): StorageItem {
  return {
    id,
    parentId,
    type: 'file',
    metadata: {
      name,
      size: 1024,
      modifiedAt: new Date(0),
      mimeType: 'image/jpeg',
    },
  } as StorageItem
}

/**
 * Erzeugt einen minimalen Provider-Mock.
 * `siblings` definiert die Datei-Liste im Verzeichnis;
 * `binaries` mappt FileId → ArrayBuffer.
 * Optional: `mimeOverride` → liefert anderen MIME-Type je FileId.
 */
function makeProviderMock(opts: {
  siblings: StorageItem[]
  binaries: Record<string, ArrayBuffer>
  mimeOverride?: Record<string, string>
  failBinaryFor?: Set<string>
}): StorageProvider {
  return {
    name: 'mock',
    id: 'mock',
    isAuthenticated: () => true,
    validateConfiguration: vi.fn(),
    listItemsById: vi.fn(async () => opts.siblings),
    getItemById: vi.fn(async (itemId: string) => {
      const found = opts.siblings.find(s => s.id === itemId)
      if (!found) throw new Error(`not found: ${itemId}`)
      return found
    }),
    getBinary: vi.fn(async (fileId: string) => {
      if (opts.failBinaryFor?.has(fileId)) {
        throw new Error('binary load failed')
      }
      const buf = opts.binaries[fileId]
      if (!buf) throw new Error(`no binary for ${fileId}`)
      const mimeType = opts.mimeOverride?.[fileId] ?? 'image/jpeg'
      return {
        blob: new Blob([buf], { type: mimeType }),
        mimeType,
      }
    }),
  } as unknown as StorageProvider
}

describe('resolveCompositeMulti', () => {
  it('lädt alle Bilder (Happy-Path) und behält die Reihenfolge bei', async () => {
    // Composite-Markdown mit drei Quellen erzeugen
    const built = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [
        { id: 'orig-1', name: 'page_009.jpeg', parentId: 'parent-1' },
        { id: 'orig-2', name: 'page_010.jpeg', parentId: 'parent-1' },
        { id: 'orig-3', name: 'page_011.jpeg', parentId: 'parent-1' },
      ],
    })

    // Provider-Mock: alle drei Dateien vorhanden, mit echten Buffer-Inhalten
    const buf1 = new TextEncoder().encode('img-1-bytes').buffer
    const buf2 = new TextEncoder().encode('img-2-bytes').buffer
    const buf3 = new TextEncoder().encode('img-3-bytes').buffer
    const provider = makeProviderMock({
      siblings: [
        makeFileItem('file-1', 'page_009.jpeg'),
        makeFileItem('file-2', 'page_010.jpeg'),
        makeFileItem('file-3', 'page_011.jpeg'),
      ],
      binaries: { 'file-1': buf1, 'file-2': buf2, 'file-3': buf3 },
    })

    const resolved = await resolveCompositeMulti({
      libraryId: 'lib-1',
      compositeMarkdown: built.markdown,
      parentId: 'parent-1',
      provider,
    })

    expect(resolved.imageBinaries).toHaveLength(3)
    expect(resolved.unresolvedSources).toEqual([])
    expect(resolved.imageBinaries.map(b => b.name)).toEqual([
      'page_009.jpeg',
      'page_010.jpeg',
      'page_011.jpeg',
    ])
    expect(resolved.imageBinaries.map(b => b.index)).toEqual([1, 2, 3])
    expect(resolved.imageBinaries[0].buffer.toString()).toBe('img-1-bytes')
    expect(resolved.imageBinaries[2].buffer.toString()).toBe('img-3-bytes')
    expect(resolved.imageBinaries.every(b => b.mimeType === 'image/jpeg')).toBe(true)
  })

  it('meldet fehlende Datei in unresolvedSources, lädt die anderen weiterhin', async () => {
    const built = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [
        { id: 'orig-1', name: 'page_009.jpeg', parentId: 'parent-1' },
        { id: 'orig-2', name: 'page_010.jpeg', parentId: 'parent-1' },
        { id: 'orig-3', name: 'page_011.jpeg', parentId: 'parent-1' },
      ],
    })

    // Provider-Mock: page_010.jpeg fehlt im Verzeichnis
    const buf1 = new TextEncoder().encode('img-1-bytes').buffer
    const buf3 = new TextEncoder().encode('img-3-bytes').buffer
    const provider = makeProviderMock({
      siblings: [
        makeFileItem('file-1', 'page_009.jpeg'),
        makeFileItem('file-3', 'page_011.jpeg'),
      ],
      binaries: { 'file-1': buf1, 'file-3': buf3 },
    })

    const resolved = await resolveCompositeMulti({
      libraryId: 'lib-1',
      compositeMarkdown: built.markdown,
      parentId: 'parent-1',
      provider,
    })

    expect(resolved.imageBinaries).toHaveLength(2)
    expect(resolved.unresolvedSources).toEqual(['page_010.jpeg'])
    // imageBinaries-Indexe entsprechen der Position in _source_files,
    // d.h. file-3 hat index=3 (nicht 2), weil page_010 den Index 2 belegt.
    expect(resolved.imageBinaries.map(b => b.index)).toEqual([1, 3])
  })

  it('meldet alle Quellen als unresolved, wenn das Verzeichnis leer ist', async () => {
    const built = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [
        { id: 'orig-1', name: 'a.jpg', parentId: 'parent-1' },
        { id: 'orig-2', name: 'b.jpg', parentId: 'parent-1' },
      ],
    })

    const provider = makeProviderMock({ siblings: [], binaries: {} })

    const resolved = await resolveCompositeMulti({
      libraryId: 'lib-1',
      compositeMarkdown: built.markdown,
      parentId: 'parent-1',
      provider,
    })

    expect(resolved.imageBinaries).toEqual([])
    expect(resolved.unresolvedSources).toEqual(['a.jpg', 'b.jpg'])
  })

  it('meldet unresolved bei getBinary-Fehler, ohne den ganzen Resolve-Lauf abzubrechen', async () => {
    const built = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [
        { id: 'orig-1', name: 'ok.jpg', parentId: 'parent-1' },
        { id: 'orig-2', name: 'broken.jpg', parentId: 'parent-1' },
      ],
    })

    const okBuf = new TextEncoder().encode('ok-bytes').buffer
    const provider = makeProviderMock({
      siblings: [
        makeFileItem('file-ok', 'ok.jpg'),
        makeFileItem('file-broken', 'broken.jpg'),
      ],
      binaries: { 'file-ok': okBuf, 'file-broken': okBuf },
      failBinaryFor: new Set(['file-broken']),
    })

    const resolved = await resolveCompositeMulti({
      libraryId: 'lib-1',
      compositeMarkdown: built.markdown,
      parentId: 'parent-1',
      provider,
    })

    expect(resolved.imageBinaries.map(b => b.name)).toEqual(['ok.jpg'])
    expect(resolved.unresolvedSources).toEqual(['broken.jpg'])
  })

  it('wirft, wenn das Composite-Markdown kein _source_files enthält', async () => {
    const broken = '---\nkind: composite-multi\n---\n# leer\n'
    const provider = makeProviderMock({ siblings: [], binaries: {} })

    await expect(
      resolveCompositeMulti({
        libraryId: 'lib-1',
        compositeMarkdown: broken,
        parentId: 'parent-1',
        provider,
      })
    ).rejects.toThrow(/keine _source_files/i)
  })

  it('verwendet den vom Provider gelieferten MIME-Type', async () => {
    const built = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [
        { id: 'orig-1', name: 'foto.png', parentId: 'parent-1' },
        { id: 'orig-2', name: 'grafik.webp', parentId: 'parent-1' },
      ],
    })

    const buf = new TextEncoder().encode('x').buffer
    const provider = makeProviderMock({
      siblings: [
        makeFileItem('file-1', 'foto.png'),
        makeFileItem('file-2', 'grafik.webp'),
      ],
      binaries: { 'file-1': buf, 'file-2': buf },
      mimeOverride: { 'file-1': 'image/png', 'file-2': 'image/webp' },
    })

    const resolved = await resolveCompositeMulti({
      libraryId: 'lib-1',
      compositeMarkdown: built.markdown,
      parentId: 'parent-1',
      provider,
    })

    expect(resolved.imageBinaries[0].mimeType).toBe('image/png')
    expect(resolved.imageBinaries[1].mimeType).toBe('image/webp')
  })

  it('liefert eine Kontext-Tabelle mit Status pro Quelle', async () => {
    const built = buildCompositeMultiReference({
      libraryId: 'lib-1',
      sourceItems: [
        { id: 'orig-1', name: 'a.jpg', parentId: 'parent-1' },
        { id: 'orig-2', name: 'b.jpg', parentId: 'parent-1' },
      ],
    })

    const buf = new TextEncoder().encode('x').buffer
    const provider = makeProviderMock({
      siblings: [makeFileItem('file-1', 'a.jpg')],
      binaries: { 'file-1': buf },
    })

    const resolved = await resolveCompositeMulti({
      libraryId: 'lib-1',
      compositeMarkdown: built.markdown,
      parentId: 'parent-1',
      provider,
    })

    expect(resolved.contextMarkdown).toContain('| 1 | a.jpg | geladen |')
    expect(resolved.contextMarkdown).toContain('| 2 | b.jpg | *fehlt* |')
  })
})
