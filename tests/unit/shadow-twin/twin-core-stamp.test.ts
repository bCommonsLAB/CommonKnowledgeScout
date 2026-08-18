/**
 * @fileoverview Unit-Tests: Twin-Kern-Stempel (Twin-Datei-Contract §4.1)
 *
 * Der Stempel setzt generated_by/generated_at immer neu, fuellt Strukturfelder
 * nur wenn sie fehlen, erhaelt Body + unbekannte Felder und fasst
 * canonical/raw sowie Kurations-Felder nie an.
 */

import { describe, it, expect } from 'vitest'
import { stampTwinCoreFrontmatter } from '@/lib/shadow-twin/twin-core-stamp'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

const BODY = '# Kapitel 1\n\nText mit Inhalt.\n\n---\n\nZweiter Abschnitt nach Trennlinie.'

describe('stampTwinCoreFrontmatter — Transkript', () => {
  it('stempelt rohes OCR-Markdown ohne Frontmatter (Body bleibt erhalten)', () => {
    const stamped = stampTwinCoreFrontmatter(BODY, {
      kind: 'transcript',
      sourceFileName: 'Quelle.pdf',
      targetLanguage: 'de',
      generatedBy: 'knowledgescout/pipeline',
      generatedAt: '2026-08-17T10:00:00.000Z',
    })
    const { meta, body } = parseFrontmatter(stamped)
    expect(meta.type).toBe('transcript')
    expect(meta.source_file).toBe('Quelle.pdf')
    expect(meta.generated_by).toBe('knowledgescout/pipeline')
    expect(meta.generated_at).toBe('2026-08-17T10:00:00.000Z')
    // Transkript ist sprachneutral — language wird nicht geraten
    expect(meta.language).toBeUndefined()
    expect(body.trim()).toBe(BODY.trim())
  })

  it('setzt generatedAt selbst (ISO), wenn keiner uebergeben wird', () => {
    const stamped = stampTwinCoreFrontmatter('Nur Text.', {
      kind: 'transcript',
      sourceFileName: 'Quelle.pdf',
      targetLanguage: 'de',
      generatedBy: 'knowledgescout/pipeline',
    })
    const { meta } = parseFrontmatter(stamped)
    expect(Number.isNaN(Date.parse(String(meta.generated_at)))).toBe(false)
  })
})

describe('stampTwinCoreFrontmatter — Transformation', () => {
  const md = ['---', 'title: "Analyse"', 'custom_note: "bleibt stehen"', '---', '', BODY].join('\n')

  it('fuellt template und language, erhaelt unbekannte Felder und Body', () => {
    const stamped = stampTwinCoreFrontmatter(md, {
      kind: 'transformation',
      sourceFileName: 'Quelle.pdf',
      targetLanguage: 'de',
      templateName: 'pdfanalyse',
      generatedBy: 'knowledgescout/pipeline',
      generatedAt: '2026-08-17T10:00:00.000Z',
    })
    const { meta, body } = parseFrontmatter(stamped)
    expect(meta.template).toBe('pdfanalyse')
    expect(meta.language).toBe('de')
    expect(meta.type).toBe('transformation')
    // Unbekannte Felder + Body ueberleben den Stempel (Contract §4.2)
    expect(meta.title).toBe('Analyse')
    expect(meta.custom_note).toBe('bleibt stehen')
    expect(body.trim()).toBe(BODY.trim())
  })

  it('ueberschreibt vorhandene Strukturfelder NICHT, generated_* aber immer', () => {
    const existing = [
      '---',
      'type: massnahme',
      'language: en',
      'generated_by: claude/cowork',
      'generated_at: 2026-01-01T00:00:00.000Z',
      '---',
      '',
      'Body.',
    ].join('\n')
    const stamped = stampTwinCoreFrontmatter(existing, {
      kind: 'transformation',
      sourceFileName: 'Quelle.pdf',
      targetLanguage: 'de',
      templateName: 'pdfanalyse',
      generatedBy: 'knowledgescout/pipeline',
      generatedAt: '2026-08-17T10:00:00.000Z',
    })
    const { meta } = parseFrontmatter(stamped)
    // Template-/Extraktor-Werte bleiben — Widerspruch wird spaeter Befund, nicht still korrigiert
    expect(meta.type).toBe('massnahme')
    expect(meta.language).toBe('en')
    // Neues Generierungsereignis = neuer Stempel
    expect(meta.generated_by).toBe('knowledgescout/pipeline')
    expect(meta.generated_at).toBe('2026-08-17T10:00:00.000Z')
  })

  it('wirft ohne templateName (Pflicht bei Transformationen)', () => {
    expect(() =>
      stampTwinCoreFrontmatter('Text', {
        kind: 'transformation',
        sourceFileName: 'Quelle.pdf',
        targetLanguage: 'de',
        generatedBy: 'knowledgescout/pipeline',
      })
    ).toThrow(/templateName ist Pflicht/)
  })
})

describe('stampTwinCoreFrontmatter — Grenzen', () => {
  it('canonical und raw bleiben byte-identisch', () => {
    const raw = 'html,csv,rohdaten'
    for (const kind of ['canonical', 'raw'] as const) {
      expect(
        stampTwinCoreFrontmatter(raw, {
          kind,
          sourceFileName: 'Quelle.csv',
          targetLanguage: 'de',
          generatedBy: 'knowledgescout/pipeline',
        })
      ).toBe(raw)
    }
  })

  it('wirft ohne generatedBy (kein stiller Default)', () => {
    expect(() =>
      stampTwinCoreFrontmatter('Text', {
        kind: 'transcript',
        sourceFileName: 'Quelle.pdf',
        targetLanguage: 'de',
        generatedBy: '',
      })
    ).toThrow(/generatedBy ist Pflicht/)
  })

  it('setzt niemals Kurations-Felder und erhaelt vorhandene', () => {
    const verified = ['---', 'twin_status: stable', 'verified_by: human:peter', '---', '', 'Body.'].join('\n')
    const stamped = stampTwinCoreFrontmatter(verified, {
      kind: 'transcript',
      sourceFileName: 'Quelle.pdf',
      targetLanguage: 'de',
      generatedBy: 'knowledgescout/pipeline',
    })
    const { meta } = parseFrontmatter(stamped)
    expect(meta.twin_status).toBe('stable')
    expect(meta.verified_by).toBe('human:peter')
    expect(meta.verified_at).toBeUndefined()
  })
})
