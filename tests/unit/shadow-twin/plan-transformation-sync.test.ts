/**
 * @fileoverview Unit-Tests der Konflikt-Matrix fuer planTransformationSync
 * (Design §4.2: Inhalt → Uhr → Konflikt; User-Entscheid 2026-08-07).
 */

import { describe, it, expect } from 'vitest'
import {
  planTransformationSync,
  TIMESTAMP_TOLERANCE_MS,
  type TransformationSyncInput,
} from '@/lib/shadow-twin/sync-plan/plan-transformation-sync'

const T0 = new Date('2026-08-01T12:00:00Z')
function later(ms: number): Date {
  return new Date(T0.getTime() + ms)
}

function input(overrides: Partial<TransformationSyncInput>): TransformationSyncInput {
  return {
    templateName: 'pdfanalyse',
    targetLanguage: 'de',
    fileName: 'doc.pdfanalyse.de.md',
    mongo: null,
    storage: null,
    ...overrides,
  }
}

describe('planTransformationSync — Konflikt-Matrix', () => {
  it('inhaltsgleich (trotz abweichender Timestamps) → synced, keine Operation', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'Inhalt A', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'Inhalt A', modifiedAt: later(60_000) },
    }))
    expect(plan.status).toBe('synced')
    expect(plan.operation).toBeNull()
  })

  it('CRLF/Whitespace zaehlen nicht als Unterschied → synced', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'Zeile 1\nZeile 2', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: '  Zeile 1\r\nZeile 2\r\n', modifiedAt: later(60_000) },
    }))
    expect(plan.status).toBe('synced')
  })

  it('nur Mongo hat Inhalt (keine Storage-Datei) → mirror-to-storage ohne Overwrite', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'Inhalt', updatedAt: T0 },
    }))
    expect(plan.status).toBe('mirror-to-storage')
    expect(plan.operation?.type).toBe('mirror-artifact-to-storage')
    expect(plan.operation?.overwrite).toBe(false)
    expect(plan.operation?.markdown).toBe('Inhalt')
    expect(plan.operation?.templateName).toBe('pdfanalyse')
  })

  it('leere Storage-Datei + Mongo-Inhalt → mirror-to-storage MIT Overwrite (leer verliert immer)', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'Inhalt', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: '   ', modifiedAt: later(60_000) },
    }))
    expect(plan.status).toBe('mirror-to-storage')
    expect(plan.operation?.overwrite).toBe(true)
    expect(plan.operation?.fileId).toBe('f1')
  })

  it('nur Storage hat Inhalt (kein Mongo-Record) → update-mongo (adoptieren)', () => {
    const plan = planTransformationSync(input({
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'Extern', modifiedAt: T0 },
    }))
    expect(plan.status).toBe('update-mongo')
    expect(plan.operation?.type).toBe('update-mongo-transformation')
    expect(plan.operation?.markdown).toBe('Extern')
  })

  it('leerer Mongo-Record + Storage-Inhalt → update-mongo (kaputten Record ersetzen)', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: '', updatedAt: later(600_000) },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'Extern', modifiedAt: T0 },
    }))
    expect(plan.status).toBe('update-mongo')
  })

  it('beide leer → invalid-empty, keine Operation, Klartext-Notiz', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: '  ', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: '', modifiedAt: T0 },
    }))
    expect(plan.status).toBe('invalid-empty')
    expect(plan.operation).toBeNull()
    expect(plan.note).toBeTruthy()
  })

  it('verschieden + Storage neuer (> Toleranz) → update-mongo mit Storage-Inhalt', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'Alt', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'Neu extern', modifiedAt: later(TIMESTAMP_TOLERANCE_MS + 1_000) },
    }))
    expect(plan.status).toBe('update-mongo')
    expect(plan.operation?.markdown).toBe('Neu extern')
  })

  it('verschieden + Mongo neuer (> Toleranz) → mirror-to-storage mit Overwrite', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'Neu aus Pipeline', updatedAt: later(TIMESTAMP_TOLERANCE_MS + 1_000) },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'Alt', modifiedAt: T0 },
    }))
    expect(plan.status).toBe('mirror-to-storage')
    expect(plan.operation?.overwrite).toBe(true)
    expect(plan.operation?.markdown).toBe('Neu aus Pipeline')
  })

  it('verschieden + Timestamps innerhalb der Toleranz → conflict, Report-only-Operation', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'A', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'B', modifiedAt: later(TIMESTAMP_TOLERANCE_MS - 1_000) },
    }))
    expect(plan.status).toBe('conflict')
    expect(plan.operation?.type).toBe('conflict')
    expect(plan.note).toContain('Toleranz')
  })

  it('verschieden + Mongo-Datum fehlt → conflict (kein stilles „Mongo gewinnt")', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'A', updatedAt: null },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'B', modifiedAt: T0 },
    }))
    expect(plan.status).toBe('conflict')
    expect(plan.note).toContain('unvollstaendig')
  })

  it('verschieden + Storage-Datum fehlt → conflict', () => {
    const plan = planTransformationSync(input({
      mongo: { markdown: 'A', updatedAt: T0 },
      storage: { fileId: 'f1', name: 'doc.pdfanalyse.de.md', markdown: 'B', modifiedAt: null },
    }))
    expect(plan.status).toBe('conflict')
  })

  it('fehlender templateName wirft (ArtifactKey-Contract)', () => {
    expect(() => planTransformationSync(input({ templateName: '' }))).toThrow(/templateName/)
  })
})
