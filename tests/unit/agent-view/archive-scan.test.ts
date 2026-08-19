import { describe, it, expect } from 'vitest'
import { scanArchive, type ArchiveScanProvider } from '@/lib/agent-view/archive-scan'
import type { StorageItem } from '@/lib/storage/types'

function file(id: string, name: string, parentId: string, modifiedAt = '2026-08-01T10:00:00.000Z'): StorageItem {
  return { id, parentId, type: 'file', metadata: { name, size: 1, modifiedAt: new Date(modifiedAt), mimeType: 'text/markdown' } }
}

function dir(id: string, name: string, parentId: string): StorageItem {
  return { id, parentId, type: 'folder', metadata: { name, size: 0, modifiedAt: new Date('2026-08-01T10:00:00.000Z'), mimeType: 'application/folder' } }
}

const INDEX_MD = ['---', 'bearbeitungsstand: abgenommen', 'bearbeitungsstand_seit: 2026-08-18', '---', '', 'Siehe [[Aufnahme.md]].'].join('\n')

function makeProvider(overrides: { failFolderId?: string } = {}): ArchiveScanProvider {
  const tree: Record<string, StorageItem[]> = {
    root: [dir('f-pilot', '25.01 Pilot', 'root'), dir('f-temp', 'temp', 'root')],
    'f-pilot': [
      file('idx', '_INDEX.md', 'f-pilot'),
      file('src', 'Aufnahme.m4a', 'f-pilot'),
      dir('twin', '_Aufnahme.m4a', 'f-pilot'),
    ],
    twin: [file('a1', 'Aufnahme.md', 'twin')],
    'f-temp': [file('t1', 'muell.txt', 'f-temp')],
  }
  return {
    async listItemsById(folderId: string) {
      if (folderId === overrides.failFolderId) throw new Error('Zugriff verweigert')
      return tree[folderId] ?? []
    },
    async getBinary(fileId: string) {
      const text = fileId === 'idx' ? INDEX_MD : '# leer'
      return { blob: new Blob([text], { type: 'text/markdown' }), mimeType: 'text/markdown' }
    },
  }
}

describe('archive-scan', () => {
  it('liest _INDEX.md-Frontmatter und Body und leitet den Stand ab', async () => {
    const result = await scanArchive({ provider: makeProvider(), rootFolderId: 'root' })
    const pilot = result.folders.find((f) => f.folderId === 'f-pilot')
    expect(pilot?.bearbeitungsstand).toBe('abgenommen')
    expect(pilot?.bearbeitungsstandSeit).toBe('2026-08-18T23:59:59.999Z')
    expect(pilot?.index?.body).toContain('[[Aufnahme.md]]')
  })

  it('betritt Twin-Ordner nicht als Archiv-Ordner, erfasst sie aber mit Artefakten', async () => {
    const result = await scanArchive({ provider: makeProvider(), rootFolderId: 'root' })
    expect(result.folders.map((f) => f.folderId)).not.toContain('twin')
    const pilot = result.folders.find((f) => f.folderId === 'f-pilot')
    expect(pilot?.twinFolders[0]).toMatchObject({ expectedSourceName: 'Aufnahme.m4a', sourcePresent: true, artifactNames: ['Aufnahme.md'] })
  })

  it('haelt ausgeschlossene Teilbaeume draussen, zaehlt sie aber sichtbar', async () => {
    const result = await scanArchive({ provider: makeProvider(), rootFolderId: 'root', excludeGlobs: ['temp'] })
    expect(result.folders.map((f) => f.folderId)).not.toContain('f-temp')
    expect(result.skippedExcluded).toBe(1)
  })

  it('isoliert einen Ordner-Lesefehler im Knoten, statt den Scan abzubrechen', async () => {
    const result = await scanArchive({ provider: makeProvider({ failFolderId: 'f-pilot' }), rootFolderId: 'root' })
    const pilot = result.folders.find((f) => f.folderId === 'f-pilot')
    expect(pilot?.error).toContain('Zugriff verweigert')
    expect(result.folders.length).toBeGreaterThan(1)
  })
})
