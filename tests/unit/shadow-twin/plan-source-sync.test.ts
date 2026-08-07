/**
 * @fileoverview Unit-Tests fuer planSourceSync (Quell-Plan: Transkript +
 * Transformationen + Bilder + needs-pipeline).
 */

import { describe, it, expect } from 'vitest'
import { planSourceSync, type SourceSyncInput } from '@/lib/shadow-twin/sync-plan/plan-source-sync'
import type { SyncOperationType } from '@/lib/shadow-twin/sync-plan/types'

const T0 = new Date('2026-08-01T12:00:00Z')
function later(ms: number): Date {
  return new Date(T0.getTime() + ms)
}

function pages(n: number): string {
  return Array.from({ length: n }, (_, i) => `# page_${String(i + 1).padStart(3, '0')}.jpeg\nSeite: ${i + 1}`).join('\n\n')
}

function types(plan: { operations: Array<{ type: SyncOperationType }> }): SyncOperationType[] {
  return plan.operations.map((op) => op.type)
}

function input(overrides: Partial<SourceSyncInput>): SourceSyncInput {
  return {
    sourceId: 'src-1',
    sourceName: 'doc.pdf',
    canonicalTranscriptName: 'doc.md',
    transcriptCandidates: [],
    ...overrides,
  }
}

describe('planSourceSync', () => {
  it('volle .en.md gewinnt: write-canonical (Overwrite) + update-mongo + delete-inferior', () => {
    const plan = planSourceSync(input({
      transcriptCandidates: [
        { fileId: 'f-md', name: 'doc.md', markdown: pages(1), origin: 'storage' },
        { fileId: 'f-en', name: 'doc.en.md', markdown: pages(20), origin: 'storage' },
        { name: 'doc.md', markdown: pages(1), origin: 'mongo' },
      ],
    }))
    expect(plan.transcriptStatus).toBe('ok')
    expect(types(plan)).toEqual(['write-canonical-transcript', 'update-mongo-transcript', 'delete-inferior-variant'])
    const write = plan.operations[0]
    expect(write.overwrite).toBe(true) // stale doc.md existiert im Storage
    expect(write.fileId).toBe('f-md')
    expect(plan.operations[2].fileId).toBe('f-en')
  })

  it('kanonische Datei fehlt im Storage → write-canonical ohne Overwrite (reiner Spiegel)', () => {
    const plan = planSourceSync(input({
      transcriptCandidates: [{ name: 'doc.md', markdown: pages(5), origin: 'mongo' }],
    }))
    expect(types(plan)).toEqual(['write-canonical-transcript'])
    expect(plan.operations[0].overwrite).toBe(false)
  })

  it('Transkript-Konflikt: conflict-Op + Notiz, keine Writes, dead-page-md bleibt loeschbar', () => {
    const plan = planSourceSync(input({
      transcriptCandidates: [
        { fileId: 'f-a', name: 'doc.de.md', markdown: pages(10) + '\nA', origin: 'storage' },
        { fileId: 'f-b', name: 'doc.en.md', markdown: pages(10) + '\nB', origin: 'storage' },
      ],
      deadPageMd: [{ fileId: 'p1', name: 'page_001.md' }],
    }))
    expect(plan.transcriptStatus).toBe('conflict')
    expect(types(plan)).toEqual(['conflict', 'delete-dead-page-md'])
    expect(plan.notes.some((n) => n.includes('manuell'))).toBe(true)
  })

  it('needs-reextract: Notiz, keine Transkript-Loeschungen', () => {
    const plan = planSourceSync(input({
      transcriptCandidates: [
        { fileId: 'f-md', name: 'doc.md', markdown: pages(1), origin: 'storage' },
      ],
      expectedPages: 20,
    }))
    expect(plan.transcriptStatus).toBe('needs-reextract')
    expect(plan.operations).toEqual([])
    expect(plan.notes.some((n) => n.includes('Neu-Extraktion'))).toBe(true)
  })

  it('Transformationen: extern editierte Datei → update-mongo-transformation im Plan', () => {
    const plan = planSourceSync(input({
      transformations: [{
        templateName: 'pdfanalyse', targetLanguage: 'de', fileName: 'doc.pdfanalyse.de.md',
        mongo: { markdown: 'Alt', updatedAt: T0 },
        storage: { fileId: 'f-t', name: 'doc.pdfanalyse.de.md', markdown: 'Neu extern', modifiedAt: later(60_000) },
      }],
    }))
    expect(types(plan)).toEqual(['update-mongo-transformation'])
    expect(plan.transformationPlans[0].status).toBe('update-mongo')
  })

  it('Bilder: fehlende Spiegel als mirror-image-Ops, rekonstruierbare als register-Op mit count', () => {
    const plan = planSourceSync(input({
      imagesMissingInStorage: [{ name: 'page_001.jpeg' }, { name: 'page_002.jpeg' }],
      reconstructablePageImages: 7,
    }))
    expect(types(plan)).toEqual(['mirror-image-to-storage', 'mirror-image-to-storage', 'register-image-fragments'])
    expect(plan.operations[2].count).toBe(7)
  })

  it('needs-pipeline: Quelldatei neuer als alle Artefakte → Report-Op, Sync-Ops bleiben', () => {
    const plan = planSourceSync(input({
      sourceModifiedAt: later(600_000),
      transcriptUpdatedAt: T0,
      transcriptCandidates: [
        { fileId: 'f-en', name: 'doc.en.md', markdown: pages(20), origin: 'storage' },
        { name: 'doc.md', markdown: pages(1), origin: 'mongo' },
      ],
    }))
    expect(types(plan)).toContain('needs-pipeline')
    expect(types(plan)).toContain('update-mongo-transcript')
  })

  it('kein needs-pipeline, wenn ein Transformations-Record juenger als die Quelle ist', () => {
    const plan = planSourceSync(input({
      sourceModifiedAt: later(60_000),
      transcriptUpdatedAt: T0,
      transformations: [{
        templateName: 'pdfanalyse', targetLanguage: 'de', fileName: 'doc.pdfanalyse.de.md',
        mongo: { markdown: 'Inhalt', updatedAt: later(120_000) },
        storage: { fileId: 'f-t', name: 'doc.pdfanalyse.de.md', markdown: 'Inhalt', modifiedAt: later(120_000) },
      }],
    }))
    expect(types(plan)).not.toContain('needs-pipeline')
  })

  it('alles synchron → keine Operationen, keine Notizen', () => {
    const full = pages(15)
    const plan = planSourceSync(input({
      transcriptCandidates: [
        { fileId: 'f-md', name: 'doc.md', markdown: full, origin: 'storage' },
        { name: 'doc.md', markdown: full, origin: 'mongo' },
      ],
      transformations: [{
        templateName: 'pdfanalyse', targetLanguage: 'de', fileName: 'doc.pdfanalyse.de.md',
        mongo: { markdown: 'Gleich', updatedAt: T0 },
        storage: { fileId: 'f-t', name: 'doc.pdfanalyse.de.md', markdown: 'Gleich', modifiedAt: T0 },
      }],
    }))
    expect(plan.operations).toEqual([])
    expect(plan.notes).toEqual([])
  })
})
