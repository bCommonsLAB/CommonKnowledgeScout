/**
 * Char-Tests fuer pure Funktion `buildMetaDocument` aus
 * `src/lib/ingestion/meta-document-builder.ts`.
 *
 * Welle 3, Schritt 3: Festschreibung des aktuellen Verhaltens.
 *
 * Vertrag (siehe `.cursor/rules/ingestion-contracts.mdc` §1, §4):
 * - Pure Funktion, deterministisch BIS AUF `upsertedAt`
 *   (siehe FakeTimers-Test).
 * - Liefert ein Mongo-vorbereitetes Meta-Dokument mit kind='meta'-Eintrag
 *   (Top-Level `kind` wird vom Aufrufer ergaenzt — buildMetaDocument
 *   selbst setzt es nicht).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMetaDocument } from '@/lib/ingestion/meta-document-builder'
import type { DocMeta, ChapterMetaEntry } from '@/types/doc-meta'

const baseMongoDoc: DocMeta = {
  libraryId: 'lib1',
  user: 'orig-user@example.com',
  fileId: 'f1',
  fileName: 'doc.md',
  chunkCount: 0,
  chaptersCount: 0,
  upsertedAt: '2024-01-01T00:00:00.000Z',
}

describe('buildMetaDocument — Pflicht-Felder + Defaults', () => {
  it('setzt libraryId, fileId, fileName und user', () => {
    const result = buildMetaDocument(baseMongoDoc, {}, [], 0, 0, {}, 'caller@example.com')
    expect(result.libraryId).toBe('lib1')
    expect(result.fileId).toBe('f1')
    expect(result.fileName).toBe('doc.md')
    // user-Argument hat Vorrang vor mongoDoc.user
    expect(result.user).toBe('caller@example.com')
  })

  it('liefert leeren String fuer fileName, wenn mongoDoc.fileName fehlt', () => {
    const result = buildMetaDocument(
      { ...baseMongoDoc, fileName: undefined },
      {},
      [],
      0,
      0,
      {},
      'u',
    )
    expect(result.fileName).toBe('')
  })
})

describe('buildMetaDocument — Top-Level-Felder aus mongoDoc', () => {
  it('uebernimmt year, region, docType, source bei korrektem Typ', () => {
    const mongoDoc: DocMeta = {
      ...baseMongoDoc,
      year: 2020,
      region: 'Tirol',
      docType: 'Buch',
      source: 'Internal',
    }
    const result = buildMetaDocument(mongoDoc, {}, [], 0, 0, {}, 'u')
    expect(result.year).toBe(2020)
    expect(result.region).toBe('Tirol')
    expect(result.docType).toBe('Buch')
    expect(result.source).toBe('Internal')
  })

  it('setzt year auf undefined, wenn nicht number', () => {
    const mongoDoc: DocMeta = { ...baseMongoDoc, year: '2020' as unknown as number }
    const result = buildMetaDocument(mongoDoc, {}, [], 0, 0, {}, 'u')
    expect(result.year).toBeUndefined()
  })

  it('uebernimmt authors und tags wenn Array', () => {
    const mongoDoc: DocMeta = {
      ...baseMongoDoc,
      authors: ['A', 'B'],
      tags: ['x'],
    }
    const result = buildMetaDocument(mongoDoc, {}, [], 0, 0, {}, 'u')
    expect(result.authors).toEqual(['A', 'B'])
    expect(result.tags).toEqual(['x'])
  })
})

describe('buildMetaDocument — Felder aus docMetaJsonObj', () => {
  it('uebernimmt title, shortTitle, slug, summary, teaser (getrimmt)', () => {
    const result = buildMetaDocument(
      baseMongoDoc,
      {
        title: '  Mein Titel  ',
        shortTitle: 'Kurz',
        slug: 'mein-titel',
        summary: 'Zusammenfassung',
        teaser: 'Teaser',
      },
      [],
      0,
      0,
      {},
      'u',
    )
    expect(result.title).toBe('Mein Titel')
    expect(result.shortTitle).toBe('Kurz')
    expect(result.slug).toBe('mein-titel')
    expect(result.summary).toBe('Zusammenfassung')
    expect(result.teaser).toBe('Teaser')
  })

  it('setzt String-Felder auf undefined bei null, leerem String oder whitespace', () => {
    const result = buildMetaDocument(
      baseMongoDoc,
      {
        title: null,
        shortTitle: '',
        slug: '   ',
        summary: undefined,
      },
      [],
      0,
      0,
      {},
      'u',
    )
    expect(result.title).toBeUndefined()
    expect(result.shortTitle).toBeUndefined()
    expect(result.slug).toBeUndefined()
    expect(result.summary).toBeUndefined()
  })

  it('uebernimmt parentId und parentSlug aus docMetaJsonObj', () => {
    const result = buildMetaDocument(
      baseMongoDoc,
      { parentId: 'parent-1', parentSlug: 'parent' },
      [],
      0,
      0,
      {},
      'u',
    )
    expect(result.parentId).toBe('parent-1')
    expect(result.parentSlug).toBe('parent')
  })

  it('uebernimmt topics nur aus docMetaJsonObj (nicht mongoDoc)', () => {
    const result = buildMetaDocument(
      baseMongoDoc,
      { topics: ['Klima'] },
      [],
      0,
      0,
      {},
      'u',
    )
    expect(result.topics).toEqual(['Klima'])
  })
})

describe('buildMetaDocument — Chapters und Counts', () => {
  it('uebernimmt chapters und Counts unveraendert', () => {
    const chapters: ChapterMetaEntry[] = [
      { index: 0, title: 'Kap 1' },
      { index: 1, title: 'Kap 2' },
    ]
    const result = buildMetaDocument(baseMongoDoc, {}, chapters, 2, 42, {}, 'u')
    expect(result.chapters).toEqual(chapters)
    expect(result.chaptersCount).toBe(2)
    expect(result.chunkCount).toBe(42)
  })
})

describe('buildMetaDocument — Facet-Werte und docMetaJson', () => {
  it('haengt facetValues als Top-Level-Felder an (Spread am Ende)', () => {
    const result = buildMetaDocument(
      baseMongoDoc,
      {},
      [],
      0,
      0,
      { customFacet: 'value', track: 'main' },
      'u',
    )
    expect(result.customFacet).toBe('value')
    expect(result.track).toBe('main')
  })

  it('legt docMetaJsonObj komplett unter docMetaJson ab', () => {
    const json = { title: 'X', custom: 1 }
    const result = buildMetaDocument(baseMongoDoc, json, [], 0, 0, {}, 'u')
    expect(result.docMetaJson).toEqual(json)
  })
})

describe('buildMetaDocument — Determinismus mit FakeTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('setzt upsertedAt auf aktuelle Systemzeit (ISO-8601)', () => {
    const result = buildMetaDocument(baseMongoDoc, {}, [], 0, 0, {}, 'u')
    expect(result.upsertedAt).toBe('2026-04-27T12:00:00.000Z')
  })
})
