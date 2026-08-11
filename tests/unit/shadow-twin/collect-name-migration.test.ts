/**
 * @fileoverview Unit-Tests fuer die Collect-Schicht der Namens-Migration
 * (Welle 5c): Frontmatter-Klassifikation im Doc-Pfad (Muster A raus aus der
 * Transkript-Reconcile) und gezieltes Inhalt-Lesen im Adoptions-Pfad.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  classifyTranscriptCandidates,
  collectAdoptionNameMigration,
  hasLeadingFrontmatter,
} from '@/lib/shadow-twin/sync-engine/collect-name-migration'
import type { ReconcileCandidate } from '@/lib/shadow-twin/reconcile-plan'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const FRONTMATTER_MD = '---\ntitle: X\n---\nBody'
const PLAIN_MD = '# Transkript\nSeite 1'

function file(id: string, name: string, parentId = 'top'): StorageItem {
  return { id, type: 'file', parentId, metadata: { name } } as unknown as StorageItem
}

describe('hasLeadingFrontmatter', () => {
  it('erkennt nur die erste Zeile ---', () => {
    expect(hasLeadingFrontmatter(FRONTMATTER_MD)).toBe(true)
    expect(hasLeadingFrontmatter('---\r\nkey: 1\r\n---\r\n')).toBe(true)
    expect(hasLeadingFrontmatter(PLAIN_MD)).toBe(false)
    expect(hasLeadingFrontmatter(' ---\nkein Frontmatter')).toBe(false)
  })
})

describe('classifyTranscriptCandidates (Doc-Pfad)', () => {
  const candidates: ReconcileCandidate[] = [
    { fileId: 't-1', name: 'doc.md', markdown: PLAIN_MD, origin: 'storage' },
    { fileId: 't-2', name: 'doc.de.md', markdown: FRONTMATTER_MD, origin: 'storage' },
    { fileId: 't-3', name: 'doc.en.md', markdown: PLAIN_MD, origin: 'storage' },
  ]

  it('Muster A (Frontmatter) verlaesst die Transkript-Kandidaten, Legacy-Transkript bleibt', () => {
    const result = classifyTranscriptCandidates({
      storageCandidates: candidates, sourceBaseName: 'doc', sourceName: 'doc.pdf',
      twinFolderItems: [], parentPathLength: null,
    })
    expect(result.transcriptCandidates.map((c) => c.name)).toEqual(['doc.md', 'doc.en.md'])
    expect(result.legacyNamed).toHaveLength(2)
    expect(result.legacyNamed[0]).toMatchObject({ fileName: 'doc.de.md', hasFrontmatter: true, inTwinFolder: true })
    expect(result.legacyNamed[1]).toMatchObject({ fileName: 'doc.en.md', hasFrontmatter: false })
    expect(result.combined).toBeNull()
  })

  it('kanonische {base}.md MIT Frontmatter wird Kombi-Kandidat und bleibt Kandidat', () => {
    const result = classifyTranscriptCandidates({
      storageCandidates: [{ fileId: 't-1', name: 'doc.md', markdown: FRONTMATTER_MD, origin: 'storage' }],
      sourceBaseName: 'doc', sourceName: 'doc.pdf', twinFolderItems: [], parentPathLength: null,
    })
    expect(result.transcriptCandidates.map((c) => c.name)).toEqual(['doc.md'])
    expect(result.combined).toMatchObject({ fileId: 't-1', fileName: 'doc.md', markdown: FRONTMATTER_MD })
  })

  it('mit Scan-Pfadlaenge: existingFiles tragen Pfadlaengen (Twin-Ordner + Quelle)', () => {
    const result = classifyTranscriptCandidates({
      storageCandidates: [], sourceBaseName: 'doc', sourceName: 'doc.pdf',
      twinFolderItems: [file('x', 'doc.md', 'twin')], parentPathLength: 10,
    })
    expect(result.existingFiles).toHaveLength(2)
    for (const f of result.existingFiles) expect(f.pathLength).toBeGreaterThan(10)
  })
})

describe('collectAdoptionNameMigration (Adoptions-Pfad)', () => {
  const contentByFileId: Record<string, string> = {
    'l-1': FRONTMATTER_MD,
    'l-2': PLAIN_MD,
    'c-1': FRONTMATTER_MD,
  }
  const provider = {
    getBinary: vi.fn(async (id: string) => ({ blob: new Blob([contentByFileId[id] ?? '']) })),
  } as unknown as StorageProvider

  it('liest nur legacy/kanonische Dateien und klassifiziert Muster A + Kombi', async () => {
    const result = await collectAdoptionNameMigration({
      source: file('pdf-1', 'doc.pdf'),
      parentItems: [file('pdf-1', 'doc.pdf'), file('l-2', 'doc.en.md')],
      twinFolderItems: [file('l-1', 'doc.de.md', 'twin'), file('c-1', 'doc.md', 'twin'), file('img', 'page_001.jpeg', 'twin')],
      provider, parentPathLength: null,
    })
    expect(result.musterAFileIds).toEqual(new Set(['l-1']))
    expect(result.legacyNamed.map((f) => f.fileName).sort()).toEqual(['doc.de.md', 'doc.en.md'])
    expect(result.combined).toMatchObject({ fileId: 'c-1', markdown: FRONTMATTER_MD, inTwinFolder: true })
    // Bilder werden NICHT gelesen — nur die drei Markdown-Kandidaten.
    expect(provider.getBinary).toHaveBeenCalledTimes(3)
    // Quelle selbst + Twin-Dateien + base-bezogene Geschwister im Pfad-Report.
    expect(result.existingFiles.map((f) => f.fileName).sort()).toEqual(
      ['doc.de.md', 'doc.en.md', 'doc.md', 'doc.pdf', 'page_001.jpeg'],
    )
  })
})
