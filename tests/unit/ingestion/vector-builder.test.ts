/**
 * Char-Tests fuer pure Funktionen `extractFacetValues` und
 * `buildVectorDocuments` aus `src/lib/ingestion/vector-builder.ts`.
 *
 * Welle 3, Schritt 3: Festschreibung des aktuellen Verhaltens.
 *
 * Vertrag (siehe `.cursor/rules/ingestion-contracts.mdc` §1, §4):
 * - Pure Funktionen, deterministisch BIS AUF `upsertedAt`.
 * - `extractFacetValues` ueberspringt unbekannte Felder, wirft nicht.
 * - `buildVectorDocuments` schneidet `text` auf 1200 Zeichen via `safeText`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildVectorDocuments,
  extractFacetValues,
  type RAGResult,
} from '@/lib/ingestion/vector-builder'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type { DocMeta } from '@/types/doc-meta'

const baseMongoDoc: DocMeta = {
  libraryId: 'lib1',
  user: 'u',
  fileId: 'f1',
  fileName: 'doc.md',
  chunkCount: 0,
  chaptersCount: 0,
  upsertedAt: '',
}

const facetDef = (metaKey: string): FacetDef => ({
  metaKey,
  type: 'enum',
  multi: false,
  visible: true,
})

describe('extractFacetValues — Facetten aus mongoDoc', () => {
  it('extrahiert nur definierte Facetten', () => {
    const mongoDoc: DocMeta = { ...baseMongoDoc, year: 2020, region: 'Tirol' }
    const facets = extractFacetValues(mongoDoc, {}, [facetDef('year'), facetDef('region')])
    expect(facets.year).toBe(2020)
    expect(facets.region).toBe('Tirol')
  })

  it('ueberspringt undefined und null Felder', () => {
    const mongoDoc: DocMeta = { ...baseMongoDoc }
    const facets = extractFacetValues(mongoDoc, {}, [facetDef('year'), facetDef('region')])
    expect(facets).not.toHaveProperty('year')
    expect(facets).not.toHaveProperty('region')
  })

  it('liefert leeres Objekt bei leeren Inputs (kein Wurf)', () => {
    expect(extractFacetValues(baseMongoDoc, {}, [])).toEqual({})
  })
})

describe('extractFacetValues — Zusatzfelder aus docMetaJsonObj', () => {
  it('uebernimmt title, shortTitle, track, date, speakers', () => {
    const facets = extractFacetValues(
      baseMongoDoc,
      {
        title: 'Mein Doc',
        shortTitle: 'Kurz',
        track: 'main',
        date: '2025-01-01',
        speakers: ['A', 'B'],
      },
      [],
    )
    expect(facets.title).toBe('Mein Doc')
    expect(facets.shortTitle).toBe('Kurz')
    expect(facets.track).toBe('main')
    expect(facets.date).toBe('2025-01-01')
    expect(facets.speakers).toEqual(['A', 'B'])
  })
})

describe('buildVectorDocuments — Struktur und IDs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const ragResult: RAGResult = {
    chunks: [
      { index: 0, text: 'Erstes Chunk', embedding: [0.1, 0.2] },
      { index: 1, text: 'Zweites Chunk', embedding: [0.3, 0.4] },
    ],
    dimensions: 2,
    model: 'fake-model',
  }

  it('erzeugt _id im Format ${fileId}-${chunk.index}', () => {
    const vectors = buildVectorDocuments(ragResult, 'f1', 'doc.md', 'lib1', 'u@x', {})
    expect(vectors).toHaveLength(2)
    expect(vectors[0]._id).toBe('f1-0')
    expect(vectors[1]._id).toBe('f1-1')
  })

  it('setzt kind = "chunk"', () => {
    const vectors = buildVectorDocuments(ragResult, 'f1', 'doc.md', 'lib1', 'u@x', {})
    expect(vectors[0].kind).toBe('chunk')
  })

  it('setzt upsertedAt fuer alle Chunks identisch (Determinismus)', () => {
    const vectors = buildVectorDocuments(ragResult, 'f1', 'doc.md', 'lib1', 'u@x', {})
    expect(vectors[0].upsertedAt).toBe('2026-04-27T12:00:00.000Z')
    expect(vectors[1].upsertedAt).toBe(vectors[0].upsertedAt)
  })

  it('schneidet text via safeText auf 1200 Zeichen ab', () => {
    const longText = 'A'.repeat(2000)
    const vectors = buildVectorDocuments(
      {
        chunks: [{ index: 0, text: longText, embedding: [] }],
        dimensions: 0,
        model: 'm',
      },
      'f1',
      'doc.md',
      'lib1',
      'u',
      {},
    )
    expect(vectors[0].text.length).toBe(1200)
  })

  it('uebernimmt Embedding 1:1', () => {
    const vectors = buildVectorDocuments(ragResult, 'f1', 'doc.md', 'lib1', 'u', {})
    expect(vectors[0].embedding).toEqual([0.1, 0.2])
  })
})

describe('buildVectorDocuments — Optional-Felder + Facets', () => {
  it('uebernimmt headingContext, startChar, endChar nur wenn nicht null/undefined', () => {
    const ragResult: RAGResult = {
      chunks: [
        { index: 0, text: 'a', embedding: [], headingContext: 'H1', startChar: 0, endChar: 1 },
        { index: 1, text: 'b', embedding: [], headingContext: null, startChar: null, endChar: null },
      ],
      dimensions: 0,
      model: 'm',
    }
    const vectors = buildVectorDocuments(ragResult, 'f', 'd.md', 'l', 'u', {})
    expect(vectors[0].headingContext).toBe('H1')
    expect(vectors[0].startChar).toBe(0)
    expect(vectors[0].endChar).toBe(1)
    expect(vectors[1]).not.toHaveProperty('headingContext')
    expect(vectors[1]).not.toHaveProperty('startChar')
    expect(vectors[1]).not.toHaveProperty('endChar')
  })

  it('verteilt facetValues auf jeden Chunk', () => {
    const ragResult: RAGResult = {
      chunks: [
        { index: 0, text: 'a', embedding: [] },
        { index: 1, text: 'b', embedding: [] },
      ],
      dimensions: 0,
      model: 'm',
    }
    const vectors = buildVectorDocuments(
      ragResult,
      'f',
      'd.md',
      'l',
      'u',
      { year: 2020, track: 'main' },
    )
    expect(vectors[0].year).toBe(2020)
    expect(vectors[0].track).toBe('main')
    expect(vectors[1].year).toBe(2020)
    expect(vectors[1].track).toBe('main')
  })

  it('uebernimmt chunk.metadata-Felder (filtert null/undefined)', () => {
    const ragResult: RAGResult = {
      chunks: [
        {
          index: 0,
          text: 'a',
          embedding: [],
          metadata: { customField: 'X', emptyField: null, undef: undefined },
        },
      ],
      dimensions: 0,
      model: 'm',
    }
    const vectors = buildVectorDocuments(ragResult, 'f', 'd.md', 'l', 'u', {})
    expect(vectors[0].customField).toBe('X')
    expect(vectors[0]).not.toHaveProperty('emptyField')
    expect(vectors[0]).not.toHaveProperty('undef')
  })
})
