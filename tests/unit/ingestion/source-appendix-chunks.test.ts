import { describe, it, expect } from 'vitest'
import { anhangPageSpans, markiereAnhangChunks } from '@/lib/ingestion/source-appendix-chunks'
import type { VectorDocument } from '@/lib/ingestion/vector-builder'
import type { SourceAppendix } from '@/types/external-jobs'

/**
 * Unsichtbarer Ingest-Anhang: Chunks im Anhang bekommen Kapitel und Quelle,
 * Seitenanker des Anhangs faerben nicht auf den Body ab.
 */

function appendixFixture(): SourceAppendix {
  const kap1 = '## Anhang 1: rede.m4a (Transkript)\n\nGesprochener Text der Rede.'
  const kap2 = '## Anhang 2: folien.pdf (Transkript)\n\n--- Seite 1 ---\nFolie eins\n--- Seite 2 ---\nFolie zwei'
  const markdown = `--- Anhang beginnt hier ---\n\n${kap1}\n\n${kap2}`
  const start1 = markdown.indexOf(kap1)
  const start2 = markdown.indexOf(kap2)
  return {
    markdown,
    sections: [
      { index: 1, title: 'Anhang 1: rede.m4a (Transkript)', sourceName: 'rede.m4a', art: 'Transkript', start: start1, end: start1 + kap1.length },
      { index: 2, title: 'Anhang 2: folien.pdf (Transkript)', sourceName: 'folien.pdf', art: 'Transkript', start: start2, end: start2 + kap2.length },
    ],
  }
}

function vector(startChar: number): VectorDocument {
  return {
    _id: `f-${startChar}`, kind: 'chunk', libraryId: 'lib', user: 'u', fileId: 'f', fileName: 'f.md',
    chunkIndex: startChar, text: 'x', embedding: [], upsertedAt: '2026-10-05T00:00:00.000Z', startChar,
  }
}

describe('markiereAnhangChunks', () => {
  it('ordnet Chunks im Anhang ihrem Kapitel zu und laesst Body-Chunks unberuehrt', () => {
    const appendix = appendixFixture()
    const body = 'Body-Text ohne Anker.'
    const offset = body.length + 2
    const vectors = [
      vector(0),
      vector(offset + appendix.sections[0].start + 5),
      vector(offset + appendix.sections[1].start + 5),
    ]
    const markiert = markiereAnhangChunks(vectors, appendix, offset)
    expect(markiert).toBe(2)
    expect(vectors[0].sourceType).toBeUndefined()
    expect(vectors[1]).toMatchObject({ sourceType: 'anhang', anhangIndex: 1, anhangQuelle: 'rede.m4a' })
    expect(vectors[2]).toMatchObject({ sourceType: 'anhang', anhangIndex: 2, anhangQuelle: 'folien.pdf' })
  })

  it('ohne Anhang passiert nichts', () => {
    const vectors = [vector(0), vector(50)]
    expect(markiereAnhangChunks(vectors, undefined, 10)).toBe(0)
    expect(vectors.every((v) => v.sourceType === undefined)).toBe(true)
  })
})

describe('anhangPageSpans', () => {
  it('Body-Anker bleiben, Anhang-Anker werden je Kapitel verschoben', () => {
    const appendix = appendixFixture()
    const body = '--- Seite 7 ---\nBody-Seite sieben.'
    const offset = body.length + 2
    const spans = anhangPageSpans(body, appendix, offset)
    expect(spans.map((s) => s.page)).toEqual([7, 1, 2])
    const kap2 = appendix.sections[1]
    expect(spans[1].startIdx).toBeGreaterThanOrEqual(offset + kap2.start)
    expect(spans[2].endIdx).toBe(offset + kap2.end)
    expect(spans[0].endIdx).toBe(body.length)
  })

  it('Body ohne Anker und ohne Anhang liefert keine Spannen', () => {
    expect(anhangPageSpans('nur Text', undefined, 10)).toEqual([])
  })
})
