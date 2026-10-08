/**
 * Welle C — Quellen eines Ordners hinter dem Zaun sammeln: Twin-/test-Ordner
 * werden genannt, unbekannte Dateien gezaehlt, Obergrenze schneidet ab.
 */
import { describe, it, expect } from 'vitest'
import { sammleOrdnerQuellen } from '@/lib/mcp/ordner-quellen'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

function item(id: string, name: string, type: 'file' | 'folder', parentId: string): StorageItem {
  return { id, parentId, type, metadata: { name, mimeType: type === 'folder' ? 'folder' : '' } } as unknown as StorageItem
}

const BAUM: Record<string, StorageItem[]> = {
  root: [item('f1', 'Massnahmen', 'folder', 'root'), item('t', '_Twin', 'folder', 'root'), item('x', 'test', 'folder', 'root'), item('a', 'A.pdf', 'file', 'root'), item('j', 'a.json', 'file', 'root')],
  f1: [item('b', 'B.m4a', 'file', 'f1'), item('c', 'C.md', 'file', 'f1')],
  t: [item('z', 'A.de.md', 'file', 't')],
  x: [item('y', 'Y.pdf', 'file', 'x')],
}

const provider = { listItemsById: async (id: string) => BAUM[id] ?? [] } as unknown as StorageProvider

describe('sammleOrdnerQuellen', () => {
  it('rekursiv: nimmt Pipeline-Dateien, ueberspringt Zaun-Ordner und nennt sie', async () => {
    const r = await sammleOrdnerQuellen({ provider, folderId: 'root', rekursiv: true, maxQuellen: 50 })
    expect(r.quellen.map((q) => q.name)).toEqual(['A.pdf', 'B.m4a', 'C.md'])
    expect(r.quellen[1]).toMatchObject({ itemId: 'b', parentId: 'f1' })
    expect(r.uebersprungeneOrdner).toEqual(['_Twin', 'test'])
    expect(r.uebersprungeneDateien).toBe(1)
    expect(r.abgeschnitten).toBe(false)
  })

  it('nicht rekursiv: nur die Dateien des Ordners selbst', async () => {
    const r = await sammleOrdnerQuellen({ provider, folderId: 'root', rekursiv: false, maxQuellen: 50 })
    expect(r.quellen.map((q) => q.name)).toEqual(['A.pdf'])
    expect(r.uebersprungeneOrdner).toEqual([])
  })

  it('schneidet an der Obergrenze ab und sagt es', async () => {
    const r = await sammleOrdnerQuellen({ provider, folderId: 'root', rekursiv: true, maxQuellen: 2 })
    expect(r.quellen).toHaveLength(2)
    expect(r.abgeschnitten).toBe(true)
  })
})
