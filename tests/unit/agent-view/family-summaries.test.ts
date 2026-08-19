/**
 * @fileoverview Unit-Tests: Twin-Familien-Summaries (Welle 4, F4).
 *
 * Fuehrendes Artefakt, Vertrauensampel (temporale Regel §3.2) und das
 * Familien-Budget — jeweils Positiv- und Negativfall.
 */

import { describe, it, expect } from 'vitest'
import {
  MAX_FAMILY_SUMMARIES,
  buildFamilySummaries,
  verificationStateOf,
} from '@/lib/agent-view/family-summaries'
import type { TwinArtifactView, TwinFamilyView } from '@/lib/agent-view/twin-rules'

const STANDARD = 'standard-konzept'

function transcript(fm: Record<string, unknown> = {}): TwinArtifactView {
  return {
    kind: 'transcript', targetLanguage: '', updatedAt: '2026-08-01T10:00:00.000Z',
    frontmatter: {
      generated_by: 'knowledgescout/gemini-2.5-pro',
      generated_at: '2026-08-01T10:00:00.000Z',
      ...fm,
    },
  }
}

function transformation(fm: Record<string, unknown> = {}, templateName = STANDARD): TwinArtifactView {
  return {
    kind: 'transformation', templateName, targetLanguage: 'de', updatedAt: '2026-08-02T10:00:00.000Z',
    frontmatter: {
      generated_by: 'knowledgescout/gemini-2.5-pro',
      generated_at: '2026-08-02T10:00:00.000Z',
      twin_status: 'draft',
      ...fm,
    },
  }
}

function family(artifacts: TwinArtifactView[], overrides: Partial<TwinFamilyView> = {}): TwinFamilyView {
  return {
    sourceId: 's1', sourceName: 'Aufnahme.m4a', folderId: 'f1',
    path: '25.01 Pilot/Aufnahme.m4a', artifacts, ...overrides,
  }
}

describe('buildFamilySummaries — fuehrendes Artefakt (Contract §2b)', () => {
  it('Standard-Transformation fuehrt; Kurationsfelder kommen aus IHREM Frontmatter', () => {
    const { families, truncated } = buildFamilySummaries({
      families: [family([transcript(), transformation({ twin_status: 'stable' })])],
      standardTemplate: STANDARD,
    })
    expect(truncated).toBe(false)
    expect(families).toHaveLength(1)
    expect(families[0].artifactCount).toBe(2)
    expect(families[0].leading).toMatchObject({
      kind: 'transformation', templateName: STANDARD, targetLanguage: 'de', twinStatus: 'stable',
    })
  })

  it('ohne Standard-Template fuehrt das Transkript; ohne Artefakte leading=null', () => {
    const { families } = buildFamilySummaries({
      families: [family([transcript(), transformation()]), family([], { sourceId: 's2', path: 'B/leer.pdf' })],
      standardTemplate: null,
    })
    expect(families[0].leading?.kind).toBe('transcript')
    expect(families[1].leading).toBeNull()
  })

  it('sortiert stabil nach Pfad und kappt am Budget mit explizitem Flag', () => {
    const many = Array.from({ length: MAX_FAMILY_SUMMARIES + 1 }, (_, index) =>
      family([transcript()], { sourceId: `s${index}`, path: `Ordner/${String(index).padStart(5, '0')}.pdf` }),
    )
    const { families, truncated } = buildFamilySummaries({ families: many, standardTemplate: null })
    expect(truncated).toBe(true)
    expect(families).toHaveLength(MAX_FAMILY_SUMMARIES)
    expect(families[0].path < families[1].path).toBe(true)
  })
})

describe('verificationStateOf — Vertrauensampel (Contract §3.2)', () => {
  it('kein verified_by → unverifiziert', () => {
    expect(verificationStateOf({ generated_at: '2026-08-01T10:00:00Z' })).toBe('unverifiziert')
  })

  it('gueltige Mensch-Verifikation → mensch; Maschinen-Actor → maschinell', () => {
    expect(
      verificationStateOf({
        generated_at: '2026-08-01T10:00:00Z', verified_by: 'human:peter', verified_at: '2026-08-02',
      }),
    ).toBe('mensch')
    expect(
      verificationStateOf({
        generated_at: '2026-08-01T10:00:00Z', verified_by: 'knowledgescout/check', verified_at: '2026-08-02',
      }),
    ).toBe('maschinell')
  })

  it('Re-Generierung macht die alte Verifikation sichtbar ungueltig', () => {
    expect(
      verificationStateOf({
        generated_at: '2026-08-10T10:00:00Z', verified_by: 'human:peter', verified_at: '2026-08-02',
      }),
    ).toBe('ungueltig')
  })
})
