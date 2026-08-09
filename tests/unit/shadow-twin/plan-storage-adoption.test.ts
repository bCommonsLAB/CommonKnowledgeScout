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
})
