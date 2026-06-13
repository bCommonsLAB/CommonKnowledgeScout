/**
 * Charakter-Tests der reinen Wizard-Entscheidungslogik (wizard-flow.ts) gegen
 * die „Kitchen-Sink"-Test-Library. Sicherheitsnetz VOR der generischen
 * Merge-Runtime (ADR-0003 Phase 3a): pinnt das heutige Verhalten von
 * Step-Filter, `canProceed`, Renderer-Auflösung (inkl. Drift) und
 * Kompatibilitätsprüfung fest.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/phase-2-test-library.md (§5.3)
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import type { CreationFlowStepRef } from '@/lib/templates/template-types'
import {
  filterWizardSteps,
  canProceedFromStep,
  resolveWizardPreviewViewType,
  selectEditableFields,
  checkWizardSchemaCompatibility,
} from '@/lib/creation/wizard-flow'

const TEMPLATES_DIR = join(process.cwd(), 'test-library', 'templates')

function loadFixture(name: string) {
  const content = readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf-8')
  return parseTemplate(content, name).template
}

function presets(steps: CreationFlowStepRef[]): string[] {
  return steps.map((s) => s.preset)
}

describe('filterWizardSteps — Step-Sichtbarkeit', () => {
  it('event ohne Quell-Ordner: selectFolderArtifacts + generateDraft entfallen, collectSource bleibt', () => {
    const t = loadFixture('event')
    const visible = presets(filterWizardSteps(t.creation!.flow.steps, {}))
    expect(visible).toContain('collectSource')
    expect(visible).not.toContain('selectFolderArtifacts')
    expect(visible).not.toContain('generateDraft')
  })

  it('event mit Quell-Ordner: collectSource entfällt, selectFolderArtifacts + generateDraft erscheinen', () => {
    const t = loadFixture('event')
    const visible = presets(filterWizardSteps(t.creation!.flow.steps, { sourceFolderId: 'fid' }))
    expect(visible).not.toContain('collectSource')
    expect(visible).toContain('selectFolderArtifacts')
    expect(visible).toContain('generateDraft')
  })

  it('testimonial: ohne Ordner-Artefakt-Step bleibt collectSource auch mit Quell-Ordner erhalten', () => {
    const t = loadFixture('testimonial')
    const visible = presets(filterWizardSteps(t.creation!.flow.steps, { sourceFolderId: 'fid' }))
    expect(visible).toContain('collectSource')
  })

  it('dialograum: generateDraft nur mit Quell-Ordner (charakterisiert)', () => {
    const t = loadFixture('dialograum')
    expect(presets(filterWizardSteps(t.creation!.flow.steps, {}))).not.toContain('generateDraft')
    expect(presets(filterWizardSteps(t.creation!.flow.steps, { sourceFolderId: 'fid' }))).toContain('generateDraft')
  })
})

describe('canProceedFromStep — Per-Preset-Gating', () => {
  it('immer-erlaubte Presets', () => {
    for (const p of ['welcome', 'editDraft', 'uploadImages', 'selectRelatedTestimonials', 'previewDetail', 'completion'] as const) {
      expect(canProceedFromStep(p, { sourcesCount: 0 })).toBe(true)
    }
  })

  it('collectSource: Extraktion blockt; Quellen/Flag/Legacy erlauben', () => {
    expect(canProceedFromStep('collectSource', { sourcesCount: 5, isExtracting: true })).toBe(false)
    expect(canProceedFromStep('collectSource', { sourcesCount: 1 })).toBe(true)
    expect(canProceedFromStep('collectSource', { sourcesCount: 0, collectSourceCanProceed: true })).toBe(true)
    expect(canProceedFromStep('collectSource', { sourcesCount: 0, hasCollectedInput: true })).toBe(true)
    expect(canProceedFromStep('collectSource', { sourcesCount: 0 })).toBe(false)
  })

  it('selectFolderArtifacts: nur mit Quellen', () => {
    expect(canProceedFromStep('selectFolderArtifacts', { sourcesCount: 0 })).toBe(false)
    expect(canProceedFromStep('selectFolderArtifacts', { sourcesCount: 2 })).toBe(true)
  })

  it('generateDraft: im Interview-Modus Entwurf nötig, im Form-Modus frei', () => {
    expect(canProceedFromStep('generateDraft', { sourcesCount: 1, mode: 'interview', hasGeneratedDraft: false })).toBe(false)
    expect(canProceedFromStep('generateDraft', { sourcesCount: 1, mode: 'interview', hasGeneratedDraft: true })).toBe(true)
    expect(canProceedFromStep('generateDraft', { sourcesCount: 1, mode: 'form' })).toBe(true)
  })

  it('publish: erst nach erfolgreichem Publish', () => {
    expect(canProceedFromStep('publish', { sourcesCount: 1, isPublishing: true })).toBe(false)
    expect(canProceedFromStep('publish', { sourcesCount: 1, isPublished: true })).toBe(true)
    expect(canProceedFromStep('publish', { sourcesCount: 1 })).toBe(false)
  })
})

describe('resolveWizardPreviewViewType — Renderer-Auflösung inkl. Drift', () => {
  it.each([
    ['event', 'session'],
    ['event-final', 'session'],
    ['testimonial', 'testimonial'],
    ['dialograum', 'blog'],
  ] as const)('%s rendert als %s', (name, expected) => {
    expect(resolveWizardPreviewViewType(loadFixture(name))).toBe(expected)
  })

  it('pc-steckbrief: refurbedDevice ist dem Wizard-Preview unbekannt → Drift-Fallback session', () => {
    const t = loadFixture('pc-steckbrief')
    expect(t.metadata.detailViewType).toBe('refurbedDevice')
    expect(resolveWizardPreviewViewType(t)).toBe('session')
  })
})

describe('selectEditableFields — Feld-Auswahl im editDraft (O1: schema-getrieben)', () => {
  it('event-final: editDraft-Liste filtert auf Inhalts-Felder in Schema-Reihenfolge', () => {
    const t = loadFixture('event-final')
    const schemaKeys = t.metadata.fields.map((f) => f.key)
    const editStep = t.creation!.flow.steps.find((s) => s.preset === 'editDraft')
    const visible = selectEditableFields(schemaKeys, editStep?.fields)
    expect(visible).toEqual(['title', 'summary', 'bodyInText', 'eindruckDerTeilnehmer', 'testimonials'])
    // System-/Struktur-Felder bleiben außen vor (R3).
    for (const sys of ['docType', 'detailViewType', 'extends', 'relatedSchemas', 'source_language']) {
      expect(visible).not.toContain(sys)
    }
  })

  it('ohne userRelevantFields: alle Schema-Felder (Legacy-Fallback)', () => {
    expect(selectEditableFields(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('unbekannter Feldname wird heute still verworfen (der Silent-Fallback)', () => {
    expect(selectEditableFields(['title', 'summary'], ['title', 'gibtsnicht'])).toEqual(['title'])
  })
})

describe('checkWizardSchemaCompatibility — Wizard↔Schema', () => {
  it.each(['event', 'event-final', 'testimonial', 'dialograum', 'pc-steckbrief'] as const)(
    '%s: alle editDraft-Felder existieren im Schema',
    (name) => {
      const t = loadFixture(name)
      const schemaKeys = t.metadata.fields.map((f) => f.key)
      expect(checkWizardSchemaCompatibility(t.creation!.flow.steps, schemaKeys)).toEqual({
        ok: true,
        missingFields: [],
      })
    }
  )

  it('fehlendes Feld wird als Inkompatibilität gemeldet (kein Silent-Drop)', () => {
    const steps: CreationFlowStepRef[] = [
      { id: 'Edit', preset: 'editDraft', fields: ['title', 'phantomField'] },
    ]
    expect(checkWizardSchemaCompatibility(steps, ['title', 'summary'])).toEqual({
      ok: false,
      missingFields: ['phantomField'],
    })
  })
})
