/**
 * @fileoverview Unit-Tests fuer planNameMigration (Welle 5c, „Aus Alt mach Neu"):
 * Muster A (Rename), Muster B (Split), Report-only-Befunde
 * (legacy-transcript-name, path-too-long), Template-/Kollisions-/Budget-Wachen.
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PATH_BUDGET,
  planNameMigration,
  type NameMigrationInput,
} from '@/lib/shadow-twin/sync-plan/plan-name-migration'

function input(overrides: Partial<NameMigrationInput> = {}): NameMigrationInput {
  return {
    sourceBaseName: 'doc',
    legacyNamed: [],
    combined: null,
    existingFiles: [],
    templateName: 'pdfanalyse',
    splitTargetLanguage: 'de',
    pathBudget: DEFAULT_PATH_BUDGET,
    ...overrides,
  }
}

const LEGACY_TRANSFORMATION = {
  fileId: 'f-1', fileName: 'doc.de.md', targetLanguage: 'de',
  hasFrontmatter: true, pathLength: 60, inTwinFolder: true,
}

describe('planNameMigration — Muster A (Rename)', () => {
  it('plant migrate-legacy-artifact-name auf {base}.{template}.{lang}.md', () => {
    const plan = planNameMigration(input({ legacyNamed: [LEGACY_TRANSFORMATION] }))
    expect(plan.operations).toHaveLength(1)
    const op = plan.operations[0]
    expect(op.type).toBe('migrate-legacy-artifact-name')
    expect(op.fileName).toBe('doc.de.md')
    expect(op.newFileName).toBe('doc.pdfanalyse.de.md')
    expect(op.fileId).toBe('f-1')
    expect(op.templateName).toBe('pdfanalyse')
    expect(op.targetLanguage).toBe('de')
    expect(plan.adoptableAfterMigration).toEqual([
      { fileName: 'doc.pdfanalyse.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'pdfanalyse' },
    ])
  })

  it('ohne Template in der Library-Config: conflict-Befund statt Rename', () => {
    const plan = planNameMigration(input({ legacyNamed: [LEGACY_TRANSFORMATION], templateName: null }))
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0].type).toBe('conflict')
    expect(plan.operations[0].note).toContain('kein Standard-Template')
    expect(plan.adoptableAfterMigration).toEqual([])
  })

  it('Ziel-Name existiert bereits: conflict-Befund statt Rename', () => {
    const plan = planNameMigration(input({
      legacyNamed: [LEGACY_TRANSFORMATION],
      existingFiles: [{ fileName: 'doc.pdfanalyse.de.md', pathLength: 70 }],
    }))
    expect(plan.operations.map((op) => op.type)).toEqual(['conflict'])
    expect(plan.operations[0].note).toContain('existiert bereits')
  })

  it('Ziel-Pfad ueber Budget: path-too-long-Befund statt Rename', () => {
    const plan = planNameMigration(input({
      legacyNamed: [{ ...LEGACY_TRANSFORMATION, pathLength: DEFAULT_PATH_BUDGET - 2 }],
    }))
    expect(plan.operations.map((op) => op.type)).toEqual(['path-too-long'])
    expect(plan.operations[0].newFileName).toBe('doc.pdfanalyse.de.md')
  })

  it('Sibling-Datei wird umbenannt UND im selben Lauf adoptiert (Welle 0c)', () => {
    const plan = planNameMigration(input({ legacyNamed: [{ ...LEGACY_TRANSFORMATION, inTwinFolder: false }] }))
    expect(plan.operations.map((op) => op.type)).toEqual(['migrate-legacy-artifact-name'])
    // Vor Welle 0c blieb das hier leer: Der Executor konnte Sidecars nicht laden.
    expect(plan.adoptableAfterMigration).toEqual([
      { fileName: 'doc.pdfanalyse.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'pdfanalyse' },
    ])
  })

  it('zwei Legacy-Dateien mit demselben Ziel: zweite wird conflict (kein Doppel-Ziel)', () => {
    const plan = planNameMigration(input({
      legacyNamed: [
        LEGACY_TRANSFORMATION,
        { ...LEGACY_TRANSFORMATION, fileId: 'f-2', inTwinFolder: false },
      ],
    }))
    expect(plan.operations.map((op) => op.type)).toEqual(['migrate-legacy-artifact-name', 'conflict'])
  })
})

describe('planNameMigration — Muster B (Split der Kombi-Datei)', () => {
  const COMBINED = {
    fileId: 'c-1', fileName: 'doc.md', markdown: '---\ntitle: X\n---\nTranskript-Body',
    pathLength: 55, inTwinFolder: true,
  }

  it('plant split-combined-artifact mit Inhalt (Original bleibt Transkript)', () => {
    const plan = planNameMigration(input({ combined: COMBINED }))
    expect(plan.operations).toHaveLength(1)
    const op = plan.operations[0]
    expect(op.type).toBe('split-combined-artifact')
    expect(op.fileName).toBe('doc.md')
    expect(op.newFileName).toBe('doc.pdfanalyse.de.md')
    expect(op.markdown).toBe(COMBINED.markdown)
    expect(op.targetLanguage).toBe('de')
    expect(plan.adoptableAfterMigration).toEqual([
      { fileName: 'doc.pdfanalyse.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'pdfanalyse' },
    ])
  })

  it('ohne Template: conflict-Befund statt Split', () => {
    const plan = planNameMigration(input({ combined: COMBINED, templateName: null }))
    expect(plan.operations.map((op) => op.type)).toEqual(['conflict'])
  })
})

describe('planNameMigration — Report-only-Befunde', () => {
  it('legacy-transcript-name fuer {base}.{lang}.md OHNE Frontmatter', () => {
    const plan = planNameMigration(input({
      legacyNamed: [{ ...LEGACY_TRANSFORMATION, hasFrontmatter: false }],
    }))
    expect(plan.operations.map((op) => op.type)).toEqual(['legacy-transcript-name'])
    expect(plan.operations[0].kind).toBe('transcript')
    expect(plan.adoptableAfterMigration).toEqual([])
  })

  it('path-too-long fuer bestehende Dateien ueber dem Budget', () => {
    const plan = planNameMigration(input({
      existingFiles: [
        { fileName: 'ok.md', pathLength: 100 },
        { fileName: 'zu-lang.md', pathLength: DEFAULT_PATH_BUDGET + 1 },
        { fileName: 'unbekannt.md', pathLength: null },
      ],
    }))
    expect(plan.operations.map((op) => op.type)).toEqual(['path-too-long'])
    expect(plan.operations[0].fileName).toBe('zu-lang.md')
  })

  it('ohne Pfadlaengen (sourceIds-Scope): Rename wird trotzdem geplant', () => {
    const plan = planNameMigration(input({
      legacyNamed: [{ ...LEGACY_TRANSFORMATION, pathLength: null }],
    }))
    expect(plan.operations.map((op) => op.type)).toEqual(['migrate-legacy-artifact-name'])
  })
})
