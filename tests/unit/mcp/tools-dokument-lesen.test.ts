/**
 * Welle K1 — Werkzeug `dokument_lesen`: Meta-Dokument ueber getMetaByFileId,
 * sourceId ODER pfad, fehlender Eintrag als Antwort statt Fehler. Repo,
 * Provider und tool-shared sind gemockt (Muster tools-stand.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  getMetaByFileId: vi.fn(),
  requireLibrary: vi.fn(),
  requireProvider: vi.fn(),
  resolveSourceItem: vi.fn(),
  registriert: new Map<string, { schema: Record<string, unknown>; handler: (args: never) => Promise<unknown> }>(),
}))

vi.mock('@/lib/repositories/vector-repo', () => ({
  getMetaByFileId: h.getMetaByFileId,
  getCollectionNameForLibrary: () => 'doc_meta__lib-1',
}))
vi.mock('@/lib/mcp/tools-erschliessen-shared', () => ({ resolveSourceItem: h.resolveSourceItem }))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return {
    LIBRARY_ID: z.string(),
    mcpUserEmail: () => 'a@b.c',
    requireLibrary: h.requireLibrary,
    requireProvider: h.requireProvider,
    jsonResult: (wert: unknown) => ({ ok: true, wert }),
    errorResult: (fehler: unknown) => ({ ok: false, fehler: (fehler as Error).message }),
  }
})

import { registerDokumentLesenTool } from '@/lib/mcp/tools-dokument-lesen'

const server = {
  registerTool: (name: string, schema: Record<string, unknown>, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, { schema, handler })
  },
} as never

function aufrufen(args: Record<string, unknown>) {
  const eintrag = h.registriert.get('dokument_lesen')
  if (!eintrag) throw new Error('dokument_lesen nicht registriert')
  return eintrag.handler(args as never) as Promise<{ ok: boolean; wert?: Record<string, unknown>; fehler?: string }>
}

const META = {
  fileId: 'src-1', fileName: 'Corbo.md', title: 'Corbo', slug: 'corbo', upsertedAt: '2026-10-11T20:00:00.000Z',
  docMetaJson: { coverImageUrl: 'https://b/x.jpeg', slides: [{ page_num: 1, image_url: 'https://b/p1.jpeg' }], attachments_url: ['https://b/a.pdf'], attachments_names: ['A.pdf'] },
}

beforeEach(() => {
  vi.clearAllMocks()
  h.registriert.clear()
  registerDokumentLesenTool(server)
  h.requireLibrary.mockResolvedValue({ id: 'lib-1', config: { publicPublishing: { slugName: 'neu', publicName: 'N', description: '', isPublic: true } } })
  h.requireProvider.mockResolvedValue({})
})

describe('dokument_lesen', () => {
  it('liest die Lesersicht ueber sourceId samt Galerie-Adresse', async () => {
    h.getMetaByFileId.mockResolvedValue(META)
    const antwort = await aufrufen({ libraryId: 'lib-1', sourceId: 'src-1' })
    expect(h.getMetaByFileId).toHaveBeenCalledWith('doc_meta__lib-1', 'src-1')
    expect(h.requireProvider).not.toHaveBeenCalled()
    expect(antwort.wert).toMatchObject({
      sourceId: 'src-1', quelle: 'Corbo.md', vorhanden: true, titel: 'Corbo',
      coverImageUrl: 'https://b/x.jpeg', anhaenge: [{ name: 'A.pdf', url: 'https://b/a.pdf' }],
      folien: { anzahl: 1, mitAdresse: 1, ohneAdresse: [] },
      galerieAdresse: '/explore/neu?doc=corbo', galerieAdresseGrund: null,
    })
  })

  it('loest pfad ueber den Provider auf', async () => {
    h.resolveSourceItem.mockResolvedValue({ itemId: 'src-9', parentId: 'p', name: 'X.md' })
    h.getMetaByFileId.mockResolvedValue({ ...META, fileId: 'src-9' })
    const antwort = await aufrufen({ libraryId: 'lib-1', pfad: 'events/X.md' })
    expect(h.resolveSourceItem).toHaveBeenCalledWith({}, undefined, 'events/X.md')
    expect(h.getMetaByFileId).toHaveBeenCalledWith('doc_meta__lib-1', 'src-9')
    expect(antwort.wert?.vorhanden).toBe(true)
  })

  it('meldet einen fehlenden Eintrag als Antwort mit Weg, nicht als Fehler', async () => {
    h.getMetaByFileId.mockResolvedValue(null)
    const antwort = await aufrufen({ libraryId: 'lib-1', sourceId: 'src-2' })
    expect(antwort.ok).toBe(true)
    expect(antwort.wert).toMatchObject({ sourceId: 'src-2', vorhanden: false })
    expect(String(antwort.wert?.hinweis)).toMatch(/index_aktualisieren/)
  })

  it('verlangt sourceId oder pfad', async () => {
    const antwort = await aufrufen({ libraryId: 'lib-1' })
    expect(antwort.ok).toBe(false)
    expect(antwort.fehler).toMatch(/sourceId oder pfad/)
  })
})
