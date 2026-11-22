/**
 * @fileoverview Tests: MCP-Werkzeug `nachbarn_berechnen` (Owner 23.11.2026).
 *
 * Die Aehnlichkeits-Nachbarn, die der Teppich voraussetzt, ueber die Bruecke statt ueber die
 * Graph-Ansicht der Galerie. Nur der Owner; legt einen Job `doc-similarity` an.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  enqueue: vi.fn(),
  istOwner: vi.fn(),
  requireLibrary: vi.fn(),
  tick: vi.fn(),
  registriert: new Map<string, { handler: (args: never) => Promise<unknown> }>(),
}))

vi.mock('@/lib/repositories/aktions-protokoll-repo', () => ({
  protokolliereAktion: vi.fn().mockResolvedValue(undefined),
  MAX_BEGRUENDUNG: 500,
}))
vi.mock('@/lib/external-jobs/enqueue-doc-similarity', () => ({ enqueueDocSimilarityJob: h.enqueue }))
vi.mock('@/lib/external-jobs/enqueue-doc-teppich', () => ({ enqueueDocTeppichJob: vi.fn() }))
vi.mock('@/lib/repositories/library-members-repo', () => ({ isLibraryOwner: h.istOwner, isCoCreatorOrOwner: vi.fn() }))
vi.mock('@/lib/external-jobs-worker', () => ({ ExternalJobsWorker: { tickNow: h.tick } }))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return {
    LIBRARY_ID: z.string(),
    mcpUserEmail: () => 'owner@beispiel.org',
    requireLibrary: h.requireLibrary,
    jsonResult: (wert: unknown) => ({ ok: true, wert }),
    errorResult: (fehler: unknown) => ({ ok: false, fehler: (fehler as Error).message }),
  }
})

import { registerTeppichTool } from '@/lib/mcp/tools-teppich'

const server = {
  registerTool: (name: string, _schema: unknown, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, { handler })
  },
} as never

function aufrufen() {
  const eintrag = h.registriert.get('nachbarn_berechnen')
  if (!eintrag) throw new Error('nachbarn_berechnen nicht registriert')
  return eintrag.handler({ libraryId: 'lib-1', begruendung: 'Test' } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  h.registriert.clear()
  registerTeppichTool(server)
  h.requireLibrary.mockResolvedValue({ id: 'lib-1' })
  h.enqueue.mockResolvedValue({ jobId: 'job-1', jobSecret: 'x' })
  h.tick.mockResolvedValue(undefined)
})

describe('nachbarn_berechnen', () => {
  it('legt fuer den Owner einen Job an und stoesst den Worker an', async () => {
    h.istOwner.mockResolvedValue(true)
    const r = await aufrufen()
    expect(r).toMatchObject({ ok: true, wert: { libraryId: 'lib-1', jobId: 'job-1', angestossen: true } })
    expect(h.enqueue).toHaveBeenCalledWith({ libraryId: 'lib-1', userEmail: 'owner@beispiel.org' })
  })

  it('verweigert anderen als dem Owner, ohne Job', async () => {
    h.istOwner.mockResolvedValue(false)
    const r = await aufrufen()
    expect(r).toMatchObject({ ok: false })
    expect((r as { fehler: string }).fehler).toContain('Nur der Owner')
    expect(h.enqueue).not.toHaveBeenCalled()
  })
})
