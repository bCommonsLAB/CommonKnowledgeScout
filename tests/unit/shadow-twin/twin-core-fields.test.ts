/**
 * @fileoverview Unit-Tests: Twin-Kern-Feldsatz (Twin-Datei-Contract §2b/§3)
 *
 * Der Feldsatz ist bewusst vom A0-Basis-Feld-Contract getrennt; die Listen
 * werden hier — analog `base-fields.test.ts` — hart auf Gleichheit geprueft,
 * damit Erweiterungen eine bewusste Entscheidung bleiben.
 */

import { describe, it, expect } from 'vitest'
import {
  TWIN_CORE_FIELDS,
  TWIN_CURATION_FIELDS,
  TWIN_STATUS_VALUES,
  actorLevel,
  requiredTwinCoreFields,
  missingTwinCoreFields,
  parseTwinCoreTimestamp,
  isVerificationValid,
  selectLeadingArtifact,
} from '@/lib/shadow-twin/twin-core-fields'

describe('Twin-Kern — Feldlisten (Contract §3)', () => {
  it('TWIN_CORE_FIELDS ist exakt der Contract-Kern', () => {
    expect([...TWIN_CORE_FIELDS]).toEqual([
      'type',
      'source_file',
      'template',
      'language',
      'generated_by',
      'generated_at',
    ])
  })

  it('Kurations-Felder und twin_status-Werte sind exakt definiert', () => {
    // ADR 0006: `flagged` + die Herkunft der Fehler-Markierung kommen dazu —
    // Muster wie verified_by/verified_at, flach im Frontmatter.
    expect([...TWIN_CURATION_FIELDS]).toEqual([
      'twin_status',
      'verified_by',
      'verified_at',
      'flagged_by',
      'flagged_at',
      'flagged_note',
    ])
    expect([...TWIN_STATUS_VALUES]).toEqual(['draft', 'stable', 'deprecated', 'flagged'])
  })

  it('Pflichtfelder je Art: Transformation braucht template+language, Transkript nicht', () => {
    expect([...requiredTwinCoreFields('transformation')]).toEqual([
      'type',
      'source_file',
      'template',
      'language',
      'generated_by',
      'generated_at',
    ])
    expect([...requiredTwinCoreFields('transcript')]).toEqual([
      'type',
      'source_file',
      'generated_by',
      'generated_at',
    ])
    expect([...requiredTwinCoreFields('canonical')]).toEqual([])
    expect([...requiredTwinCoreFields('raw')]).toEqual([])
  })
})

describe('missingTwinCoreFields', () => {
  it('meldet fehlende Felder in Contract-Reihenfolge (leerer String = fehlend)', () => {
    const meta = { type: 'transcript', source_file: '', generated_by: 'knowledgescout/pipeline' }
    expect(missingTwinCoreFields(meta, 'transcript')).toEqual(['source_file', 'generated_at'])
  })

  it('vollstaendiger Kern → keine Befunde; Zusatzfelder stoeren nicht', () => {
    const meta = {
      type: 'transformation',
      source_file: 'X.pdf',
      template: 'pdfanalyse',
      language: 'de',
      generated_by: 'knowledgescout/pipeline',
      generated_at: '2026-08-17T10:00:00Z',
      summary: 'frei nach Template',
    }
    expect(missingTwinCoreFields(meta, 'transformation')).toEqual([])
  })
})

describe('actorLevel — OKF-Actor-Ebene (Contract §3.1/§3.2)', () => {
  it('kuerzt Produzenten auf die Actor-Ebene und laesst human:/process: ganz', () => {
    expect(actorLevel('knowledgescout/gemini-2.5-pro')).toBe('knowledgescout')
    expect(actorLevel('human:peter')).toBe('human:peter')
    expect(actorLevel('  ')).toBeNull()
    expect(actorLevel(undefined)).toBeNull()
  })
})

describe('parseTwinCoreTimestamp', () => {
  it('liest ISO-Datetimes und behandelt reine Datumsangaben je Grenze', () => {
    const exact = parseTwinCoreTimestamp('2026-08-17T10:00:00.000Z', 'day-start')
    expect(exact).toBe(Date.parse('2026-08-17T10:00:00.000Z'))
    expect(parseTwinCoreTimestamp('2026-08-17', 'day-start')).toBe(Date.parse('2026-08-17T00:00:00.000Z'))
    expect(parseTwinCoreTimestamp('2026-08-17', 'day-end')).toBe(Date.parse('2026-08-17T23:59:59.999Z'))
  })

  it('unlesbare Werte → null (kein stiller Default)', () => {
    expect(parseTwinCoreTimestamp('gestern', 'day-end')).toBeNull()
    expect(parseTwinCoreTimestamp('', 'day-end')).toBeNull()
    expect(parseTwinCoreTimestamp(undefined, 'day-end')).toBeNull()
    expect(parseTwinCoreTimestamp(42, 'day-end')).toBeNull()
  })
})

describe('isVerificationValid — temporale Regel (Contract §3.2)', () => {
  it('Verifikation nach der Generierung zaehlt, davor nicht', () => {
    expect(
      isVerificationValid({ generatedAt: '2026-08-17T10:00:00Z', verifiedAt: '2026-08-18T09:00:00Z' })
    ).toBe(true)
    expect(
      isVerificationValid({ generatedAt: '2026-08-17T10:00:00Z', verifiedAt: '2026-08-16T09:00:00Z' })
    ).toBe(false)
  })

  it('Hand-Verifikation mit reinem Datum zaehlt am selben Tag (Tagesende)', () => {
    expect(isVerificationValid({ generatedAt: '2026-08-17T10:00:00Z', verifiedAt: '2026-08-17' })).toBe(true)
    expect(isVerificationValid({ generatedAt: '2026-08-17T10:00:00Z', verifiedAt: '2026-08-16' })).toBe(false)
  })

  it('reines Datum als generated_at wird als Tagesanfang gelesen', () => {
    expect(isVerificationValid({ generatedAt: '2026-08-17', verifiedAt: '2026-08-17T00:30:00Z' })).toBe(true)
  })

  it('fehlendes verified_at → unverifiziert; fehlendes generated_at → Legacy zaehlt', () => {
    expect(isVerificationValid({ generatedAt: '2026-08-17T10:00:00Z', verifiedAt: undefined })).toBe(false)
    expect(isVerificationValid({ generatedAt: undefined, verifiedAt: '2026-08-17' })).toBe(true)
  })
})

describe('selectLeadingArtifact — fuehrendes Artefakt (Contract §2b)', () => {
  const transcript = { kind: 'transcript' as const }
  const standard = { kind: 'transformation' as const, templateName: 'pdfanalyse' }
  const other = { kind: 'transformation' as const, templateName: 'summary' }

  it('Standard-Template-Transformation fuehrt, wenn vorhanden', () => {
    expect(selectLeadingArtifact([transcript, other, standard], 'pdfanalyse')).toBe(standard)
  })

  it('ohne Standard-Template (oder ohne Treffer) fuehrt das Transkript', () => {
    expect(selectLeadingArtifact([transcript, other], 'pdfanalyse')).toBe(transcript)
    expect(selectLeadingArtifact([transcript, standard], null)).toBe(transcript)
    expect(selectLeadingArtifact([transcript, standard], '')).toBe(transcript)
  })

  it('weder passende Transformation noch Transkript → null', () => {
    expect(selectLeadingArtifact([other], 'pdfanalyse')).toBeNull()
    expect(selectLeadingArtifact([], null)).toBeNull()
  })
})
