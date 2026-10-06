import { describe, it, expect } from 'vitest'
import { ingestKontextPaare, type IngestFacette } from '@/lib/ingestion/ingest-kontext'
import { buildMetadataPrefix, DOKUMENT_BODY_MARKER } from '@/lib/ingestion/metadata-formatter'
import { buildDocumentTextForEmbedding } from '@/lib/ingestion/document-text-builder'
import type { DocMeta } from '@ks/contracts'

/**
 * Plan story-status-modalitaet, m5: Facetten mit `ingestKontext` gehen als
 * Klartext mit Bedeutung in den Chunk-Vorspann und den Dokument-Embedding-
 * Text. Ohne Flag oder ohne Defs bleibt alles wie bisher (Char-Tests in
 * metadata-formatter.test.ts / document-text-builder.test.ts gelten weiter).
 */

const FACETS: IngestFacette[] = [
  {
    metaKey: 'lv_bewertung',
    label: 'Bewertung Landesverwaltung',
    ingestKontext: true,
    werte: [
      { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', bedeutung: 'Als nicht umsetzbar bewertet; wird nicht umgesetzt.' },
      { wert: 'in_umsetzung', label: 'in Umsetzung' },
    ],
  },
  { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe', ingestKontext: true },
  { metaKey: 'vorschlag_quelle', label: 'Quelle des Vorschlags' }, // kein Flag → nicht im Kontext
  { metaKey: 'tags', label: 'Tags', ingestKontext: true }, // schreibt der feste Teil schon
]

const DOC = {
  title: 'Nachhaltiger Schwerverkehr',
  summary: 'Zusammenfassung.',
  tags: ['mobilitaet'],
  lv_bewertung: 'nicht_umsetzbar',
  arbeitsgruppe: 'Mobilität',
  vorschlag_quelle: 'Klimabürgerrat',
}

describe('ingestKontextPaare', () => {
  it('nur Facetten mit Flag und Wert, mit Bedeutung aus dem Wörterbuch; Ausschlussliste greift', () => {
    const paare = ingestKontextPaare(DOC, FACETS, new Set(['tags']))
    expect(paare).toEqual([
      { label: 'Bewertung Landesverwaltung', text: 'nicht umsetzbar — Als nicht umsetzbar bewertet; wird nicht umgesetzt.' },
      { label: 'Arbeitsgruppe', text: 'Mobilität' },
    ])
  })

  it('ohne Defs oder ohne Wert im Dokument: nichts', () => {
    expect(ingestKontextPaare(DOC, undefined, new Set())).toEqual([])
    expect(ingestKontextPaare(DOC, [], new Set())).toEqual([])
    expect(ingestKontextPaare({ title: 'x' }, FACETS, new Set())).toEqual([])
  })
})

describe('buildMetadataPrefix mit Facetten', () => {
  it('hängt die Kontext-Zeilen als fette Labels an; Tags stehen nur einmal', () => {
    const prefix = buildMetadataPrefix(DOC, FACETS)
    expect(prefix).toContain('**Titel:** Nachhaltiger Schwerverkehr')
    expect(prefix).toContain('**Bewertung Landesverwaltung:** nicht umsetzbar — Als nicht umsetzbar bewertet; wird nicht umgesetzt.')
    expect(prefix).toContain('**Arbeitsgruppe:** Mobilität')
    expect(prefix).not.toContain('Quelle des Vorschlags')
    expect(prefix.match(/mobilitaet/g)).toHaveLength(1)
    expect(prefix).not.toContain(DOKUMENT_BODY_MARKER)
  })

  it('ohne Defs identisch zum bisherigen Vorspann', () => {
    expect(buildMetadataPrefix(DOC, undefined)).toBe(buildMetadataPrefix(DOC))
    expect(buildMetadataPrefix(DOC)).not.toContain('Bewertung Landesverwaltung')
  })
})

describe('buildDocumentTextForEmbedding mit Facetten', () => {
  const mongoDoc = { libraryId: 'lib', fileId: 'f', fileName: 'x.md', tags: ['mobilitaet'] } as unknown as DocMeta

  it('Kontext-Zeilen stehen vor den Kapiteln, Tags nur einmal', () => {
    const text = buildDocumentTextForEmbedding(
      { ...DOC, chapters: [{ title: 'Kap', summary: 'Kapitelzusammenfassung' }] },
      mongoDoc,
      FACETS,
    )
    const posStatus = text.indexOf('Bewertung Landesverwaltung: nicht umsetzbar — Als nicht umsetzbar bewertet')
    const posKapitel = text.indexOf('Kapitel-Zusammenfassungen')
    expect(posStatus).toBeGreaterThan(-1)
    expect(posKapitel).toBeGreaterThan(posStatus)
    expect(text).toContain('Arbeitsgruppe: Mobilität')
    expect(text.match(/mobilitaet/g)).toHaveLength(1)
  })

  it('ohne Defs identisch zum bisherigen Text', () => {
    expect(buildDocumentTextForEmbedding(DOC, mongoDoc, undefined)).toBe(buildDocumentTextForEmbedding(DOC, mongoDoc))
  })
})
