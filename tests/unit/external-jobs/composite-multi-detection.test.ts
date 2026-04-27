/**
 * @fileoverview Unit-Tests fuer den Composite-Multi-Image-Pfad (S5).
 *
 * Geprueft wird:
 * - `isCompositeMultiMarkdown` erkennt das Frontmatter-kind
 * - `peekCompositeMultiSource` liefert das Markdown nur fuer .md-Quellen mit kind=composite-multi
 *
 * Der vollstaendige `runCompositeMultiImagePath` ist eng mit Mongo, Secretary
 * und SSE-Bus verzahnt und wird im manuellen E2E-Test (S8) abgenommen.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isCompositeMultiMarkdown,
  peekCompositeMultiSource,
} from '@/lib/external-jobs/run-composite-multi-image'
import type { StorageProvider } from '@/lib/storage/types'
import type { ExternalJob } from '@/types/external-job'

/**
 * Erzeugt einen Provider-Mock, der fuer eine ID ein Markdown-Blob zurueckgibt.
 */
function makeProviderWithMarkdown(idToMarkdown: Record<string, string>): StorageProvider {
  return {
    name: 'mock',
    id: 'mock',
    isAuthenticated: () => true,
    getBinary: vi.fn(async (id: string) => {
      const md = idToMarkdown[id]
      if (md == null) throw new Error(`no markdown for ${id}`)
      return {
        blob: new Blob([md], { type: 'text/markdown' }),
        mimeType: 'text/markdown',
      }
    }),
  } as unknown as StorageProvider
}

/**
 * Minimal-ExternalJob fuer Source-Detection-Tests.
 */
function makeJob(opts: { itemId: string; name: string }): ExternalJob {
  return {
    jobId: 'job-1',
    job_type: 'text',
    libraryId: 'lib-1',
    userEmail: 'u@example.com',
    correlation: {
      source: { itemId: opts.itemId, name: opts.name, parentId: 'p-1' },
    },
  } as unknown as ExternalJob
}

describe('isCompositeMultiMarkdown', () => {
  it('erkennt kind=composite-multi im Frontmatter', () => {
    const md = '---\nkind: composite-multi\n_source_files: ["a.jpg","b.jpg"]\n---\n# X\n'
    expect(isCompositeMultiMarkdown(md)).toBe(true)
  })

  it('erkennt kind=composite-transcript NICHT als composite-multi', () => {
    const md = '---\nkind: composite-transcript\n_source_files: ["a.pdf"]\n---\n'
    expect(isCompositeMultiMarkdown(md)).toBe(false)
  })

  it('liefert false ohne Frontmatter', () => {
    expect(isCompositeMultiMarkdown('# Plain\nNo frontmatter.')).toBe(false)
  })

  it('liefert false bei kaputtem Frontmatter', () => {
    expect(isCompositeMultiMarkdown('--\nbroken')).toBe(false)
  })
})

describe('peekCompositeMultiSource', () => {
  it('liefert das Markdown bei .md-Quelle mit kind=composite-multi', async () => {
    const md = '---\nkind: composite-multi\n_source_files: ["a.jpg","b.jpg"]\n---\n'
    const provider = makeProviderWithMarkdown({ 'src-1': md })
    const job = makeJob({ itemId: 'src-1', name: 'sammlung.md' })

    const peeked = await peekCompositeMultiSource({ provider, job })
    expect(peeked).toBe(md)
  })

  it('liefert null bei .md-Quelle OHNE kind=composite-multi', async () => {
    const md = '---\nkind: composite-transcript\n---\n'
    const provider = makeProviderWithMarkdown({ 'src-1': md })
    const job = makeJob({ itemId: 'src-1', name: 'transkript.md' })

    const peeked = await peekCompositeMultiSource({ provider, job })
    expect(peeked).toBeNull()
  })

  it('liefert null bei nicht-.md-Quelle (kein getBinary-Call)', async () => {
    const provider = makeProviderWithMarkdown({})
    const job = makeJob({ itemId: 'src-1', name: 'foto.jpg' })

    const peeked = await peekCompositeMultiSource({ provider, job })
    expect(peeked).toBeNull()
    // getBinary darf gar nicht aufgerufen werden — Source ist offensichtlich kein Markdown.
    expect(provider.getBinary as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('liefert null bei fehlender source.itemId', async () => {
    const provider = makeProviderWithMarkdown({})
    const job = {
      jobId: 'job-1',
      job_type: 'text',
      libraryId: 'lib-1',
      userEmail: 'u@example.com',
      correlation: { source: { name: 'irgendwas.md', parentId: 'p-1' } },
    } as unknown as ExternalJob

    const peeked = await peekCompositeMultiSource({ provider, job })
    expect(peeked).toBeNull()
  })

  it('liefert null und logt, wenn getBinary wirft', async () => {
    const provider = makeProviderWithMarkdown({})
    const job = makeJob({ itemId: 'unknown-id', name: 'sammlung.md' })

    const peeked = await peekCompositeMultiSource({ provider, job })
    expect(peeked).toBeNull()
  })
})
