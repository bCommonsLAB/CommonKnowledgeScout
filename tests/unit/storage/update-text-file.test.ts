/**
 * Welle ST1 — versioniertes In-Place-Schreiben.
 *
 * Die Tests halten drei Zusicherungen fest, die vorher keine waren:
 * die itemId ueberlebt einen Schreibvorgang, ein fremder Schreiber wird
 * bemerkt statt ueberfahren, und ein Provider ohne Versionierung faellt
 * NICHT stillschweigend auf delete+upload zurueck.
 */
import { describe, expect, it, vi } from 'vitest'
import { ersetzeTextDatei } from '@/lib/storage/update-text-file'
import { StorageVersionConflictError, supportsVersioning } from '@/lib/storage/types'
import type { StorageItem, StorageProvider, StorageUpdateOptions } from '@/lib/storage/types'

function item(id: string, version?: string): StorageItem {
  return {
    id,
    parentId: 'root',
    type: 'file',
    metadata: { name: '_INDEX.md', size: 10, modifiedAt: new Date('2026-08-27T10:00:00Z'), mimeType: 'text/markdown', ...(version ? { version } : {}) },
  }
}

/** Minimaler Provider — nur was die Funktion anfasst. */
function baueProvider(opts: { version?: string; versioniert?: boolean } = {}) {
  const geschrieben: Array<{ id: string; inhalt: string; ifVersion: string }> = []
  const provider = {
    name: 'test',
    id: 'test',
    getItemById: vi.fn(async (id: string) => item(id, opts.version)),
    updateFile: opts.versioniert === false
      ? undefined
      : vi.fn(async (id: string, content: Blob, options: StorageUpdateOptions) => {
        const inhalt = await content.text()
        if (options.ifVersion !== opts.version) {
          throw new StorageVersionConflictError('geaendert', options.ifVersion, opts.version ?? null, 'test')
        }
        geschrieben.push({ id, inhalt, ifVersion: options.ifVersion })
        return { id, version: 'etag-neu' }
      }),
    deleteItem: vi.fn(async () => { throw new Error('deleteItem darf hier nie aufgerufen werden') }),
    uploadFile: vi.fn(async () => { throw new Error('uploadFile darf hier nie aufgerufen werden') }),
  }
  return { provider: provider as unknown as StorageProvider, geschrieben, roh: provider }
}

describe('ersetzeTextDatei', () => {
  it('schreibt an Ort und Stelle und behaelt die itemId', async () => {
    const { provider, geschrieben, roh } = baueProvider({ version: 'etag-alt' })

    const ergebnis = await ersetzeTextDatei({ provider, fileId: 'idx-1', inhalt: '# neu' })

    expect(ergebnis).toEqual({ fileId: 'idx-1', version: 'etag-neu' })
    expect(geschrieben).toEqual([{ id: 'idx-1', inhalt: '# neu', ifVersion: 'etag-alt' }])
    // Der Kern der Welle: kein Loeschen, kein Neu-Anlegen.
    expect(roh.deleteItem).not.toHaveBeenCalled()
    expect(roh.uploadFile).not.toHaveBeenCalled()
  })

  it('meldet einen Konflikt, statt fremde Aenderungen zu ueberschreiben', async () => {
    const { provider, roh } = baueProvider({ version: 'etag-alt' })
    // Zwischen Lesen und Schreiben hat jemand anders geschrieben.
    roh.getItemById.mockResolvedValueOnce(item('idx-1', 'etag-fremd'))

    await expect(ersetzeTextDatei({ provider, fileId: 'idx-1', inhalt: '# neu' }))
      .rejects.toThrow(StorageVersionConflictError)
  })

  it('faellt NICHT auf delete+upload zurueck, wenn der Provider nicht versionieren kann', async () => {
    const { provider, roh } = baueProvider({ versioniert: false })

    await expect(ersetzeTextDatei({ provider, fileId: 'idx-1', inhalt: '# neu' }))
      .rejects.toThrow(/nicht versioniert schreiben/)
    expect(roh.deleteItem).not.toHaveBeenCalled()
    expect(roh.uploadFile).not.toHaveBeenCalled()
  })

  it('schreibt nichts, wenn das Item keine Version liefert', async () => {
    const { provider, geschrieben } = baueProvider({ version: undefined })

    await expect(ersetzeTextDatei({ provider, fileId: 'idx-1', inhalt: '# neu' }))
      .rejects.toThrow(/keine Version/)
    expect(geschrieben).toEqual([])
  })
})

describe('supportsVersioning', () => {
  it('erkennt Provider mit und ohne updateFile', () => {
    expect(supportsVersioning(baueProvider({ version: 'a' }).provider)).toBe(true)
    expect(supportsVersioning(baueProvider({ versioniert: false }).provider)).toBe(false)
  })
})
