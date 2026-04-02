import { describe, expect, it } from 'vitest'
import {
  buildDictationDraftFromSources,
  buildPlainDictationBody,
  suggestDictationFileBaseName,
} from '@/lib/creation/builtin-dictation-draft'
import type { WizardSource } from '@/lib/creation/corpus'

describe('builtin-dictation-draft', () => {
  it('baut Body und Titel aus Text-Quelle', () => {
    const sources: WizardSource[] = [
      {
        id: 't1',
        kind: 'text',
        text: 'Mein Titel hier\n\nMehr Text.',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ]
    expect(buildPlainDictationBody(sources)).toContain('Mein Titel hier')
    const draft = buildDictationDraftFromSources(sources)
    expect(draft).not.toBeNull()
    expect(draft?.metadata.title).toBe('Mein Titel hier')
    expect(draft?.markdown).toContain('Mehr Text')
    expect(typeof draft?.metadata.filename).toBe('string')
    expect(String(draft?.metadata.filename)).toMatch(
      /^diktat-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/,
    )
  })

  it('suggestDictationFileBaseName: Datum + Stunde-Minute-Sekunde (ohne Millisekunden)', () => {
    const s = suggestDictationFileBaseName(new Date(2026, 3, 2, 15, 30, 45))
    expect(s).toBe('diktat-2026-04-02-15-30-45')
  })

  it('liefert null bei leeren Quellen', () => {
    expect(buildDictationDraftFromSources([])).toBeNull()
  })
})
