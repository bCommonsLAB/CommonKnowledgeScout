/**
 * Soll-Verhalten je Assistent — die `auto`-Erfolgskriterien aus den
 * Wizard-Konzepten (docs/wizards/*.md), gegen die Kitchen-Sink-Fixtures geprüft.
 *
 * Jede Erwartung hier entspricht einer abgehakten `auto`-Zeile im jeweiligen
 * Konzept-Dokument. Ändert sich ein Konzept, ändert sich dieser Test mit.
 *
 * @see docs/wizards/README.md
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import type { CreationFlowStepRef } from '@/lib/templates/template-types'
import {
  resolveWizardPreviewViewType,
  checkWizardSchemaCompatibility,
} from '@/lib/creation/wizard-flow'

const TEMPLATES_DIR = join(process.cwd(), 'test-library', 'templates')

function load(name: string) {
  return parseTemplate(readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf-8'), name).template
}

function editStep(steps: CreationFlowStepRef[]): CreationFlowStepRef | undefined {
  return steps.find((s) => s.preset === 'editDraft')
}

/** Soll-Vertrag je Assistent — 1:1 aus docs/wizards/<name>.md (auto-Kriterien). */
const WIZARDS = [
  {
    name: 'event',
    sources: ['text', 'url', 'folder'],
    editFields: ['title', 'summary', 'event_date', 'location', 'filename'],
    renderer: 'session',
    mustHavePresets: ['selectFolderArtifacts', 'previewDetail', 'publish'],
  },
  {
    name: 'testimonial',
    sources: ['spoken'],
    editFields: ['title', 'statement', 'author_name', 'author_image_url', 'filename'],
    imageFields: ['author_image_url'],
    renderer: 'testimonial',
    mustHavePresets: ['collectSource', 'editDraft', 'publish'],
    ingestOnFinish: false,
  },
  {
    name: 'dialograum',
    sources: ['file', 'text'],
    editFields: ['title', 'summary', 'result_text', 'filename'],
    renderer: 'blog',
    mustHavePresets: ['selectRelatedTestimonials', 'publish'],
  },
  {
    name: 'pc-steckbrief',
    sources: ['text'],
    editFields: ['title', 'device_type', 'cpu', 'ram_gb', 'storage_gb', 'condition_grade', 'filename'],
    // Renderer-Drift: Schema sagt refurbedDevice, Wizard-Preview liefert session.
    schemaRenderer: 'refurbedDevice',
    renderer: 'session',
    mustHavePresets: ['previewDetail', 'publish'],
    ingestOnFinish: false,
  },
  {
    name: 'event-final',
    sources: ['text'],
    editFields: ['title', 'summary', 'bodyInText', 'eindruckDerTeilnehmer', 'testimonials'],
    forbiddenFields: ['slug', 'originalFileId', 'finalRunId', 'eventStatus', 'docType'],
    renderer: 'session',
    mustHavePresets: ['selectRelatedTestimonials', 'previewDetail', 'publish'],
  },
] as const

describe.each(WIZARDS)('Wizard-Konzept: $name', (w) => {
  it('Quelltypen wie im Konzept', () => {
    const t = load(w.name)
    const sources = t.creation?.supportedSources.map((s) => s.type) ?? []
    expect(sources).toEqual(expect.arrayContaining([...w.sources]))
    expect(sources.length).toBe(w.sources.length)
  })

  it('editDraft bindet genau die dokumentierten Inhalts-Felder', () => {
    const t = load(w.name)
    expect(editStep(t.creation!.flow.steps)?.fields ?? []).toEqual([...w.editFields])
  })

  it('Vorschau-Renderer wie im Konzept (inkl. Drift)', () => {
    expect(resolveWizardPreviewViewType(load(w.name))).toBe(w.renderer)
  })

  it('alle gebundenen Felder existieren im Schema (kompatibel)', () => {
    const t = load(w.name)
    const schemaKeys = t.metadata.fields.map((f) => f.key)
    expect(checkWizardSchemaCompatibility(t.creation!.flow.steps, schemaKeys).ok).toBe(true)
  })

  it('enthält die im Konzept genannten Pflicht-Schritte', () => {
    const t = load(w.name)
    const presets = t.creation!.flow.steps.map((s) => s.preset)
    for (const p of w.mustHavePresets) expect(presets).toContain(p)
  })

  if ('forbiddenFields' in w && w.forbiddenFields) {
    it('editDraft zeigt KEINE System-Felder (R3)', () => {
      const fields = editStep(load(w.name).creation!.flow.steps)?.fields ?? []
      for (const sys of w.forbiddenFields) expect(fields).not.toContain(sys)
    })
  }

  if ('imageFields' in w && w.imageFields) {
    it('markiert die dokumentierten Bild-Felder', () => {
      const step = editStep(load(w.name).creation!.flow.steps)
      expect(step?.imageFieldKeys ?? []).toEqual([...w.imageFields])
    })
  }

  if ('schemaRenderer' in w && w.schemaRenderer) {
    it('Schema-Renderer weicht vom Wizard-Preview ab (Drift dokumentiert)', () => {
      expect(load(w.name).metadata.detailViewType).toBe(w.schemaRenderer)
      expect(resolveWizardPreviewViewType(load(w.name))).not.toBe(w.schemaRenderer)
    })
  }

  if ('ingestOnFinish' in w && w.ingestOnFinish === false) {
    it('Speichern nimmt NICHT automatisch in den Suchindex auf', () => {
      const publish = load(w.name).creation!.flow.steps.find((s) => s.preset === 'publish')
      expect(publish?.ingestOnFinish).toBe(false)
    })
  }
})

describe('Wizard-Konzept: pdfanalyse (kein Assistent)', () => {
  it('ist schema-only — kein creation-Block', () => {
    expect(load('pdfanalyse').creation).toBeUndefined()
  })
})
