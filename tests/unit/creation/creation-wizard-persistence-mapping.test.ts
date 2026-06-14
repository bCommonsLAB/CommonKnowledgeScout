/**
 * Charakter-Tests des Persistenz-Mappings im Wizard-Kern (`handleSave`).
 *
 * Sicherheitsnetz (U0 / Sub-Welle 3-VI-a) VOR „kanonischer State" (Sub-Welle
 * 3-VI-c, ersetzt die Fallback-Kette) und „Persistenz vereinheitlichen"
 * (Sub-Welle 3-VI-e). Pinnt die reinen Metadaten-Transformationen, BEVOR
 * irgendwann physisch geschrieben wird:
 *
 * - `baseMetadata`-Fallback-Kette (creation-wizard.tsx ~Z. 1846-1849)
 * - `preferredMarkdown`-Fallback (~Z. 1851-1853) + Leer-Guard (~Z. 1855)
 * - Entfernen der `wizardOnlyMetadataKeys` (~Z. 1879-1882)
 * - Frontmatter-Aufbau: hardcodierte Felder gewinnen, sonst Formular-/LLM-Wert,
 *   sonst Template-Default (~Z. 1971-1994)
 *
 * Die Funktionen unten spiegeln den Kern 1:1 (Stand 2026-06-14). Sie sind dort
 * Closures und nicht exportierbar; bei der Extraktion in `services/persistence.ts`
 * (Sub-Welle 3-VI-e) ist der Spiegel durch den echten Import zu ersetzen.
 *
 * Den physischen Schreibpfad (Standard- vs. PDF- vs. Event-Pfad, ~Z. 2257-2600)
 * deckt dieses Netz bewusst NICHT ab: er ist provider-gekoppelt und wird erst
 * nach der Service-Extraktion (Sub-Welle 3-VI-b/e) testbar.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle a, Commit 3)
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import { buildCreationFileName } from '@/lib/creation/file-name'

const TEMPLATES_DIR = join(process.cwd(), 'test-library', 'templates')

function loadFixture(name: string) {
  const content = readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf-8')
  return parseTemplate(content, name).template
}

interface WizardSaveStateLike {
  draftMetadata?: Record<string, unknown>
  reviewedFields?: Record<string, unknown>
  generatedDraft?: { metadata: Record<string, unknown>; markdown: string }
  draftText?: string
}

/** Spiegel von creation-wizard.tsx ~Z. 1846-1849. */
function selectBaseMetadata(s: WizardSaveStateLike): Record<string, unknown> {
  return s.draftMetadata || s.reviewedFields || s.generatedDraft?.metadata || {}
}

/** Spiegel von creation-wizard.tsx ~Z. 1851-1853. */
function selectPreferredMarkdown(s: WizardSaveStateLike): string {
  return s.draftText || s.generatedDraft?.markdown || ''
}

/** Spiegel des Leer-Guards (~Z. 1855): nichts zu speichern. */
function hasNothingToSave(base: Record<string, unknown>, markdown: string): boolean {
  return Object.keys(base).length === 0 && !markdown.trim()
}

/** Spiegel von creation-wizard.tsx ~Z. 1879-1882. */
function dropWizardOnlyKeys(meta: Record<string, unknown>, wizardOnlyKeys: string[]): Record<string, unknown> {
  const out = { ...meta }
  for (const k of wizardOnlyKeys) delete out[k]
  return out
}

interface FieldLike {
  key: string
  description: string
  rawValue: string
}

/** Spiegel des Frontmatter-Aufbaus creation-wizard.tsx ~Z. 1971-1994. */
function buildFrontmatterMetadata(
  fields: FieldLike[],
  metadataWithImages: Record<string, unknown>
): Record<string, unknown> {
  const frontmatterKeys = new Set(fields.map((f) => f.key))
  const out: Record<string, unknown> = {}
  for (const key of frontmatterKeys) {
    const field = fields.find((f) => f.key === key)
    const isHardcoded = field && (!field.description || field.description.trim() === '')
    if (isHardcoded && field?.rawValue) {
      out[key] = coerce(field.rawValue)
    } else if (key in metadataWithImages) {
      out[key] = metadataWithImages[key]
    } else {
      const rv = field?.rawValue
      if (rv !== undefined && rv !== '') out[key] = coerce(rv)
    }
  }
  return out
}

function coerce(rv: string): unknown {
  if (rv === 'true') return true
  if (rv === 'false') return false
  return rv
}

