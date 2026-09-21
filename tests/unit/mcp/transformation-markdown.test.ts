/**
 * @fileoverview Unit-Tests: `transformation_starten` fuer Markdown und Sammeldateien.
 *
 * Bruecken-Luecke 21.09.2026 — die drei Abnahmefaelle:
 *  (a) einfache Markdown-Quelle → Job
 *  (b) Sammeldatei mit aufgeloesten Quellen → Job
 *  (c) Sammeldatei mit einer unaufgeloesten Quelle → Fehler mit Dateinamen, KEIN Job
 * Dazu die Job-Form: wie die Pipeline-Route des UI, ohne vorab gefuetterten Text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(async (_job: Record<string, unknown>) => {}),
  hashSecret: vi.fn(() => 'hash'),
  resolve: vi.fn(),
}))

vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    create = mocks.create
    hashSecret = mocks.hashSecret
  },
}))

vi.mock('@/lib/creation/composite-transcript', () => ({
  resolveCompositeTranscript: mocks.resolve,
}))

import { istMarkdownQuelle, starteMarkdownTransformation } from '@/lib/mcp/transformation-markdown'
import type { StorageProvider } from '@/lib/storage/types'

const SOURCE = { itemId: 'item-1', parentId: 'parent-1', name: 'auftragsklaerung.md' }

const COMPOSITE = [
  '---',
  'kind: composite-transcript',
  '_include_self: true',
  '_source_files: ["pdfs/a.pdf", "videos/auftragsklaerung.md"]',
  '---',
  '',
  'Eigener Text der Karte.',
].join('\n')

function providerMit(markdown: string): StorageProvider {
  return {
    getBinary: vi.fn(async () => ({ blob: new Blob([markdown]), mimeType: 'text/markdown' })),
  } as unknown as StorageProvider
}

function start(markdown: string) {
  return starteMarkdownTransformation({
    libraryId: 'lib-1', userEmail: 'peter@example.com', provider: providerMit(markdown),
    source: SOURCE, template: 'commoning-methode-de', llmModel: 'modell-x',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('istMarkdownQuelle', () => {
  it('nimmt .md/.mdx/.txt wie die Pipeline-Route, sonst nichts', () => {
    expect(istMarkdownQuelle('karte.md')).toBe(true)
    expect(istMarkdownQuelle('Karte.MDX')).toBe(true)
    expect(istMarkdownQuelle('notiz.txt')).toBe(true)
    expect(istMarkdownQuelle('programm.pdf')).toBe(false)
    expect(istMarkdownQuelle('aufnahme.m4a')).toBe(false)
  })
})

describe('starteMarkdownTransformation', () => {
  it('(a) einfache Markdown-Quelle: Job in UI-Form, ohne Composite-Pruefung', async () => {
    const { jobId } = await start('---\ntitle: Test\n---\n\nEin Absatz Text.')
    expect(jobId).toBeTruthy()
    expect(mocks.resolve).not.toHaveBeenCalled()

    const job = mocks.create.mock.calls[0][0]
    expect(job).toMatchObject({ job_type: 'text', operation: 'extract', worker: 'secretary', status: 'queued' })
    expect((job.steps as Array<{ name: string }>).map((s) => s.name))
      .toEqual(['extract_pdf', 'transform_template', 'ingest_rag'])
    expect(job.parameters).toMatchObject({
      template: 'commoning-methode-de',
      llmModel: 'modell-x',
      targetLanguage: 'de',
      phases: { extract: false, template: true, ingest: true },
      policies: { extract: 'ignore', metadata: 'do', ingest: 'do' },
    })
    const correlation = job.correlation as { source: Record<string, unknown> }
    expect(correlation.source).toMatchObject({
      mediaType: 'markdown', mimeType: 'text/markdown', itemId: 'item-1', parentId: 'parent-1',
    })
  })

  it('(b) Sammeldatei, alles aufgeloest: prueft nur die Quellen und legt den Job an', async () => {
    mocks.resolve.mockResolvedValue({ markdown: '', unresolvedSources: [] })
    const { jobId } = await start(COMPOSITE)
    expect(jobId).toBeTruthy()
    expect(mocks.resolve).toHaveBeenCalledWith(expect.objectContaining({
      nurQuellenPruefen: true,
      compositeMarkdown: COMPOSITE,
      parentId: 'parent-1',
      compositeFileName: 'auftragsklaerung.md',
      compositeSourceId: 'item-1',
      targetLanguage: 'de',
    }))
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('(c) Sammeldatei mit unaufgeloester Quelle: Fehler nennt die Datei, KEIN Job', async () => {
    mocks.resolve.mockResolvedValue({ markdown: '', unresolvedSources: ['pdfs/a.pdf'] })
    await expect(start(COMPOSITE)).rejects.toThrow(/pdfs\/a\.pdf.*quelle_erschliessen.*Kein Job/s)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('leere Markdown-Quelle (nur Frontmatter): Fehler statt leerem Job', async () => {
    await expect(start('---\ntitle: Leer\n---\n')).rejects.toThrow(/keinen Text/)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
