/**
 * @fileoverview Unit-Tests fuer die Preset-Filterung (allowed-ops.ts):
 * repair / export / auto-sync duerfen nur ihre jeweilige Teilmenge ausfuehren.
 */

import { describe, it, expect } from 'vitest'
import { filterAllowedOperations, isOperationAllowed } from '@/lib/shadow-twin/sync-plan/allowed-ops'
import type { SyncOperation, SyncOperationType } from '@/lib/shadow-twin/sync-plan/types'

function op(type: SyncOperationType, overrides: Partial<SyncOperation> = {}): SyncOperation {
  return { type, kind: 'transcript', targetLanguage: '', fileName: 'doc.md', ...overrides }
}

/** Ein Plan mit je einer Operation jeder Klasse (Overwrite-Varianten separat). */
const ALL_OPS: SyncOperation[] = [
  op('write-canonical-transcript', { overwrite: false }),
  op('write-canonical-transcript', { overwrite: true }),
  op('update-mongo-transcript'),
  op('update-mongo-transformation', { kind: 'transformation', templateName: 't', targetLanguage: 'de' }),
  op('mirror-artifact-to-storage', { kind: 'transformation', templateName: 't', targetLanguage: 'de', overwrite: false }),
  op('mirror-artifact-to-storage', { kind: 'transformation', templateName: 't', targetLanguage: 'de', overwrite: true }),
  op('mirror-image-to-storage', { kind: 'image', fileName: 'page_001.jpeg' }),
  op('register-image-fragments', { kind: 'image', fileName: '', count: 3 }),
  op('delete-inferior-variant', { fileId: 'f1', fileName: 'doc.en.md' }),
  op('delete-dead-page-md', { fileId: 'f2', fileName: 'page_001.md' }),
  op('needs-pipeline', { kind: 'source', fileName: 'doc.pdf' }),
  op('conflict'),
]

describe('isOperationAllowed / filterAllowedOperations', () => {
  it('Report-only (conflict, needs-pipeline) ist in KEINEM Preset erlaubt', () => {
    for (const preset of ['repair', 'export', 'auto-sync'] as const) {
      for (const persistToFilesystem of [true, false]) {
        expect(isOperationAllowed(op('conflict'), preset, { persistToFilesystem })).toBe(false)
        expect(isOperationAllowed(op('needs-pipeline'), preset, { persistToFilesystem })).toBe(false)
      }
    }
  })

  it('repair MIT persistToFilesystem: alles ausser Bilder-Export', () => {
    const allowed = filterAllowedOperations(ALL_OPS, 'repair', { persistToFilesystem: true })
    expect(allowed.map((o) => o.type)).toEqual([
      'write-canonical-transcript', 'write-canonical-transcript',
      'update-mongo-transcript', 'update-mongo-transformation',
      'mirror-artifact-to-storage', 'mirror-artifact-to-storage',
      'register-image-fragments',
      'delete-inferior-variant', 'delete-dead-page-md',
    ])
  })

  it('repair OHNE persistToFilesystem: keine Storage-Spiegel, aber Mongo-Angleich + Loeschen', () => {
    const allowed = filterAllowedOperations(ALL_OPS, 'repair', { persistToFilesystem: false })
    expect(allowed.map((o) => o.type)).toEqual([
      'update-mongo-transcript', 'update-mongo-transformation',
      'register-image-fragments',
      'delete-inferior-variant', 'delete-dead-page-md',
    ])
  })

  it('export: NUR Storage-Spiegel (auch ohne persistToFilesystem), nie Mongo, nie Loeschen', () => {
    for (const persistToFilesystem of [true, false]) {
      const allowed = filterAllowedOperations(ALL_OPS, 'export', { persistToFilesystem })
      expect(allowed.map((o) => o.type)).toEqual([
        'write-canonical-transcript', 'write-canonical-transcript',
        'mirror-artifact-to-storage', 'mirror-artifact-to-storage',
        'mirror-image-to-storage',
      ])
    }
  })

  it('auto-sync: Mongo-Uebernahme + Fehlendes ergaenzen, NIE Overwrite, NIE Loeschen', () => {
    const allowed = filterAllowedOperations(ALL_OPS, 'auto-sync', { persistToFilesystem: true })
    expect(allowed.map((o) => [o.type, o.overwrite ?? null])).toEqual([
      ['write-canonical-transcript', false],
      ['update-mongo-transcript', null],
      ['update-mongo-transformation', null],
      ['mirror-artifact-to-storage', false],
    ])
  })

  it('auto-sync ohne persistToFilesystem: nur Mongo-Uebernahme', () => {
    const allowed = filterAllowedOperations(ALL_OPS, 'auto-sync', { persistToFilesystem: false })
    expect(allowed.map((o) => o.type)).toEqual(['update-mongo-transcript', 'update-mongo-transformation'])
  })
})
