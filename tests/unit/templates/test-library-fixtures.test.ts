/**
 * Parse-Absicherung der „Kitchen-Sink"-Test-Library (test-library/templates/).
 *
 * Diese Test-Library ist der physische Pruefstand fuer ADR-0003/0004
 * (siehe docs/refactor/welle-3-vi-creation-wizard/phase-2-test-library.md).
 *
 * Was hier abgesichert wird: die DEFINITION-Schicht — jedes Fixture parst
 * fehlerfrei mit dem heutigen parseTemplate. DB-/Laufzeit-Faelle (Inbox,
 * Promotion) sind NICHT Teil dieses Tests; sie laufen lokal (RUNBOOK-local.md).
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'

const TEMPLATES_DIR = join(process.cwd(), 'test-library', 'templates')

function loadFixture(name: string): ReturnType<typeof parseTemplate> {
  const content = readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf-8')
  return parseTemplate(content, name)
}

const ALL_TEMPLATES = [
  'event',
  'event-final',
  'testimonial',
  'dialograum',
  'pdfanalyse',
  'pc-steckbrief',
] as const

describe('Test-Library — alle Fixtures parsen fehlerfrei', () => {
  it.each(ALL_TEMPLATES)('%s parst ohne Validierungsfehler', (name) => {
    const { template, errors } = loadFixture(name)
    expect(errors).toEqual([])
    expect(template.systemprompt.trim().length).toBeGreaterThan(20)
    expect(template.metadata.fields.length).toBeGreaterThan(0)
  })
})

describe('Test-Library — Renderer / detailViewType', () => {
  it.each([
    ['event', 'session'],
    ['event-final', 'session'],
    ['testimonial', 'testimonial'],
    ['dialograum', 'blog'],
    ['pdfanalyse', 'book'],
    ['pc-steckbrief', 'refurbedDevice'],
  ] as const)('%s rendert als %s', (name, expected) => {
    const { template } = loadFixture(name)
    expect(template.metadata.detailViewType).toBe(expected)
  })
})

describe('Test-Library — Wizard-Flows (creation-Block)', () => {
  it('event: Story-aus-Ordner enthaelt selectFolderArtifacts + drei Quelltypen', () => {
    const { template } = loadFixture('event')
    const steps = template.creation?.flow.steps.map((s) => s.preset) ?? []
    expect(steps).toContain('selectFolderArtifacts')
    expect(steps).toContain('generateDraft')
    const sourceTypes = template.creation?.supportedSources.map((s) => s.type) ?? []
    expect(sourceTypes).toEqual(expect.arrayContaining(['text', 'url', 'folder']))
  })

  it('testimonial: Quelle spoken, kurzer Flow', () => {
    const { template } = loadFixture('testimonial')
    const sourceTypes = template.creation?.supportedSources.map((s) => s.type) ?? []
    expect(sourceTypes).toEqual(['spoken'])
  })

  it('dialograum: selectRelatedTestimonials mit file+text', () => {
    const { template } = loadFixture('dialograum')
    const steps = template.creation?.flow.steps.map((s) => s.preset) ?? []
    expect(steps).toContain('selectRelatedTestimonials')
    const sourceTypes = template.creation?.supportedSources.map((s) => s.type) ?? []
    expect(sourceTypes).toEqual(expect.arrayContaining(['file', 'text']))
  })

  it('pdfanalyse: schema-only — KEIN creation-Block (JobWorker-Konsument)', () => {
    const { template } = loadFixture('pdfanalyse')
    expect(template.creation).toBeUndefined()
  })

  it('pc-steckbrief: previewDetail vorhanden (Renderer-Drift-Fall)', () => {
    const { template } = loadFixture('pc-steckbrief')
    const steps = template.creation?.flow.steps.map((s) => s.preset) ?? []
    expect(steps).toContain('previewDetail')
  })
})

describe('Test-Library — R3: System-Felder nie in editDraft (event-final)', () => {
  const SYSTEM_FIELDS = ['slug', 'docType', 'originalFileId', 'finalRunId', 'eventStatus']

  it('event-final editDraft bindet keine System-Felder', () => {
    const { template } = loadFixture('event-final')
    const editStep = template.creation?.flow.steps.find((s) => s.preset === 'editDraft')
    expect(editStep).toBeDefined()
    for (const sys of SYSTEM_FIELDS) {
      expect(editStep?.fields ?? []).not.toContain(sys)
    }
  })

  it('event-final traegt das TARGET-Feld extends: event', () => {
    const { template } = loadFixture('event-final')
    const extendsField = template.metadata.fields.find((f) => f.key === 'extends')
    expect(extendsField?.rawValue).toBe('event')
  })
})