describe('baseMetadata-Fallback-Kette', () => {
  it('draftMetadata hat Vorrang vor allem', () => {
    expect(
      selectBaseMetadata({
        draftMetadata: { a: 1 },
        reviewedFields: { b: 2 },
        generatedDraft: { metadata: { c: 3 }, markdown: '' },
      })
    ).toEqual({ a: 1 })
  })

  it('reviewedFields vor generatedDraft.metadata', () => {
    expect(selectBaseMetadata({ reviewedFields: { b: 2 }, generatedDraft: { metadata: { c: 3 }, markdown: '' } })).toEqual({ b: 2 })
  })

  it('generatedDraft.metadata als dritte Stufe, sonst leeres Objekt', () => {
    expect(selectBaseMetadata({ generatedDraft: { metadata: { c: 3 }, markdown: '' } })).toEqual({ c: 3 })
    expect(selectBaseMetadata({})).toEqual({})
  })

  it('leeres draftMetadata-Objekt fällt durch (falsy ist es nicht — Ist-Verhalten: {} ist truthy)', () => {
    // Dokumentiert: {} ist truthy, also gewinnt das leere Objekt und stoppt die Kette.
    expect(selectBaseMetadata({ draftMetadata: {}, reviewedFields: { b: 2 } })).toEqual({})
  })
})

describe('preferredMarkdown-Fallback + Leer-Guard', () => {
  it('draftText vor generatedDraft.markdown vor leerem String', () => {
    expect(selectPreferredMarkdown({ draftText: 'A', generatedDraft: { metadata: {}, markdown: 'B' } })).toBe('A')
    expect(selectPreferredMarkdown({ generatedDraft: { metadata: {}, markdown: 'B' } })).toBe('B')
    expect(selectPreferredMarkdown({})).toBe('')
  })

  it('Leer-Guard: weder Metadaten noch Markdown → nichts zu speichern', () => {
    expect(hasNothingToSave({}, '')).toBe(true)
    expect(hasNothingToSave({}, '   ')).toBe(true)
    expect(hasNothingToSave({ a: 1 }, '')).toBe(false)
    expect(hasNothingToSave({}, 'text')).toBe(false)
  })
})

describe('wizardOnlyMetadataKeys werden aus dem Frontmatter entfernt', () => {
  it('event-Fixture: `filename` ist wizardOnly und verschwindet', () => {
    const t = loadFixture('event')
    expect(t.creation!.output?.wizardOnlyMetadataKeys).toContain('filename')
    const cleaned = dropWizardOnlyKeys({ title: 'X', filename: 'mein-event' }, t.creation!.output!.wizardOnlyMetadataKeys!)
    expect(cleaned).toEqual({ title: 'X' })
  })
})

describe('Frontmatter-Aufbau — hardcoded gewinnt, sonst Wert, sonst Default', () => {
  it('event-Fixture: hardcodierte Felder schlagen Formular-/LLM-Werte', () => {
    const fields = loadFixture('event').metadata.fields as FieldLike[]
    // docType/detailViewType/language sind hardcodiert (description leer).
    const fm = buildFrontmatterMetadata(fields, { docType: 'falsch-vom-llm', title: 'Mein Event' })
    expect(fm.docType).toBe('event')
    expect(fm.detailViewType).toBe('session')
    expect(fm.language).toBe('de')
    // Platzhalter-Feld mit Wert: Formularwert gewinnt.
    expect(fm.title).toBe('Mein Event')
  })

  it('Ist-Verhalten (latent): fehlender Platzhalter-Wert schreibt den Roh-Token als Default', () => {
    // Dokumentiert, NICHT fixen: ohne Wert landet `{{summary|...}}` wörtlich im Frontmatter.
    const fields = loadFixture('event').metadata.fields as FieldLike[]
    const fm = buildFrontmatterMetadata(fields, { title: 'Mein Event' })
    expect(typeof fm.summary).toBe('string')
    expect(fm.summary as string).toContain('{{summary')
  })

  it('Boolean-Koerzierung hardcodierter Werte', () => {
    const fields: FieldLike[] = [
      { key: 'isFlag', description: '', rawValue: 'true' },
      { key: 'isOff', description: '', rawValue: 'false' },
      { key: 'name', description: '', rawValue: 'literal' },
    ]
    const fm = buildFrontmatterMetadata(fields, {})
    expect(fm.isFlag).toBe(true)
    expect(fm.isOff).toBe(false)
    expect(fm.name).toBe('literal')
  })
})

describe('Dateiname-Mapping (echter buildCreationFileName)', () => {
  it('event-Fixture: filename-Override gewinnt vor title; fixiertes now für Stabilität', () => {
    const t = loadFixture('event')
    const base = { title: 'Mein Event', filename: 'wunsch-name' }
    const { fileName } = buildCreationFileName({
      typeId: 'event',
      metadata: base,
      config: { ...t.creation!.output?.fileName, ensureUnique: false },
      overrideBaseName: typeof base.filename === 'string' ? base.filename.trim() : undefined,
      now: new Date('2026-06-14T10:00:00Z'),
    })
    expect(fileName).toContain('wunsch-name')
    expect(fileName.endsWith('.md')).toBe(true)
  })
})
