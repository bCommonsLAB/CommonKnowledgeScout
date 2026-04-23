/**
 * @fileoverview Tests fuer getMediaStorageStrategy()
 *
 * Deckt alle Kombinationen aus primaryStore × persistToFilesystem × allowFilesystemFallback × azureConfigured
 * ab und stellt sicher, dass die abgeleiteten Modi und Flags den Erwartungen aus
 * docs/analysis/media-storage-strategy.md entsprechen.
 */

import { describe, it, expect } from 'vitest'
import {
  getMediaStorageStrategy,
  type MediaStorageMode,
} from '@/lib/shadow-twin/media-storage-strategy'
import type { Library } from '@/types/library'

// Helfer: minimaler Library-Mock, nur die fuer die Strategie relevanten Felder.
// Wir casten auf Library, um nicht das gesamte Library-Schema befuellen zu muessen.
function makeLibrary(shadowTwin: Partial<{
  primaryStore: 'filesystem' | 'mongo'
  persistToFilesystem: boolean
  allowFilesystemFallback: boolean
}>): Library {
  return {
    config: {
      shadowTwin,
    },
  } as unknown as Library
}

describe('getMediaStorageStrategy', () => {
  describe('primaryStore=mongo + persistToFilesystem=false', () => {
    it('Azure verfuegbar  -> azure-only', () => {
      const lib = makeLibrary({ primaryStore: 'mongo', persistToFilesystem: false })
      const s = getMediaStorageStrategy(lib, true)
      expect(s.mode).toBe<MediaStorageMode>('azure-only')
      expect(s.writeToAzure).toBe(true)
      expect(s.writeToFilesystem).toBe(false)
      expect(s.readPreferredSource).toBe('azure')
      expect(s.allowFilesystemFallbackOnRead).toBe(false)
      expect(s.rationale).toMatch(/azure/i)
    })

    it('Azure NICHT verfuegbar -> unavailable (harter Fehler)', () => {
      const lib = makeLibrary({ primaryStore: 'mongo', persistToFilesystem: false })
      const s = getMediaStorageStrategy(lib, false)
      expect(s.mode).toBe<MediaStorageMode>('unavailable')
      expect(s.writeToAzure).toBe(false)
      expect(s.writeToFilesystem).toBe(false)
      expect(s.allowFilesystemFallbackOnRead).toBe(false)
      expect(s.rationale).toMatch(/nicht konfiguriert/i)
    })
  })

  describe('primaryStore=mongo + persistToFilesystem=true', () => {
    it('Azure verfuegbar -> azure-with-fs-backup', () => {
      const lib = makeLibrary({
        primaryStore: 'mongo',
        persistToFilesystem: true,
        allowFilesystemFallback: true,
      })
      const s = getMediaStorageStrategy(lib, true)
      expect(s.mode).toBe<MediaStorageMode>('azure-with-fs-backup')
      expect(s.writeToAzure).toBe(true)
      expect(s.writeToFilesystem).toBe(true)
      expect(s.readPreferredSource).toBe('azure')
      expect(s.allowFilesystemFallbackOnRead).toBe(true)
    })

    it('Azure verfuegbar + allowFilesystemFallback=false -> Fallback aus', () => {
      const lib = makeLibrary({
        primaryStore: 'mongo',
        persistToFilesystem: true,
        allowFilesystemFallback: false,
      })
      const s = getMediaStorageStrategy(lib, true)
      expect(s.mode).toBe<MediaStorageMode>('azure-with-fs-backup')
      expect(s.allowFilesystemFallbackOnRead).toBe(false)
    })

    it('Azure NICHT verfuegbar -> filesystem-only (Defensive Fallback)', () => {
      const lib = makeLibrary({ primaryStore: 'mongo', persistToFilesystem: true })
      const s = getMediaStorageStrategy(lib, false)
      expect(s.mode).toBe<MediaStorageMode>('filesystem-only')
      expect(s.writeToAzure).toBe(false)
      expect(s.writeToFilesystem).toBe(true)
      expect(s.readPreferredSource).toBe('filesystem')
    })
  })

  describe('primaryStore=filesystem (Legacy)', () => {
    it('Azure verfuegbar -> filesystem-only (kein Auto-Upgrade)', () => {
      const lib = makeLibrary({ primaryStore: 'filesystem' })
      const s = getMediaStorageStrategy(lib, true)
      expect(s.mode).toBe<MediaStorageMode>('filesystem-only')
      expect(s.writeToAzure).toBe(false)
      expect(s.writeToFilesystem).toBe(true)
      expect(s.readPreferredSource).toBe('filesystem')
      expect(s.allowFilesystemFallbackOnRead).toBe(true)
    })

    it('Azure NICHT verfuegbar -> filesystem-only', () => {
      const lib = makeLibrary({ primaryStore: 'filesystem' })
      const s = getMediaStorageStrategy(lib, false)
      expect(s.mode).toBe<MediaStorageMode>('filesystem-only')
    })
  })

  describe('Edge Cases', () => {
    it('null library -> Defaults (filesystem-only) auch ohne Azure', () => {
      const s = getMediaStorageStrategy(null, false)
      // Default primaryStore ist 'filesystem' (siehe shadow-twin-config.ts).
      expect(s.mode).toBe<MediaStorageMode>('filesystem-only')
    })

    it('undefined library -> Defaults', () => {
      const s = getMediaStorageStrategy(undefined, true)
      expect(s.mode).toBe<MediaStorageMode>('filesystem-only')
    })

    it('Library ohne shadowTwin-Block -> Defaults', () => {
      const lib = { config: {} } as unknown as Library
      const s = getMediaStorageStrategy(lib, true)
      expect(s.mode).toBe<MediaStorageMode>('filesystem-only')
    })
  })

  it('rationale ist immer gesetzt (fuer UI-Anzeige)', () => {
    const variants: Array<[Library | null, boolean]> = [
      [makeLibrary({ primaryStore: 'mongo', persistToFilesystem: false }), true],
      [makeLibrary({ primaryStore: 'mongo', persistToFilesystem: false }), false],
      [makeLibrary({ primaryStore: 'mongo', persistToFilesystem: true }), true],
      [makeLibrary({ primaryStore: 'mongo', persistToFilesystem: true }), false],
      [makeLibrary({ primaryStore: 'filesystem' }), true],
      [null, true],
    ]
    for (const [lib, azure] of variants) {
      const s = getMediaStorageStrategy(lib, azure)
      expect(s.rationale).toBeTruthy()
      expect(s.rationale.length).toBeGreaterThan(20)
    }
  })
})
