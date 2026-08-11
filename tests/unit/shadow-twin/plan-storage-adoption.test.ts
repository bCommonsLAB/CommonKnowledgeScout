/**
 * @fileoverview Unit-Tests fuer planStorageAdoption (Welle 5a):
 * EINE adopt-storage-only-source-Operation pro Quelle mit Artefakten,
 * leerer Plan ohne Artefakte.
 */

import { describe, it, expect } from 'vitest'
import { planStorageAdoption } from '@/lib/shadow-twin/sync-plan/plan-storage-adoption'
import type { AdoptableArtifact } from '@/lib/shadow-twin/sync-plan/types'

const ARTIFACTS: AdoptableArtifact[] = [
  { fileName: 'doc.md', kind: 'transcript', targetLanguage: '' },
  { fileName: 'doc.pdfanalyse.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'pdfanalyse' },
]

describe('planStorageAdoption', () => {
  it('plant EINE adopt-Operation pro Quelle mit allen Artefakten', () => {
    const plan = planStorageAdoption({ sourceId: 'src-1', sourceName: 'doc.pdf', artifacts: ARTIFACTS })
    expect(plan.operations).toHaveLength(1)
    const op = plan.operations[0]
    expect(op.type).toBe('adopt-storage-only-source')
    expect(op.kind).toBe('source')
    expect(op.fileName).toBe('doc.pdf')
    expect(op.count).toBe(2)
    expect(op.artifacts).toEqual(ARTIFACTS)
    expect(plan.notes).toHaveLength(1)
  })

  it('ohne Artefakte: leerer Plan (Quelle ist gewoehnliche Datei)', () => {
    const plan = planStorageAdoption({ sourceId: 'src-1', sourceName: 'doc.pdf', artifacts: [] })
    expect(plan.operations).toEqual([])
    expect(plan.notes).toEqual([])
    expect(plan.transcriptStatus).toBe('empty')
  })

  it('Namens-Migration (Welle 5c): Rename steht VOR der Adoption, neuer Name wird mit-adoptiert', () => {
    const plan = planStorageAdoption({
      sourceId: 'src-1', sourceName: 'doc.pdf', artifacts: [ARTIFACTS[0]],
      nameMigration: {
        sourceBaseName: 'doc',
        legacyNamed: [{ fileId: 'f-1', fileName: 'doc.de.md', targetLanguage: 'de', hasFrontmatter: true, pathLength: null, inTwinFolder: true }],
        combined: null, existingFiles: [],
        templateName: 'pdfanalyse', splitTargetLanguage: 'de', pathBudget: 347,
      },
    })
    expect(plan.operations.map((op) => op.type)).toEqual(['migrate-legacy-artifact-name', 'adopt-storage-only-source'])
    const adopt = plan.operations[1]
    expect(adopt.count).toBe(2)
    expect(adopt.artifacts).toContainEqual({
      fileName: 'doc.pdfanalyse.de.md', kind: 'transformation', targetLanguage: 'de', templateName: 'pdfanalyse',
    })
  })
})
