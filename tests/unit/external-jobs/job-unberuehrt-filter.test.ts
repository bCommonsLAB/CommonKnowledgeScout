/**
 * @fileoverview Unit-Tests: Vorbedingung „Route hat den Job nie angefasst" (Welle I2).
 */

import { describe, it, expect } from 'vitest'
import { istUnberuehrt, unberuehrtFilter } from '@/lib/external-jobs/job-unberuehrt-filter'

describe('unberuehrtFilter', () => {
  it('verlangt running und keinen Schritt ueber pending hinaus', () => {
    expect(unberuehrtFilter('j1')).toEqual({
      jobId: 'j1',
      status: 'running',
      steps: { $not: { $elemMatch: { status: { $in: ['running', 'completed', 'failed'] } } } },
    })
  })
})

describe('istUnberuehrt (dieselbe Regel auf dem Dokument)', () => {
  it('frisch angelegter Text-Job: running, alle Schritte pending', () => {
    expect(istUnberuehrt({ status: 'running', steps: [{ name: 'extract_pdf', status: 'pending' }] })).toBe(true)
  })

  it('ohne steps-Feld ebenfalls unberuehrt', () => {
    expect(istUnberuehrt({ status: 'running' })).toBe(true)
  })

  it('ein laufender Schritt beweist Arbeit der Route', () => {
    expect(istUnberuehrt({ status: 'running', steps: [{ name: 'transform_template', status: 'running' }] })).toBe(false)
  })

  it('abgeschlossener Ingest: der Endstatus gehoert der Route', () => {
    expect(istUnberuehrt({ status: 'running', steps: [
      { name: 'transform_template', status: 'completed' },
      { name: 'ingest_rag', status: 'completed' },
    ] })).toBe(false)
  })

  it('completed oder failed sind nie unberuehrt', () => {
    expect(istUnberuehrt({ status: 'completed', steps: [] })).toBe(false)
    expect(istUnberuehrt({ status: 'failed', steps: [] })).toBe(false)
  })
})
