// @vitest-environment node
/**
 * Quellen einer Sammeldatei ueber Ordnergrenzen finden (composite-source-path).
 *
 * Anlass: Die Karten-Markdowns der Commoning-Mustersprache liegen eine Ebene
 * ueber ihren PDFs (`pdfs-pngs/musterkarten pdf/…`). Bisher fand der Resolver
 * nur Nachbarn im selben Ordner. Der Provider ist hier ein Stummel mit einem
 * festen Ordnerbaum; gezaehlt wird auch, dass jeder Ordner nur einmal gelistet
 * wird.
 */

import { describe, it, expect } from 'vitest'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import { findCompositeSourceItems } from '@/lib/creation/composite-source-path'
import { parseCompositeSourceEntry } from '@/lib/creation/composite-source-entry'

interface Knoten { id: string; name: string; type: 'file' | 'folder'; children?: Knoten[] }

const BAUM: Knoten = {
  id: 'root', name: '', type: 'folder', children: [
    { id: 'we', name: 'Web-Entwürfe', type: 'folder', children: [
      { id: 'mk', name: 'musterkarten', type: 'folder', children: [
        { id: 'karte-md', name: 'karte-01.md', type: 'file' },
        { id: 'nachbar', name: 'nachbar.pdf', type: 'file' },
        { id: 'pp', name: 'pdfs-pngs', type: 'folder', children: [
          { id: 'mpdf', name: 'musterkarten pdf', type: 'folder', children: [
            { id: 'front', name: 'karte-01_front.pdf', type: 'file' },
            { id: 'rueck', name: 'karte-01_rueck.pdf', type: 'file' },
          ] },
        ] },
      ] },
    ] },
  ],
}

function stummelProvider(): { provider: StorageProvider; listings: string[] } {
  const listings: string[] = []
  const byId = new Map<string, Knoten>()
  const sammeln = (k: Knoten) => { byId.set(k.id, k); k.children?.forEach(sammeln) }
  sammeln(BAUM)
  const provider = {
    listItemsById: async (folderId: string): Promise<StorageItem[]> => {
      listings.push(folderId)
      const ordner = byId.get(folderId)
      if (!ordner) throw new Error(`Ordner unbekannt: ${folderId}`)
      return (ordner.children ?? []).map((k) => ({
        id: k.id, type: k.type, parentId: folderId,
        metadata: { name: k.name },
      })) as unknown as StorageItem[]
    },
  } as unknown as StorageProvider
  return { provider, listings }
}

describe('findCompositeSourceItems', () => {
  it('findet Nachbarn ohne Pfad wie bisher (im Ordner der Sammeldatei)', async () => {
    const { provider } = stummelProvider()
    const found = await findCompositeSourceItems(provider, 'mk', [parseCompositeSourceEntry('nachbar.pdf')])
    expect(found.get('nachbar.pdf')).toEqual({ id: 'nachbar', name: 'nachbar.pdf', parentId: 'mk' })
  })

  it('loest Pfade relativ zum Ordner der Sammeldatei auf und nennt den echten Elternordner', async () => {
    const { provider } = stummelProvider()
    const raw = 'pdfs-pngs/musterkarten pdf/karte-01_rueck.pdf'
    const found = await findCompositeSourceItems(provider, 'mk', [parseCompositeSourceEntry(raw)])
    expect(found.get(raw)).toEqual({ id: 'rueck', name: 'karte-01_rueck.pdf', parentId: 'mpdf' })
  })

  it('faellt auf die Library-Wurzel zurueck (Obsidian-Vault-Schreibweise)', async () => {
    const { provider } = stummelProvider()
    const raw = 'Web-Entwürfe/musterkarten/pdfs-pngs/musterkarten pdf/karte-01_front.pdf'
    const found = await findCompositeSourceItems(provider, 'mk', [parseCompositeSourceEntry(raw)])
    expect(found.get(raw)?.id).toBe('front')
  })

  it('meldet Unbekanntes nicht als Treffer — kein stiller Ersatz', async () => {
    const { provider } = stummelProvider()
    const raw = 'pdfs-pngs/gibt-es-nicht/karte.pdf'
    const found = await findCompositeSourceItems(provider, 'mk', [parseCompositeSourceEntry(raw)])
    expect(found.has(raw)).toBe(false)
  })

  it('listet jeden Ordner nur einmal, auch bei mehreren Eintraegen', async () => {
    const { provider, listings } = stummelProvider()
    const eintraege = [
      'pdfs-pngs/musterkarten pdf/karte-01_front.pdf',
      'pdfs-pngs/musterkarten pdf/karte-01_rueck.pdf',
      'nachbar.pdf',
    ].map(parseCompositeSourceEntry)
    const found = await findCompositeSourceItems(provider, 'mk', eintraege)
    expect(found.size).toBe(3)
    expect(new Set(listings).size).toBe(listings.length)
  })
})
