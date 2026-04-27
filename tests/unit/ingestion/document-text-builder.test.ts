/**
 * Char-Tests fuer pure Funktion `buildDocumentTextForEmbedding` aus
 * `src/lib/ingestion/document-text-builder.ts`.
 *
 * Welle 3, Schritt 3: Festschreibung des aktuellen Verhaltens.
 *
 * Vertrag (siehe `.cursor/rules/ingestion-contracts.mdc` §1, §4):
 * - Pure Funktion, deterministisch.
 * - Liefert leeren String bei leeren Inputs.
 * - mongoDoc-Felder haben Vorrang vor docMetaJsonObj-Feldern, ausser bei
 *   Feldern wie title/summary, die nur in docMetaJsonObj liegen.
 */

import { describe, expect, it } from 'vitest'
import { buildDocumentTextForEmbedding } from '@/lib/ingestion/document-text-builder'
import type { DocMeta } from '@/types/doc-meta'

const emptyMongoDoc = {
  libraryId: 'lib1',
  fileId: 'f1',
  fileName: 'doc.md',
  user: 'u',
} as unknown as DocMeta

describe('buildDocumentTextForEmbedding — leere oder fehlende Felder', () => {
  it('liefert leeren String bei beiden leeren Inputs', () => {
    expect(buildDocumentTextForEmbedding({}, emptyMongoDoc)).toBe('')
  })

  it('ignoriert Strings mit nur Whitespace', () => {
    const text = buildDocumentTextForEmbedding(
      { title: '   ', summary: '\n\t' },
      emptyMongoDoc,
    )
    expect(text).toBe('')
  })
})

describe('buildDocumentTextForEmbedding — Felder im Output', () => {
  it('uebernimmt Titel mit Praefix "Titel: "', () => {
    const text = buildDocumentTextForEmbedding(
      { title: 'Mein Dokument' },
      emptyMongoDoc,
    )
    expect(text).toContain('Titel: Mein Dokument')
  })

  it('unterdrueckt shortTitle wenn er identisch zum title ist', () => {
    const text = buildDocumentTextForEmbedding(
      { title: 'Foo', shortTitle: 'Foo' },
      emptyMongoDoc,
    )
    expect(text).toContain('Titel: Foo')
    expect(text).not.toContain('Kurztitel:')
  })

  it('uebernimmt shortTitle wenn er anders ist', () => {
    const text = buildDocumentTextForEmbedding(
      { title: 'Lange Form', shortTitle: 'Kurz' },
      emptyMongoDoc,
    )
    expect(text).toContain('Kurztitel: Kurz')
  })

  it('joined Autoren mit Komma-Space', () => {
    const mongoDoc = { ...emptyMongoDoc, authors: ['Alice', 'Bob'] }
    const text = buildDocumentTextForEmbedding({}, mongoDoc)
    expect(text).toContain('Autoren: Alice, Bob')
  })

  it('bevorzugt mongoDoc.authors ueber docMetaJsonObj.authors', () => {
    const mongoDoc = { ...emptyMongoDoc, authors: ['Mongo-Autor'] }
    const text = buildDocumentTextForEmbedding(
      { authors: ['Json-Autor'] },
      mongoDoc,
    )
    expect(text).toContain('Mongo-Autor')
    expect(text).not.toContain('Json-Autor')
  })

  it('faellt auf docMetaJsonObj.authors zurueck, wenn mongoDoc keine hat', () => {
    const text = buildDocumentTextForEmbedding(
      { authors: ['Json-Autor'] },
      emptyMongoDoc,
    )
    expect(text).toContain('Autoren: Json-Autor')
  })

  it('uebernimmt Jahr aus mongoDoc oder docMetaJsonObj', () => {
    const mongoDoc = { ...emptyMongoDoc, year: 2024 }
    expect(buildDocumentTextForEmbedding({}, mongoDoc)).toContain('Jahr: 2024')
    expect(buildDocumentTextForEmbedding({ year: 1999 }, emptyMongoDoc)).toContain('Jahr: 1999')
  })

  it('unterdrueckt Teaser, wenn er identisch zur Summary ist', () => {
    const text = buildDocumentTextForEmbedding(
      { summary: 'Identisch', teaser: 'Identisch' },
      emptyMongoDoc,
    )
    expect(text).toContain('Zusammenfassung: Identisch')
    expect(text).not.toContain('Teaser:')
  })

  it('uebernimmt Tags und Topics', () => {
    const mongoDoc = { ...emptyMongoDoc, tags: ['t1', 't2'] }
    const text = buildDocumentTextForEmbedding(
      { topics: ['Klima', 'Wasser'] },
      mongoDoc,
    )
    expect(text).toContain('Tags: t1, t2')
    expect(text).toContain('Themen: Klima, Wasser')
  })

  it('joined Kapitel-Zusammenfassungen mit Doppelumbruch', () => {
    const text = buildDocumentTextForEmbedding(
      {
        chapters: [
          { title: 'Kap 1', summary: 'Inhalt 1' },
          { title: 'Kap 2', summary: 'Inhalt 2' },
          { title: 'Leer', summary: '' },
        ],
      },
      emptyMongoDoc,
    )
    expect(text).toContain('Kapitel-Zusammenfassungen:')
    expect(text).toContain('Kap 1: Inhalt 1')
    expect(text).toContain('Kap 2: Inhalt 2')
    // Kapitel ohne summary werden uebersprungen
    expect(text).not.toContain('Leer:')
  })
})

describe('buildDocumentTextForEmbedding — Determinismus', () => {
  it('idempotent fuer gleichen Input', () => {
    const json = { title: 'A', summary: 'B', topics: ['x'] }
    const a = buildDocumentTextForEmbedding(json, emptyMongoDoc)
    const b = buildDocumentTextForEmbedding(json, emptyMongoDoc)
    expect(a).toBe(b)
  })
})
