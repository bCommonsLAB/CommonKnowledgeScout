/**
 * @fileoverview Unit-Tests: Tiefengrenze + Stapel-Parallelisierung des Archiv-Scans (W1).
 *
 * Der parallele Lauf muss dasselbe Ergebnis in derselben Reihenfolge liefern
 * wie der serielle — und die Tiefengrenze darf Ordner jenseits der Grenze
 * nicht betreten.
 */

import { describe, it, expect } from 'vitest'
import { scanArchive, type ArchiveScanProvider } from '@/lib/agent-view/archive-scan'

/** Kuenstlicher Baum: Wurzel → 3 Bereiche → je 3 Projekte → je 2 Ereignisordner. */
function fakeProvider(): ArchiveScanProvider & { calls: string[] } {
  const calls: string[] = []
  const folder = (id: string, name: string) => ({ id, type: 'folder' as const, parentId: '', metadata: { name } })
  const file = (id: string, name: string) => ({ id, type: 'file' as const, parentId: '', metadata: { name, modifiedAt: new Date('2026-08-01') } })
  return {
    calls,
    async listItemsById(folderId: string) {
      calls.push(folderId)
      await new Promise((resolve) => setTimeout(resolve, 1))
      if (folderId === 'root') return [folder('b1', '1. A'), folder('b2', '2. B'), folder('b3', '3. C')]
      if (/^b\d$/.test(folderId)) return [1, 2, 3].map((n) => folder(`${folderId}-p${n}`, `26.0${n} Projekt`))
      if (/^b\d-p\d$/.test(folderId)) return [folder(`${folderId}-e1`, '2026-01 Ereignis'), folder(`${folderId}-e2`, '2026-02 Ereignis'), file(`${folderId}-f`, 'BERICHT.md')]
      return [file(`${folderId}-x`, 'x.pdf')]
    },
    async getBinary() {
      return { blob: new Blob(['---\nprojekt: P\n---\n# P\n']), mimeType: 'text/markdown' }
    },
  } as unknown as ArchiveScanProvider & { calls: string[] }
}

describe('scanArchive — maxDepth + concurrency', () => {
  it('paralleler Lauf liefert dieselben Ordner (sortiert) wie der serielle', async () => {
    const seriell = await scanArchive({ provider: fakeProvider(), rootFolderId: 'root', concurrency: 1 })
    const parallel = await scanArchive({ provider: fakeProvider(), rootFolderId: 'root', concurrency: 6 })
    const sorted = (r: typeof seriell) => r.folders.map((f) => f.path).sort()
    expect(sorted(parallel)).toEqual(sorted(seriell))
    expect(parallel.folders.length).toBe(1 + 3 + 9 + 18)
    expect(parallel.folders.filter((f) => f.bericht).length).toBe(9)
  })

  it('maxDepth betritt Ordner jenseits der Grenze nicht (Ereignisordner bleiben ungelistet)', async () => {
    const provider = fakeProvider()
    const result = await scanArchive({ provider, rootFolderId: 'root', maxDepth: 2, concurrency: 6 })
    expect(result.folders.length).toBe(1 + 3 + 9)
    expect(provider.calls.some((id) => id.includes('-e'))).toBe(false)
    // Berichte der Projektordner (Tiefe 2) sind trotzdem gelesen.
    expect(result.folders.filter((f) => f.bericht).length).toBe(9)
  })

  it("docs: 'nur-bericht' liest keine _INDEX.md (Reads sind fuer Sichten reine Kosten)", async () => {
    let reads = 0
    const provider = fakeProvider()
    const base = provider.getBinary.bind(provider)
    provider.getBinary = async (id: string) => { reads += 1; return base(id) }
    const list = provider.listItemsById.bind(provider)
    provider.listItemsById = async (id: string) => {
      const items = await list(id)
      const index = { id: `${id}-i`, type: 'file', parentId: '', metadata: { name: '_INDEX.md', modifiedAt: new Date('2026-08-01') } } as unknown as (typeof items)[number]
      return /^b\d-p\d$/.test(id) ? [...items, index] : items
    }
    const result = await scanArchive({ provider, rootFolderId: 'root', maxDepth: 2, docs: 'nur-bericht' })
    expect(result.folders.filter((f) => f.bericht).length).toBe(9)
    expect(result.folders.filter((f) => f.index).length).toBe(0)
    expect(reads).toBe(9)
  })

  it('stopDescent steigt unter Projektordnern (mit BERICHT.md) nicht weiter ab', async () => {
    const provider = fakeProvider()
    const result = await scanArchive({ provider, rootFolderId: 'root', concurrency: 4, stopDescent: (node) => node.bericht !== null })
    expect(result.folders.length).toBe(1 + 3 + 9)
    expect(provider.calls.some((id) => id.includes('-e'))).toBe(false)
  })
})
