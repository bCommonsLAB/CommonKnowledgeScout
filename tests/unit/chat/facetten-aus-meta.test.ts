import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Befund 07.10.2026: Chunks, die vor dem Anlegen einer Facette ingestiert
 * wurden, tragen deren Wert nicht — der Orchestrator zieht ihn aus dem
 * Meta-Dokument nach, damit Quellen-Header (m3) und Nachprüfung (m4) ihn sehen.
 */

const h = vi.hoisted(() => ({
  find: vi.fn(),
}))

vi.mock('@/lib/repositories/vector-repo', () => ({
  getCollectionOnly: async () => ({ find: h.find }),
}))

import { ergaenzeFacettenAusMeta } from '@/lib/chat/facetten-aus-meta'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type { RetrievedSource } from '@/types/retriever'

const DEFS: FacetDef[] = [
  { metaKey: 'lv_bewertung', label: 'Bewertung', type: 'string', multi: true, visible: true },
  { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
]

function quelle(id: string, fileId: string, metadata?: Record<string, unknown>): RetrievedSource {
  return { id, fileId, fileName: `${fileId}.md`, chunkIndex: 0, text: 'x', sourceType: 'body', metadata }
}

beforeEach(() => {
  h.find.mockReset()
})

describe('ergaenzeFacettenAusMeta', () => {
  it('fragt nur Dokumente mit Lücke ab und füllt nur fehlende Schlüssel (Chunk-Werte haben Vorrang)', async () => {
    h.find.mockReturnValue({
      toArray: async () => [
        { fileId: 'alt', docMetaJson: { lv_bewertung: 'nicht_umsetzbar', tags: ['a'] } },
      ],
    })
    const sources = [
      quelle('alt-0', 'alt', { tags: ['chunk-tag'] }),
      quelle('alt-1', 'alt', undefined),
      quelle('neu-0', 'neu', { lv_bewertung: 'in_umsetzung', tags: ['b'] }),
    ]
    const e = await ergaenzeFacettenAusMeta(sources, DEFS, 'col', 'lib')
    expect(h.find).toHaveBeenCalledTimes(1)
    const [filter, options] = h.find.mock.calls[0]
    expect(filter).toEqual({ kind: 'meta', libraryId: 'lib', fileId: { $in: ['alt'] } })
    expect(options.projection).toEqual({ fileId: 1, docMetaJson: 1, lv_bewertung: 1, tags: 1 })
    expect(sources[0].metadata).toEqual({ tags: ['chunk-tag'], lv_bewertung: 'nicht_umsetzbar' })
    expect(sources[1].metadata).toEqual({ lv_bewertung: 'nicht_umsetzbar', tags: ['a'] })
    expect(sources[2].metadata).toEqual({ lv_bewertung: 'in_umsetzung', tags: ['b'] })
    expect(e).toEqual({ dokumenteMitLuecke: 1, metaGefunden: 1, ergaenzt: 3 })
  })

  it('Top-Level-Wert des Meta-Dokuments (Backfill) schlägt docMetaJson', async () => {
    h.find.mockReturnValue({
      toArray: async () => [{ fileId: 'a', lv_bewertung: 'nicht_umsetzbar', docMetaJson: { lv_bewertung: 'Nicht umsetzbar' } }],
    })
    const sources = [quelle('a-0', 'a', { tags: [] })]
    await ergaenzeFacettenAusMeta(sources, DEFS, 'col', 'lib')
    expect(sources[0].metadata?.lv_bewertung).toBe('nicht_umsetzbar')
  })

  it('ohne Lücke keine Abfrage; ohne Meta-Dokument bleibt die Lücke sichtbar in den Zahlen', async () => {
    const voll = [quelle('a-0', 'a', { lv_bewertung: 'unklar', tags: [] })]
    expect(await ergaenzeFacettenAusMeta(voll, DEFS, 'col', 'lib')).toEqual({ dokumenteMitLuecke: 0, metaGefunden: 0, ergaenzt: 0 })
    expect(h.find).not.toHaveBeenCalled()

    h.find.mockReturnValue({ toArray: async () => [] })
    const luecke = [quelle('b-0', 'b', undefined)]
    expect(await ergaenzeFacettenAusMeta(luecke, DEFS, 'col', 'lib')).toEqual({ dokumenteMitLuecke: 1, metaGefunden: 0, ergaenzt: 0 })
    expect(luecke[0].metadata).toBeUndefined()
  })
})
