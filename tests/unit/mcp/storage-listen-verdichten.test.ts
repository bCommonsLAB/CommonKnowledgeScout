/**
 * Welle W5 — Antwortgrenze und Verdichtung fuer `ordner_listen`.
 *
 * Der Beleg: `tiefe: 2` auf einen grossen Vorhabensordner ergab 78.634
 * Zeichen; der Ordner blieb deswegen ungeprueft. `limit` half nicht — es
 * begrenzt die Zahl der Eintraege, nicht die Groesse der Antwort.
 */
import { describe, expect, it } from 'vitest'
import { listeOrdner } from '@/lib/mcp/storage/listen'
import { begrenzeSeite, fasseZusammen } from '@/lib/mcp/storage/listen-verdichten'
import type { StorageItem } from '@/lib/storage/types'

function datei(name: string, id = name, groesse = 7, geaendert = '2026-08-27T10:00:00Z'): StorageItem {
  return { id, parentId: 'p', type: 'file', metadata: { name, size: groesse, modifiedAt: new Date(geaendert), mimeType: 'text/markdown', version: `v-${id}` } }
}
function ordner(name: string, id = name): StorageItem {
  return { id, parentId: 'p', type: 'folder', metadata: { name, size: 0, modifiedAt: new Date('2026-08-27T10:00:00Z'), mimeType: 'application/folder' } }
}

const baum: Record<string, StorageItem[]> = {
  root: [ordner('26.01 Klima', 'f1'), ordner('26.02 Wasser', 'f2'), datei('BERICHT.md', 'd0', 100)],
  f1: [datei('Notiz.md', 'd1', 500, '2026-09-01T08:00:00Z'), ordner('unter', 'f3')],
  f3: [datei('tief.md', 'd2', 250, '2026-08-30T08:00:00Z')],
  f2: [datei('leer.md', 'd3', 10, '2026-07-01T08:00:00Z')],
}
const liste = async (id: string) => baum[id] ?? []

describe('begrenzeSeite', () => {
  const eintraege = Array.from({ length: 20 }, (_, i) => ({
    name: `d${i}.md`, pfad: `ordner/d${i}.md`, id: `id${i}`,
    typ: 'datei' as const, groesse: 1, geaendertAm: '2026-08-27T10:00:00.000Z',
  }))

  it('kuerzt am Ende und sagt es — eine gekappte Liste darf nicht vollstaendig aussehen', () => {
    const r = begrenzeSeite(eintraege, 200)
    expect(r.seite.length).toBeGreaterThan(0)
    expect(r.seite.length).toBeLessThan(20)
    expect(r.gekuerzt).toContain('von 20 Eintraegen')
  })

  it('meldet nichts, wenn alles passt', () => {
    expect(begrenzeSeite(eintraege, 1024 * 1024).gekuerzt).toBeUndefined()
  })

  it('liefert den ersten Eintrag auch dann, wenn er allein das Budget reisst', () => {
    // Sonst: leere Seite mit Cursor, der auf derselben Stelle stehen bleibt —
    // eine Endlosschleife, die wie ein leerer Ordner aussieht.
    const r = begrenzeSeite(eintraege, 1)
    expect(r.seite).toHaveLength(1)
    expect(r.gekuerzt).toBeDefined()
  })
})

describe('fasseZusammen', () => {
  it('zaehlt den GANZEN Zweig, nicht nur seine erste Ebene', async () => {
    const voll = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 3, limit: 500 })
    const z = fasseZusammen(voll.eintraege, '', 'root')
    const klima = z.find((r) => r.pfad === '26.01 Klima')

    // Notiz.md (Ebene 1) UND tief.md (Ebene 2) zaehlen zu diesem Zweig.
    expect(klima).toMatchObject({ id: 'f1', dateien: 2, ordner: 1, gesamtGroesse: 750 })
    expect(klima?.juengsteAenderung).toBe('2026-09-01T08:00:00.000Z')
  })

  it('legt Eintraege direkt im Ordner in den Bucket "."', async () => {
    const voll = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 3, limit: 500 })
    const z = fasseZusammen(voll.eintraege, '', 'root')
    const direkt = z.find((r) => r.pfad === '.')
    // BERICHT.md plus die beiden direkten Unterordner.
    expect(direkt).toMatchObject({ id: 'root', dateien: 1, ordner: 2, gesamtGroesse: 100 })
  })

  it('gibt einen nicht betretenen Unterordner als Zeile mit Nullen aus, statt ihn zu verschweigen', async () => {
    const flach = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 0, limit: 500 })
    const z = fasseZusammen(flach.eintraege, '', 'root')
    expect(z.map((r) => r.pfad)).toEqual(['.', '26.01 Klima', '26.02 Wasser'])
    expect(z.find((r) => r.pfad === '26.02 Wasser')).toMatchObject({
      id: 'f2', dateien: 0, ordner: 0, gesamtGroesse: 0, juengsteAenderung: null,
    })
  })

  it('laesst die Id offen, statt sie zu raten, wenn muster den Ordner herausfiltert', async () => {
    const nurMd = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 3, muster: '*.md', limit: 500 })
    const z = fasseZusammen(nurMd.eintraege, '', 'root')
    expect(z.find((r) => r.pfad === '26.01 Klima')).toMatchObject({ id: null, dateien: 2 })
  })
})

describe('listeOrdner mit maxBytes und zusammenfassung', () => {
  it('begrenzt die GROESSE der Antwort, nicht nur ihre Zahl', async () => {
    const r = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 3, limit: 500, maxBytes: 300 })
    expect(r.gekuerzt).toBeDefined()
    expect(r.eintraege.length).toBeLessThan(6)
    // Gekuerzt heisst nicht fertig: es muss weitergeblaettert werden koennen.
    expect(r.weitereVorhanden).toBe(true)
    expect(r.naechsterCursor).not.toBeNull()
  })

  it('liefert bei zusammenfassung=true die Verdichtung statt der Namensliste', async () => {
    const r = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 3, limit: 1, zusammenfassung: true })
    expect(r.eintraege).toEqual([])
    expect(r.zusammenfassung?.map((z) => z.pfad)).toEqual(['.', '26.01 Klima', '26.02 Wasser'])
    // Die Verdichtung blaettert nicht — sonst zerschnitte limit den Ueberblick.
    expect(r.weitereVorhanden).toBe(false)
    expect(r.naechsterCursor).toBeNull()
  })

  it('behaelt gelisteteOrdner und abgeschnitten auch in der Verdichtung', async () => {
    const r = await listeOrdner({ liste, folderId: 'root', ordnerPfad: '', tiefe: 3, limit: 10, zusammenfassung: true })
    expect(r.gelisteteOrdner).toBe(4)
  })
})
