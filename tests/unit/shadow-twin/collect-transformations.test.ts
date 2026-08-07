/**
 * @fileoverview Unit-Tests fuer collectTransformations: Slot-Union (Mongo ∪
 * Storage), kanonischer Datei-Vorrang, Lesefehler-Sicherheit.
 */

import { describe, it, expect, vi } from 'vitest'
import { collectTransformations } from '@/lib/shadow-twin/sync-engine/collect-transformations'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

function file(id: string, name: string): StorageItem {
  return { id, type: 'file', parentId: 'twin', metadata: { name, modifiedAt: new Date('2026-08-01T12:00:00Z') } } as unknown as StorageItem
}

function makeDoc(transformation: Record<string, Record<string, { markdown: string; updatedAt: string }>>): ShadowTwinDocument {
  return {
    libraryId: 'lib-1', sourceId: 'src-1', sourceName: 'doc.pdf', parentId: 'parent',
    artifacts: { transformation }, createdAt: '', updatedAt: '',
  } as unknown as ShadowTwinDocument
}

function makeProvider(contents: Record<string, string>, failFor?: string) {
  return {
    getBinary: vi.fn(async (id: string) => {
      if (id === failFor) throw new Error('WebDAV 500')
      return { blob: new Blob([contents[id] ?? '']) }
    }),
  } as unknown as StorageProvider
}

describe('collectTransformations', () => {
  it('Union: Mongo-only-Slot + Storage-only-Slot + beidseitiger Slot', async () => {
    const doc = makeDoc({
      alpha: { de: { markdown: 'A-mongo', updatedAt: '2026-08-01T12:00:00Z' } },
      beta: { en: { markdown: 'B-mongo', updatedAt: '2026-08-01T12:00:00Z' } },
    })
    const items = [
      file('f-b', 'doc.beta.en.md'),      // beidseitig
      file('f-c', 'doc.gamma.de.md'),     // storage-only → Adoption-Kandidat
      file('f-x', 'other.beta.en.md'),    // fremde Quelle → ignoriert
    ]
    const { transformations, notes } = await collectTransformations({
      doc, twinFolderItems: items, sourceBaseName: 'doc', sourceName: 'doc.pdf',
      provider: makeProvider({ 'f-b': 'B-storage', 'f-c': 'C-storage' }),
    })
    expect(notes).toEqual([])
    const byKey = new Map(transformations.map((t) => [`${t.templateName}/${t.targetLanguage}`, t]))
    expect(byKey.size).toBe(3)
    expect(byKey.get('alpha/de')?.mongo?.markdown).toBe('A-mongo')
    expect(byKey.get('alpha/de')?.storage).toBeNull()
    expect(byKey.get('beta/en')?.storage?.markdown).toBe('B-storage')
    expect(byKey.get('gamma/de')?.mongo).toBeNull()
    expect(byKey.get('gamma/de')?.storage?.markdown).toBe('C-storage')
  })

  it('Lesefehler: Slot wird NICHT geplant (Notiz statt Fehl-Overwrite)', async () => {
    const doc = makeDoc({
      alpha: { de: { markdown: 'A-mongo', updatedAt: '2026-08-01T12:00:00Z' } },
    })
    const items = [file('f-a', 'doc.alpha.de.md')]
    const { transformations, notes } = await collectTransformations({
      doc, twinFolderItems: items, sourceBaseName: 'doc', sourceName: 'doc.pdf',
      provider: makeProvider({}, 'f-a'),
    })
    expect(transformations).toEqual([])
    expect(notes[0]).toContain('nicht lesbar')
    expect(notes[0]).toContain('uebersprungen')
  })

  it('kanonischer Dateiname hat Vorrang, wenn mehrere Dateien auf denselben Slot parsen', async () => {
    const doc = makeDoc({})
    const items = [
      file('f-legacy', 'DOC.alpha.de.md'),  // parst (case-insensitiver Prefix), aber nicht kanonisch
      file('f-canon', 'doc.alpha.de.md'),   // kanonisch
    ]
    const { transformations } = await collectTransformations({
      doc, twinFolderItems: items, sourceBaseName: 'doc', sourceName: 'doc.pdf',
      provider: makeProvider({ 'f-canon': 'C', 'f-legacy': 'L' }),
    })
    expect(transformations).toHaveLength(1)
    expect(transformations[0].storage?.fileId).toBe('f-canon')
  })
})
