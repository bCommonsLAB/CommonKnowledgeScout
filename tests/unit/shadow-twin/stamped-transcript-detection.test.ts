/**
 * @fileoverview Unit-Tests: gestempeltes Transkript ist keine Kombi-Datei (Welle 0d)
 *
 * Die Legacy-Erkennung wertet „hat Frontmatter" als „alte Transformation bzw.
 * Kombi-Datei". Seit der Writer den Twin-Kern stempelt, tragen ALLE neuen
 * Transkripte Frontmatter — im Pilot fuehrte das zu sechs falschen
 * Konflikt-Befunden („Ziel-Name existiert bereits").
 */

import { describe, it, expect } from 'vitest'
import { isStampedTranscript, classifyTranscriptCandidates } from '@/lib/shadow-twin/sync-engine/collect-name-migration'

const STAMPED = [
  '---',
  'generated_by: "knowledgescout/pipeline"',
  'generated_at: "2026-08-18T09:41:31.102Z"',
  'type: "transcript"',
  'source_file: "doc.m4a"',
  '---',
  'So, heute habe ich einige Boilerplates ausprobiert.',
].join('\n')

const KOMBI = ['---', 'tags: a, b', 'Type: Gedanken', '---', '# Titel', 'Inhalt'].join('\n')

describe('isStampedTranscript', () => {
  it('erkennt den Twin-Kern eines Transkripts (auch ohne Quotes)', () => {
    expect(isStampedTranscript(STAMPED)).toBe(true)
    expect(isStampedTranscript('---\ntype: transcript\n---\nText')).toBe(true)
  })

  it('alte Kombi-Datei, Transformation und Text ohne Frontmatter sind es nicht', () => {
    expect(isStampedTranscript(KOMBI)).toBe(false)
    expect(isStampedTranscript('---\ntype: "transformation"\n---\nText')).toBe(false)
    expect(isStampedTranscript('Nur Text ohne Frontmatter')).toBe(false)
  })
})

describe('classifyTranscriptCandidates — Kombi-Erkennung', () => {
  const classify = (markdown: string) =>
    classifyTranscriptCandidates({
      storageCandidates: [{ fileId: 'f-1', name: 'doc.md', markdown, origin: 'storage' }],
      sourceBaseName: 'doc', sourceName: 'doc.m4a', twinFolderItems: [], parentPathLength: null,
    })

  it('gestempeltes Transkript wird NICHT als Kombi-Datei behandelt', () => {
    expect(classify(STAMPED).combined).toBeNull()
  })

  it('echte Kombi-Datei mit altem Frontmatter wird weiterhin erkannt', () => {
    expect(classify(KOMBI).combined).toMatchObject({ fileId: 'f-1', fileName: 'doc.md' })
  })
})
