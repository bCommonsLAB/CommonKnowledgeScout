/**
 * B1 — `publiziereMarkdownQuelle`: Reihenfolge Twin → Ingest, deterministischer
 * Vorlagenname, Warnungen blockieren ohne trotzWarnungen, harte Fehler immer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  upsertTwin: vi.fn(async () => ({})),
  twinOptions: [] as unknown[],
  ingest: vi.fn(async () => ({ chunksUpserted: 3, docUpserted: true, index: 'i' })),
  getMeta: vi.fn(),
  deleteVectors: vi.fn(async () => {}),
}))

vi.mock('@/lib/shadow-twin/store/shadow-twin-service', () => ({
  ShadowTwinService: class {
    constructor(opts: unknown) { h.twinOptions.push(opts) }
    upsertMarkdown = h.upsertTwin
  },
}))
vi.mock('@/lib/chat/ingestion-service', () => ({ IngestionService: { upsertMarkdown: h.ingest } }))
vi.mock('@/lib/repositories/vector-repo', () => ({
  getCollectionNameForLibrary: () => 'col',
  getMetaByFileId: h.getMeta,
  deleteVectorsByFileId: h.deleteVectors,
}))

import { depubliziereQuelle, publiziereMarkdownQuelle, VORLAGE_MARKDOWN, VORLAGE_WEBSITE, vorlageFuer } from '@/lib/mcp/website-publizieren'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'

const LIB = { id: 'lib-1' } as Library
const SOURCE = { itemId: 'src-1', parentId: 'parent-1', name: 'Startseite.md' }
const SEITE = '---\ndetailViewType: "website"\ntitle: "Startseite"\nlanguage: "de"\ntargetLanguage: "de"\n---\n<!-- section layout=text-only -->\n## Hi\n<!-- /section -->'

function providerMit(markdown: string): StorageProvider {
  return { getBinary: vi.fn(async () => ({ blob: new Blob([markdown]), mimeType: 'text/markdown' })) } as unknown as StorageProvider
}

beforeEach(() => {
  h.upsertTwin.mockClear()
  h.ingest.mockClear()
  h.twinOptions.length = 0
})

describe('publiziereMarkdownQuelle', () => {
  it('registriert die Transformation website-page und ingestiert unveraendert', async () => {
    const zeile = await publiziereMarkdownQuelle({
      library: LIB, userEmail: 'a@b.c', provider: providerMit(SEITE), source: SOURCE, zielsprache: 'de', trotzWarnungen: false,
    })
    expect(h.upsertTwin).toHaveBeenCalledWith({ kind: 'transformation', targetLanguage: 'de', templateName: VORLAGE_WEBSITE, markdown: SEITE })
    expect(h.twinOptions[0]).toMatchObject({ sourceId: 'src-1', sourceName: 'Startseite.md', parentId: 'parent-1' })
    expect(h.ingest).toHaveBeenCalledWith('a@b.c', 'lib-1', 'src-1', 'Startseite.md', SEITE, undefined, undefined, expect.anything())
    expect(h.upsertTwin.mock.invocationCallOrder[0]).toBeLessThan(h.ingest.mock.invocationCallOrder[0])
    expect(zeile).toMatchObject({ fileId: 'src-1', detailViewType: 'website', chunks: 3, warnungen: [] })
    expect(zeile.navigationSlug).toMatch(/^startseite-/)
  })

  it('Warnungen ohne trotzWarnungen: nichts geschrieben, Grund genannt', async () => {
    const md = '---\ntitle: "Notiz"\n---\nText'
    const zeile = await publiziereMarkdownQuelle({
      library: LIB, userEmail: 'a@b.c', provider: providerMit(md), source: { ...SOURCE, name: 'Notiz.md' }, zielsprache: 'de', trotzWarnungen: false,
    })
    expect(zeile.uebersprungen).toMatch(/trotzWarnungen/)
    expect(zeile.warnungen.length).toBeGreaterThan(0)
    expect(h.upsertTwin).not.toHaveBeenCalled()
    expect(h.ingest).not.toHaveBeenCalled()
  })

  it('mit trotzWarnungen wird eine Notiz ohne Typ als markdown-page publiziert', async () => {
    const md = '---\ntitle: "Notiz"\n---\nText'
    const zeile = await publiziereMarkdownQuelle({
      library: LIB, userEmail: 'a@b.c', provider: providerMit(md), source: { ...SOURCE, name: 'Notiz.md' }, zielsprache: 'de', trotzWarnungen: true,
    })
    expect(zeile.fileId).toBe('src-1')
    expect(h.upsertTwin).toHaveBeenCalledWith(expect.objectContaining({ templateName: VORLAGE_MARKDOWN }))
  })

  it('harter Fehler (ungueltiger Marker) wird auch mit trotzWarnungen nicht publiziert', async () => {
    const md = SEITE.replace('layout=text-only', 'layout=kachel')
    const zeile = await publiziereMarkdownQuelle({
      library: LIB, userEmail: 'a@b.c', provider: providerMit(md), source: SOURCE, zielsprache: 'de', trotzWarnungen: true,
    })
    expect(zeile.uebersprungen).toMatch(/^Fehler: Sektions-Marker/)
    expect(h.upsertTwin).not.toHaveBeenCalled()
  })

  it('Nicht-Markdown-Quellen werden mit Verweis auf quelle_erschliessen abgewiesen', async () => {
    await expect(publiziereMarkdownQuelle({
      library: LIB, userEmail: 'a@b.c', provider: providerMit(''), source: { ...SOURCE, name: 'rede.m4a' }, zielsprache: 'de', trotzWarnungen: true,
    })).rejects.toThrow(/quelle_erschliessen/)
  })
})

describe('vorlageFuer', () => {
  it('ist deterministisch je Typ', () => {
    expect(vorlageFuer('website')).toBe('website-page')
    expect(vorlageFuer('book')).toBe('markdown-page')
    expect(vorlageFuer(null)).toBe('markdown-page')
  })
})

describe('depubliziereQuelle', () => {
  it('loescht nur, wenn ein Meta-Dokument existiert, und sagt es', async () => {
    h.getMeta.mockResolvedValueOnce(null)
    expect(await depubliziereQuelle({ library: LIB, fileId: 'f' })).toEqual({ fileId: 'f', warPubliziert: false })
    expect(h.deleteVectors).not.toHaveBeenCalled()
    h.getMeta.mockResolvedValueOnce({ fileId: 'f' })
    expect(await depubliziereQuelle({ library: LIB, fileId: 'f' })).toEqual({ fileId: 'f', warPubliziert: true })
    expect(h.deleteVectors).toHaveBeenCalledWith('col', 'f')
  })
})
