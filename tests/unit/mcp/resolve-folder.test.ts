/**
 * @fileoverview Unit-Tests: Pfad → folderId-Resolver der MCP-Bruecke (Welle 5).
 *
 * Schliesst das Henne-Ei aus dem Cowork-Pilot: Teilbaum-Scope ohne
 * vorhandenen Coverage-Report. Positiv- und Negativfall je Regel.
 */

import { describe, it, expect } from 'vitest'
import type { StorageProvider } from '@/lib/storage/types'
import { FolderPathNotFoundError, resolveFolderIdByPath, resolveItemByPath } from '@/lib/mcp/resolve-folder'

function fakeProvider(tree: Record<string, Array<{ id: string; type: 'file' | 'folder'; name: string }>>): StorageProvider {
  return {
    listItemsById: async (id: string) =>
      (tree[id] ?? []).map((item) => ({ id: item.id, type: item.type, metadata: { name: item.name } })),
  } as unknown as StorageProvider
}

const PROVIDER = fakeProvider({
  root: [
    { id: 'f-klima', type: 'folder', name: '26.01 Klima' },
    { id: 'f-notizen', type: 'folder', name: 'Notizen' },
    { id: 'f-notizen-2', type: 'folder', name: 'notizen' },
    { id: 'x-datei', type: 'file', name: '26.01 Klima' },
  ],
  'f-klima': [{ id: 'f-berichte', type: 'folder', name: 'Berichte' }],
})

describe('resolveFolderIdByPath', () => {
  it('loest mehrstufige Pfade auf (ein Listing pro Segment)', async () => {
    expect(await resolveFolderIdByPath(PROVIDER, '26.01 Klima')).toBe('f-klima')
    expect(await resolveFolderIdByPath(PROVIDER, '/26.01 Klima/Berichte/')).toBe('f-berichte')
  })

  it('matcht case-insensitiv nur bei Eindeutigkeit — sonst Fehler statt Raten', async () => {
    expect(await resolveFolderIdByPath(PROVIDER, '26.01 KLIMA/berichte')).toBe('f-berichte')
    await expect(resolveFolderIdByPath(PROVIDER, 'NOTIZEN')).rejects.toThrow(/mehrdeutig/)
  })

  it('nennt bei unbekanntem Segment Ebene und vorhandene Ordner (Dateien zaehlen nicht)', async () => {
    const fehler = await resolveFolderIdByPath(PROVIDER, '26.01 Klima/Gibtsnicht', []).catch((e: unknown) => e)
    expect(fehler).toBeInstanceOf(FolderPathNotFoundError)
    expect((fehler as Error).message).toContain('Gibtsnicht')
    expect((fehler as Error).message).toContain('26.01 Klima')
    expect((fehler as Error).message).toContain('Berichte')
  })

  it('leerer Pfad ist ein Fehler, kein stiller Library-Volllauf', async () => {
    await expect(resolveFolderIdByPath(PROVIDER, '  /  ')).rejects.toThrow(FolderPathNotFoundError)
  })

  it('listet bei fehlendem Segment erneut (B6: OneDrive-Sync-Latenz frischer Ordner)', async () => {
    // Erster Aufruf: Ebene noch leer; zweiter: der frische Ordner ist sichtbar.
    let calls = 0
    const provider = {
      listItemsById: async () => {
        calls += 1
        return calls < 2 ? [] : [{ id: 'f-neu', type: 'folder', metadata: { name: 'Neu' } }]
      },
    } as unknown as StorageProvider
    expect(await resolveFolderIdByPath(provider, 'Neu', [0])).toBe('f-neu')
    expect(calls).toBe(2)

    // Mehrdeutigkeit wirft SOFORT — Warten macht sie nicht eindeutig.
    let ambigCalls = 0
    const ambig = {
      listItemsById: async () => {
        ambigCalls += 1
        return [
          { id: 'a', type: 'folder', metadata: { name: 'notizen' } },
          { id: 'b', type: 'folder', metadata: { name: 'Notizen' } },
        ]
      },
    } as unknown as StorageProvider
    await expect(resolveFolderIdByPath(ambig, 'NOTIZEN', [0, 0])).rejects.toThrow(/mehrdeutig/)
    expect(ambigCalls).toBe(1)
  })
})

describe('resolveItemByPath — Datei-Ziele fuer familie_umziehen', () => {
  it('die erwartete Art entscheidet bei Namensgleichheit von Datei und Ordner (kein Raten)', async () => {
    const alsDatei = await resolveItemByPath(PROVIDER, '26.01 Klima', 'file')
    expect(alsDatei).toMatchObject({ id: 'x-datei', type: 'file', parentFolderId: 'root' })
    const alsOrdner = await resolveItemByPath(PROVIDER, '26.01 Klima', 'folder')
    expect(alsOrdner).toMatchObject({ id: 'f-klima', type: 'folder' })
  })

  it('Datei erwartet, aber nur Ordner vorhanden → Fehler mit Hinweis (Negativfall)', async () => {
    await expect(resolveItemByPath(PROVIDER, '26.01 Klima/Berichte', 'file', [])).rejects.toThrow(
      FolderPathNotFoundError,
    )
  })
})
