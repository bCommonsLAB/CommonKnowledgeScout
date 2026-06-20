// @vitest-environment node

/**
 * Characterization Tests fuer Pure-Helper + Konstanten aus
 * flow/pipeline-sheet.tsx (Welle 3-II-d, Schritt 1).
 */

import { describe, it, expect } from 'vitest'
import {
  isNonEmptyString,
  buildPipelinePlan,
  PHASE_RANK,
  type PipelinePlanInput,
} from '@/components/library/flow/pipeline-sheet/helpers'

// Basis-Eingabe: alle Artefakte existieren, nichts aktiviert, kein Force.
function makeInput(overrides: Partial<PipelinePlanInput> = {}): PipelinePlanInput {
  return {
    skipExtract: false,
    entryRank: PHASE_RANK.transcript,
    enabled: { extract: false, transform: false, ingest: false },
    existing: { hasTranscript: true, hasTransformed: true, hasIngested: true },
    force: false,
    ...overrides,
  }
}

describe('isNonEmptyString (pipeline-sheet) — Pure-Logik-Vertrag', () => {
  it('liefert true fuer nicht-leeren String', () => {
    expect(isNonEmptyString('hello')).toBe(true)
    expect(isNonEmptyString('a')).toBe(true)
  })

  it('liefert false fuer leeren String', () => {
    expect(isNonEmptyString('')).toBe(false)
  })

  it('liefert false fuer Whitespace-only-String', () => {
    expect(isNonEmptyString('   ')).toBe(false)
    expect(isNonEmptyString('\n\t')).toBe(false)
  })

  it('liefert false fuer null/undefined', () => {
    expect(isNonEmptyString(null)).toBe(false)
    expect(isNonEmptyString(undefined)).toBe(false)
  })

  it('liefert false fuer Zahlen, Booleans, Objekte, Arrays', () => {
    expect(isNonEmptyString(42)).toBe(false)
    expect(isNonEmptyString(true)).toBe(false)
    expect(isNonEmptyString({})).toBe(false)
    expect(isNonEmptyString([])).toBe(false)
  })

  it('akzeptiert String mit fuehrendem/trailing Whitespace, wenn Inhalt vorhanden', () => {
    expect(isNonEmptyString('  hello  ')).toBe(true)
  })
})

describe('buildPipelinePlan — Force gilt ab Einstiegspunkt abwaerts', () => {
  it('Einstieg Transformation: Transkript wird NICHT erzwungen (kein erneutes OCR)', () => {
    // Genau der gemeldete Fehlerfall: nur transformieren, aber OCR lief erneut.
    const plan = buildPipelinePlan(makeInput({
      entryRank: PHASE_RANK.transform,
      enabled: { extract: false, transform: true, ingest: true },
      force: true,
    }))
    // Transkript bleibt erhalten (nicht aktiv) -> ignore, nicht force.
    expect(plan.policies.extract).toBe('ignore')
    expect(plan.policies.metadata).toBe('force')
    expect(plan.policies.ingest).toBe('force')
    expect(plan.hasOverwrite).toBe(true)
    // Dialog: Transkript wiederverwendet, Rest ueberschrieben.
    expect(plan.lines).toEqual([
      { phase: 'transcript', action: 'reuse' },
      { phase: 'transform', action: 'overwrite' },
      { phase: 'story', action: 'overwrite' },
    ])
  })

  it('Einstieg Story: nur die Story wird ueberschrieben', () => {
    const plan = buildPipelinePlan(makeInput({
      entryRank: PHASE_RANK.story,
      enabled: { extract: false, transform: false, ingest: true },
      force: true,
    }))
    expect(plan.policies.extract).toBe('ignore')
    expect(plan.policies.metadata).toBe('ignore')
    expect(plan.policies.ingest).toBe('force')
    expect(plan.lines).toEqual([
      { phase: 'transcript', action: 'reuse' },
      { phase: 'transform', action: 'reuse' },
      { phase: 'story', action: 'overwrite' },
    ])
  })

  it('Einstieg Transkript: voller Lauf erzwingt alle vorhandenen Phasen', () => {
    const plan = buildPipelinePlan(makeInput({
      entryRank: PHASE_RANK.transcript,
      enabled: { extract: true, transform: true, ingest: true },
      force: true,
    }))
    expect(plan.policies.extract).toBe('force')
    expect(plan.policies.metadata).toBe('force')
    expect(plan.policies.ingest).toBe('force')
  })

  it('Vorgelagerte Phase wird selbst bei (defensiver) Aktivierung nicht erzwungen', () => {
    // Extract ist vorgelagert (rank 0 < entryRank 1) -> niemals force.
    const plan = buildPipelinePlan(makeInput({
      entryRank: PHASE_RANK.transform,
      enabled: { extract: true, transform: true, ingest: false },
      force: true,
    }))
    expect(plan.policies.extract).toBe('do')
    expect(plan.policies.metadata).toBe('force')
  })

  it('Kein Force: vorhandenes Artefakt wird wiederverwendet (do, kein overwrite)', () => {
    const plan = buildPipelinePlan(makeInput({
      entryRank: PHASE_RANK.transform,
      enabled: { extract: false, transform: true, ingest: false },
      force: false,
    }))
    expect(plan.policies.metadata).toBe('do')
    expect(plan.hasOverwrite).toBe(false)
  })

  it('Fehlendes Artefakt: Phase wird erstellt (create)', () => {
    const plan = buildPipelinePlan(makeInput({
      entryRank: PHASE_RANK.story,
      enabled: { extract: false, transform: false, ingest: true },
      existing: { hasTranscript: true, hasTransformed: true, hasIngested: false },
      force: true,
    }))
    expect(plan.policies.ingest).toBe('do')
    expect(plan.hasOverwrite).toBe(false)
    expect(plan.lines).toEqual([
      { phase: 'transcript', action: 'reuse' },
      { phase: 'transform', action: 'reuse' },
      { phase: 'story', action: 'create' },
    ])
  })

  it('Markdown/Bild (skipExtract): keine Transkript-Zeile, extract bleibt ignore', () => {
    const plan = buildPipelinePlan(makeInput({
      skipExtract: true,
      entryRank: PHASE_RANK.transform,
      enabled: { extract: false, transform: true, ingest: false },
      force: true,
    }))
    expect(plan.policies.extract).toBe('ignore')
    expect(plan.lines.some(l => l.phase === 'transcript')).toBe(false)
    expect(plan.lines[0]).toEqual({ phase: 'transform', action: 'overwrite' })
  })
})
