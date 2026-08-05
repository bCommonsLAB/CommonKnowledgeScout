/**
 * Unit-Tests fuer den storage-agnostischen Capability-Helper.
 *
 * Welle 1, Schritt 4 — siehe `.cursor/rules/storage-contracts.mdc` §5.
 *
 * Der Helper kapselt die Logik aus `file-preview.tsx:1134`
 * (`primaryStore === 'filesystem' || persistToFilesystem`), damit UI/Hooks
 * sie nicht mehr inlinen muessen.
 */

import { describe, expect, it } from 'vitest'
import { isFilesystemBacked } from '@/lib/storage/library-capability'
import type { Library } from '@/types/library'

function makeLibrary(shadowTwin: Library['config']['shadowTwin']): Library {
  return {
    id: 'lib',
    label: 'Lib',
    type: 'local',
    path: '',
    isEnabled: true,
    config: { shadowTwin },
  } as Library
}

describe('isFilesystemBacked', () => {
  it('liefert false fuer null/undefined', () => {
    expect(isFilesystemBacked(null)).toBe(false)
    expect(isFilesystemBacked(undefined)).toBe(false)
  })

  it('liefert true bei Default (kein shadowTwin-Config -> Mongo primaer + Backup-Spiegel an)', () => {
    expect(isFilesystemBacked(makeLibrary(undefined))).toBe(true)
    expect(isFilesystemBacked(makeLibrary({}))).toBe(true)
  })

  it('liefert true bei expliziter primaryStore="filesystem"', () => {
    expect(isFilesystemBacked(makeLibrary({ primaryStore: 'filesystem' }))).toBe(true)
  })

  it('liefert true bei primaryStore="mongo" mit persistToFilesystem=true', () => {
    expect(
      isFilesystemBacked(makeLibrary({ primaryStore: 'mongo', persistToFilesystem: true })),
    ).toBe(true)
  })

  it('liefert true bei primaryStore="mongo" ohne persistToFilesystem (Backup-Spiegel ist Default an)', () => {
    expect(isFilesystemBacked(makeLibrary({ primaryStore: 'mongo' }))).toBe(true)
  })

  it('liefert false nur bei explizitem persistToFilesystem=false', () => {
    expect(
      isFilesystemBacked(makeLibrary({ primaryStore: 'mongo', persistToFilesystem: false })),
    ).toBe(false)
  })

  it('explizites persistToFilesystem=false gewinnt auch gegen Legacy-Wert primaryStore="filesystem"', () => {
    // Welle 2: das Config-Feld primaryStore wird nicht mehr gelesen —
    // massgeblich ist allein der Backup-Spiegel-Schalter.
    expect(
      isFilesystemBacked(makeLibrary({ primaryStore: 'filesystem', persistToFilesystem: false })),
    ).toBe(false)
  })
})
