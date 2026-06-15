/**
 * Tests der Wizard→Inbox-Mapping-Funktion (U4.0, ADR-0004). Pinnt den
 * CaptureBody-Vertrag, den `POST /api/submissions` (parseCaptureBody) erwartet,
 * inkl. harter Pflichtfeld-Prüfung (kein Silent-Fallback) und Normalisierung.
 */

import { describe, expect, it } from 'vitest'
import { buildWizardCaptureBody, type WizardCaptureInput } from '@/lib/creation/wizard-capture'

function base(overrides: Partial<WizardCaptureInput> = {}): WizardCaptureInput {
  return {
    libraryId: 'lib-1',
    wizardId: 'event-creation-de',
    docType: 'event',
    detailViewType: 'session',
    markdownBody: '## Story',
    metadata: { title: 'Mein Event' },
    ...overrides,
  }
}

describe('buildWizardCaptureBody — Happy Path', () => {
  it('mappt die Pflichtfelder + Metadaten/Markdown', () => {
    expect(buildWizardCaptureBody(base())).toEqual({
      libraryId: 'lib-1',
      wizardId: 'event-creation-de',
      docType: 'event',
      detailViewType: 'session',
      markdownBody: '## Story',
      metadata: { title: 'Mein Event' },
    })
  })

  it('übernimmt target, binaryRefs und confidence, wenn vorhanden', () => {
    const body = buildWizardCaptureBody(
      base({
        target: { folderId: 'fid', slug: 'mein-event' },
        binaryRefs: [{ hash: 'abc', url: 'https://blob/abc.pdf', fileName: 'a.pdf', contentType: 'application/pdf' }],
        confidence: { title: 0.9 },
      }),
    )
    expect(body.target).toEqual({ folderId: 'fid', slug: 'mein-event' })
    expect(body.binaryRefs).toHaveLength(1)
    expect(body.confidence).toEqual({ title: 0.9 })
  })
})

describe('buildWizardCaptureBody — Normalisierung', () => {
  it('lässt leeres target/binaryRefs/confidence weg', () => {
    const body = buildWizardCaptureBody(base({ target: { folderId: '  ', slug: '' }, binaryRefs: [], confidence: {} }))
    expect(body.target).toBeUndefined()
    expect(body.binaryRefs).toBeUndefined()
    expect(body.confidence).toBeUndefined()
  })

  it('behält gesetzte target-Teile (nur folderId)', () => {
    const body = buildWizardCaptureBody(base({ target: { folderId: 'fid' } }))
    expect(body.target).toEqual({ folderId: 'fid' })
  })

  it('Default: leerer Markdown / leeres Metadata-Objekt', () => {
    const body = buildWizardCaptureBody(base({ markdownBody: '', metadata: {} }))
    expect(body.markdownBody).toBe('')
    expect(body.metadata).toEqual({})
  })
})

describe('buildWizardCaptureBody — harte Pflichtfeld-Prüfung (kein Silent-Fallback)', () => {
  it.each(['libraryId', 'wizardId', 'docType', 'detailViewType'] as const)('wirft bei leerem %s', (field) => {
    expect(() => buildWizardCaptureBody(base({ [field]: '   ' }))).toThrow(new RegExp(field))
  })
})
