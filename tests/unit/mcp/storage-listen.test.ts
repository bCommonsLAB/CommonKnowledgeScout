/**
 * Welle ST2 — Blaetterung, Muster, Tiefe.
 *
 * Der Beleg hinter diesen Tests: Ein rekursiver Lauf ueber 1.100 Ordner riss
 * das 60-Sekunden-Limit der Bruecke. Eine Grenze, die stillschweigend kappt,
 * waere schlimmer als keine — sie saehe aus wie eine vollstaendige Antwort.
 */
import { describe, expect, it } from 'vitest'
import { MAX_LISTINGS, listeOrdner, musterAlsRegex } from '@/lib/mcp/storage/listen'
import type { StorageItem } from '@/lib/storage/types'

function datei(name: string, id = name): StorageItem {
  return { id, parentId: 'p', type: 'file', metadata: { name, size: 7, modifiedAt: new Date('2026-08-27T10:00:00Z'), mimeType: 'text/markdown', version: `v-${id}` } }
}
function ordner(name: string, id = name): StorageItem {
  return { id, parentId: 'p', type: 'folder', metadata: { name, size: 0, modifiedAt: new Date('2026-08-27T10:00:00Z'), mimeType: 'application/folder' } }
}

describe('musterAlsRegex', () => {
  it('versteht * und ?, ohne Punkte als Platzhalter zu lesen', () => {
    expect(musterAlsRegex('*.md').test('BERICHT.md')).toBe(true)
    expect(musterAlsRegex('*.md').test('BERICHTxmd')).toBe(false)
    expect(musterAlsRegex('_*').test('_INDEX.md')).toBe(true)
    expect(musterAlsRegex('BERICHT.?d').test('BERICHT.md')).toBe(true)
  })

  it('ignoriert Gross-/Kleinschreibung (OneDrive tut das auch)', () => {
    expect(musterAlsRegex('*.MD').test('bericht.md')).toBe(true)
  })
})

describe('listeOrdner', () => {
  const baum: Record<string, StorageItem[]> = {
    root: [ordner('26.01 Klima', 'f1'), datei('BERICHT.md', 'd1')],
    f1: [datei('_INDEX.md', 'd2'), datei('Notiz.md', 'd3'), ordner('_twins', 'f2')],
    f2: [datei('artefakt.md', 'd4')],
  }
  const liste = async (id: string) => baum[id] ?? []

  it('liefert Metadaten je Eintrag — kein zweiter Aufruf pro Datei noetig', async () => {
    const r = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 0, limit: 10 })
    expect(r.eintraege).toEqual([
      { name: '26.01 Klima', pfad: '26.01 Klima', id: 'f1', typ: 'ordner', groesse: 0, geaendertAm: '2026-08-27T10:00:00.000Z' },
      { name: 'BERICHT.md', pfad: 'BERICHT.md', id: 'd1', typ: 'datei', groesse: 7, geaendertAm: '2026-08-27T10:00:00.000Z', version: 'v-d1' },
    ])
    expect(r.gelisteteOrdner).toBe(1)
  })

  it('steigt nur bis zur angegebenen Tiefe ab und baut Pfade mit', async () => {
    const r = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 1, limit: 50 })
    expect(r.eintraege.map((e) => e.pfad)).toEqual([
      '26.01 Klima', 'BERICHT.md', '26.01 Klima/_INDEX.md', '26.01 Klima/Notiz.md', '26.01 Klima/_twins',
    ])
    // Tiefe 1 heisst: f2 wird nicht mehr gelistet.
    expect(r.eintraege.some((e) => e.id === 'd4')).toBe(false)
  })

  it('filtert die Ausgabe, ohne den Abstieg abzuwuergen', async () => {
    const r = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 2, muster: '*.md', limit: 50 })
    // Ordner fallen aus der Ausgabe, werden aber weiter durchsucht.
    expect(r.eintraege.map((e) => e.name)).toEqual(['BERICHT.md', '_INDEX.md', 'Notiz.md', 'artefakt.md'])
  })

  it('blaettert und meldet, ob noch etwas kommt', async () => {
    const seite1 = await listeOrdner({ liste, folderId: 'f1', ordnerPfad: '26.01 Klima', tiefe: 0, limit: 2 })
    expect(seite1.eintraege).toHaveLength(2)
    expect(seite1.weitereVorhanden).toBe(true)

    const seite2 = await listeOrdner({
      liste, folderId: 'f1', ordnerPfad: '26.01 Klima', tiefe: 0, limit: 2,
      cursor: seite1.naechsterCursor as string,
    })
    expect(seite2.eintraege.map((e) => e.name)).toEqual(['_twins'])
    expect(seite2.weitereVorhanden).toBe(false)
    expect(seite2.naechsterCursor).toBeNull()
  })

  it('wirft bei einem Cursor, der nicht von hier stammt', async () => {
    await expect(listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 0, limit: 5, cursor: 'abc' }))
      .rejects.toThrow(/Ungueltiger cursor/)
  })

  it('bricht bei zu vielen Ordnern ab und SAGT es, statt still zu kappen', async () => {
    // Ein Baum, der breiter ist als die Grenze erlaubt.
    const breit: Record<string, StorageItem[]> = { root: [] }
    for (let i = 0; i < MAX_LISTINGS + 50; i++) {
      breit.root.push(ordner(`o${i}`, `id${i}`))
      breit[`id${i}`] = [datei(`f${i}.md`, `df${i}`)]
    }
    const r = await listeOrdner({
      liste: async (id) => breit[id] ?? [], folderId: 'root', ordnerPfad: '', tiefe: 1, limit: 5,
    })
    expect(r.gelisteteOrdner).toBe(MAX_LISTINGS)
    expect(r.abgeschnitten).toMatch(/Ordner ungelesen/)
  })
})
