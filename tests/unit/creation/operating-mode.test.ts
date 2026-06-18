import { describe, it, expect } from 'vitest'
import {
  resolveOperatingMode,
  isTranscriptOnly,
  effectiveDetailViewTypeForMode,
  transcriptComputeFields,
  wizardPublishCopy,
  type WizardOperatingMode,
} from '@/lib/creation/operating-mode'

describe('resolveOperatingMode', () => {
  it('mappt den Flag auf die Betriebsart', () => {
    expect(resolveOperatingMode({ captureTranscriptOnly: true })).toBe('transcriptOnly')
    expect(resolveOperatingMode({ captureTranscriptOnly: false })).toBe('normal')
    expect(resolveOperatingMode({})).toBe('normal')
  })
})

describe('isTranscriptOnly', () => {
  it('ist nur fuer transcriptOnly wahr', () => {
    expect(isTranscriptOnly('transcriptOnly')).toBe(true)
    expect(isTranscriptOnly('normal')).toBe(false)
  })
})

describe('effectiveDetailViewTypeForMode', () => {
  it('transcriptOnly rendert als session (unabhaengig vom gewaehlten Typ)', () => {
    expect(effectiveDetailViewTypeForMode('transcriptOnly', undefined)).toBe('session')
    expect(effectiveDetailViewTypeForMode('transcriptOnly', 'book')).toBe('session')
  })

  it('normal nutzt den gewaehlten Typ', () => {
    expect(effectiveDetailViewTypeForMode('normal', 'book')).toBe('book')
  })

  it('normal ohne Typ wirft explizit (kein stiller Default)', () => {
    expect(() => effectiveDetailViewTypeForMode('normal', undefined)).toThrow()
    expect(() => effectiveDetailViewTypeForMode('normal', '  ')).toThrow()
  })
})

describe('transcriptComputeFields', () => {
  it('setzt docType=transcript nur im transcriptOnly-Modus', () => {
    expect(transcriptComputeFields('transcriptOnly')).toEqual([{ key: 'docType', rawValue: 'transcript' }])
    expect(transcriptComputeFields('normal')).toEqual([])
  })
})

describe('wizardPublishCopy', () => {
  it('transcriptOnly: Archiv-/Speichern-Wortlaute', () => {
    const c = wizardPublishCopy('transcriptOnly')
    expect(c.stepTitle).toBe('Im Archiv speichern')
    expect(c.prepareMessage).toBe('Vorbereiten…')
    expect(c.finalizeMessage).toBe('Im Archiv speichern…')
    expect(c.ownerSuccessMessage).toBe('Im Archiv gespeichert.')
    expect(c.errorToastTitle).toBe('Speichern fehlgeschlagen')
    expect(c.runningLabel).toBe('Speichern läuft…')
    expect(c.startingLabel).toBe('Speichern wird gestartet…')
  })

  it('normal: Publizieren-Wortlaute (keine running/starting Labels)', () => {
    const c = wizardPublishCopy('normal')
    expect(c.stepTitle).toBe('Publizieren')
    expect(c.prepareMessage).toBe('Im Wartekorb anlegen…')
    expect(c.finalizeMessage).toBe('Veröffentlichen…')
    expect(c.ownerSuccessMessage).toBe('Veröffentlicht.')
    expect(c.errorToastTitle).toBe('Publizieren fehlgeschlagen')
    expect(c.runningLabel).toBeUndefined()
    expect(c.startingLabel).toBeUndefined()
  })

  it('deckt beide Betriebsarten ab', () => {
    const modes: WizardOperatingMode[] = ['normal', 'transcriptOnly']
    for (const m of modes) expect(wizardPublishCopy(m).stepTitle.length).toBeGreaterThan(0)
  })
})
