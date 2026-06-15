/**
 * Beweis-Test für Phase 3a-1 (generische Feld-Bindung):
 * `editableContentFields(schema)` reproduziert für jede Wizard-Vorlage **exakt**
 * deren handgeschriebene `editDraft.fields`. Damit ist das Ersetzen der
 * hartkodierten Liste durch die generische Ableitung risikolos.
 *
 * @see src/lib/creation/editable-fields.ts
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import {
  editableContentFields,
  isWizardSystemField,
  resolveEditableFields,
} from '@/lib/creation/editable-fields'

const TEMPLATES_DIR = join(process.cwd(), 'test-library', 'templates')

function load(name: string) {
  return parseTemplate(readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf-8'), name).template
}

const WIZARDS = ['event', 'event-final', 'testimonial', 'dialograum', 'pc-steckbrief'] as const

describe('editableContentFields == handgeschriebene editDraft.fields', () => {
  it.each(WIZARDS)('%s: generische Ableitung deckt sich exakt', (name) => {
    const t = load(name)
    const schemaKeys = t.metadata.fields.map((f) => f.key)
    const editDraftFields = t.creation?.flow.steps.find((s) => s.preset === 'editDraft')?.fields ?? []
    expect(editableContentFields(schemaKeys)).toEqual(editDraftFields)
  })

  it('behält die Schema-Reihenfolge', () => {
    expect(editableContentFields(['title', 'docType', 'summary', 'slug', 'location'])).toEqual([
      'title',
      'summary',
      'location',
    ])
  })
})

describe('isWizardSystemField', () => {
  it('schließt technische, strukturelle und R3-System-Felder aus', () => {
    for (const f of [
      'language',
      'targetLanguage',
      'slug',
      'docType',
      'detailViewType',
      'source_language',
      'extends',
      'relatedSchemas',
      'originalFileId',
      'finalRunId',
      'eventStatus',
      'testimonialWriteKey',
    ]) {
      expect(isWizardSystemField(f)).toBe(true)
    }
  })

  it('inhaltliche Felder bleiben editierbar', () => {
    for (const f of ['title', 'summary', 'statement', 'author_name', 'cpu', 'filename']) {
      expect(isWizardSystemField(f)).toBe(false)
    }
  })
})

describe('resolveEditableFields — Kompatibilitätsprüfung (U3)', () => {
  it('ohne Override: generische Inhalts-Felder', () => {
    expect(
      resolveEditableFields({ schemaFieldKeys: ['title', 'docType', 'summary'] })
    ).toEqual({ ok: true, fields: ['title', 'summary'] })
  })

  it('Override gewinnt, wenn alle Felder im Schema existieren', () => {
    expect(
      resolveEditableFields({ schemaFieldKeys: ['title', 'summary', 'location'], overrideFields: ['summary', 'title'] })
    ).toEqual({ ok: true, fields: ['summary', 'title'] })
  })

  it('Override mit fehlendem Feld -> klarer Fehler (kein Silent-Drop)', () => {
    expect(
      resolveEditableFields({ schemaFieldKeys: ['title', 'summary'], overrideFields: ['title', 'phantom'] })
    ).toEqual({ ok: false, reason: 'missing-bound-fields', missingFields: ['phantom'] })
  })

  it('Schema ohne Inhaltsfeld -> klarer Fehler statt ALLE Felder', () => {
    expect(
      resolveEditableFields({ schemaFieldKeys: ['docType', 'slug', 'detailViewType'] })
    ).toEqual({ ok: false, reason: 'no-content-fields' })
  })

  it('echte Fixtures sind kompatibel (ok)', () => {
    for (const name of WIZARDS) {
      const t = load(name)
      const schemaFieldKeys = t.metadata.fields.map((f) => f.key)
      const overrideFields = t.creation?.flow.steps.find((s) => s.preset === 'editDraft')?.fields
      expect(resolveEditableFields({ schemaFieldKeys, overrideFields }).ok).toBe(true)
    }
  })
})
