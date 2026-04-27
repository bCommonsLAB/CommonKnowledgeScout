/**
 * Char-Tests fuer pure Funktion `buildMetadataPrefix` aus
 * `src/lib/ingestion/metadata-formatter.ts`.
 *
 * Welle 3, Schritt 3: Festschreibung des aktuellen Verhaltens.
 *
 * Vertrag (siehe `.cursor/rules/ingestion-contracts.mdc` §1, §4):
 * - Pure Funktion, deterministisch.
 * - Liefert leeren String bei leerem Eingabe-Objekt (kein Wurf).
 * - Reihenfolge der Felder ist Teil des Vertrags (Embedding-Qualitaet
 *   haengt davon ab).
 */

import { describe, expect, it } from 'vitest'
import { buildMetadataPrefix } from '@/lib/ingestion/metadata-formatter'

describe('buildMetadataPrefix — leere oder fehlende Felder', () => {
  it('liefert leeren String bei leerem Objekt', () => {
    expect(buildMetadataPrefix({})).toBe('')
  })

  it('ignoriert leere Strings und whitespace-only Strings', () => {
    const prefix = buildMetadataPrefix({
      title: '   ',
      summary: '',
      teaser: '\n\t',
    })
    expect(prefix).toBe('')
  })

  it('ignoriert null und undefined', () => {
    const prefix = buildMetadataPrefix({
      title: null,
      authors: undefined,
      year: null,
    })
    expect(prefix).toBe('')
  })

  it('ignoriert leere Arrays bei authors/tags/topics', () => {
    const prefix = buildMetadataPrefix({
      authors: [],
      tags: [],
      topics: [],
    })
    expect(prefix).toBe('')
  })
})

describe('buildMetadataPrefix — Felder im Output', () => {
  it('uebernimmt Titel mit Header-Praefix', () => {
    const prefix = buildMetadataPrefix({ title: 'Mein Buch' })
    expect(prefix).toContain('# Dokument-Metadaten')
    expect(prefix).toContain('**Titel:** Mein Buch')
  })

  it('joined Autoren mit Strichpunkt', () => {
    const prefix = buildMetadataPrefix({
      authors: ['Alice', 'Bob', 'Charlie'],
    })
    expect(prefix).toContain('**Autoren:** Alice; Bob; Charlie')
  })

  it('akzeptiert Jahr als number ODER nicht-leeren String', () => {
    expect(buildMetadataPrefix({ year: 2024 })).toContain('**Jahr:** 2024')
    expect(buildMetadataPrefix({ year: '2025' })).toContain('**Jahr:** 2025')
  })

  it('joined Tags mit Komma-Space', () => {
    const prefix = buildMetadataPrefix({ tags: ['nachhaltig', 'lokal'] })
    expect(prefix).toContain('**Tags:** nachhaltig, lokal')
  })

  it('filtert nicht-string Eintraege aus Arrays heraus', () => {
    const prefix = buildMetadataPrefix({
      authors: ['Alice', 42 as unknown as string, '', 'Bob'],
      tags: [null as unknown as string, 'tag1', undefined as unknown as string],
    })
    expect(prefix).toContain('Alice; Bob')
    expect(prefix).not.toContain('42')
    expect(prefix).toContain('tag1')
  })

  it('uebernimmt Region und Dokumenttyp', () => {
    const prefix = buildMetadataPrefix({
      region: 'Tirol',
      docType: 'Buch',
    })
    expect(prefix).toContain('**Region:** Tirol')
    expect(prefix).toContain('**Dokumenttyp:** Buch')
  })

  it('uebernimmt Summary und Teaser', () => {
    const prefix = buildMetadataPrefix({
      summary: 'Eine Zusammenfassung',
      teaser: 'Ein Teaser',
    })
    expect(prefix).toContain('**Zusammenfassung:**\nEine Zusammenfassung')
    expect(prefix).toContain('**Kurzbeschreibung:**\nEin Teaser')
  })

  it('unterdrueckt Teaser, wenn er identisch zur Summary ist', () => {
    // Vermeidet Doppel-Inhalt im Embedding-Praefix.
    const prefix = buildMetadataPrefix({
      summary: 'Identischer Text',
      teaser: 'Identischer Text',
    })
    expect(prefix).toContain('**Zusammenfassung:**\nIdentischer Text')
    expect(prefix).not.toContain('**Kurzbeschreibung:**')
  })
})

describe('buildMetadataPrefix — Determinismus', () => {
  it('liefert bei gleicher Eingabe gleiches Ergebnis (idempotent)', () => {
    const meta = {
      title: 'X',
      authors: ['A'],
      year: 2020,
      tags: ['t1', 't2'],
    }
    const a = buildMetadataPrefix(meta)
    const b = buildMetadataPrefix(meta)
    expect(a).toBe(b)
  })
})
