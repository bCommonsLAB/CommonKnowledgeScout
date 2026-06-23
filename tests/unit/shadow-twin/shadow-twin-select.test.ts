import { describe, expect, it } from 'vitest'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

describe('shadow-twin-select', () => {
  it('waehlt die neueste Transformation pro Sprache', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transformation: {
          t1: {
            de: { markdown: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          },
          t2: {
            de: { markdown: 'b', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
          },
        },
      },
    }

    const selected = selectShadowTwinArtifact(doc, 'transformation', 'de')
    expect(selected?.templateName).toBe('t2')
    expect(selected?.record.markdown).toBe('b')
  })

  it('liefert Transcript fuer Sprache', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        // Transkript ist sprach-neutral: genau EIN Record pro Quelle (kein Sprach-Key).
        transcript: { markdown: 'transcript', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      },
    }

    const selected = selectShadowTwinArtifact(doc, 'transcript', 'de')
    expect(selected?.record.markdown).toBe('transcript')
  })

  it('liefert null, wenn die angeforderte Sprache fehlt (kein stiller Cross-Sprach-Fallback)', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transformation: {
          'tamera-extract-en': {
            de: { markdown: 'de-only', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          },
        },
      },
    }

    // 'en' angefragt, nur 'de' vorhanden → null statt fremdsprachigem Artefakt.
    expect(selectShadowTwinArtifact(doc, 'transformation', 'en')).toBeNull()
  })

  it('waehlt die angeforderte Sprache, wenn mehrere existieren (nicht die erste verfuegbare)', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transformation: {
          t1: {
            de: { markdown: 'de', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
            en: { markdown: 'en', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          },
        },
      },
    }

    const selected = selectShadowTwinArtifact(doc, 'transformation', 'en')
    expect(selected?.targetLanguage).toBe('en')
    expect(selected?.record.markdown).toBe('en')
  })

  it('ueberspringt Templates ohne die angeforderte Sprache und nimmt ein Template, das sie hat', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transformation: {
          'meeting_analyse-de': {
            de: { markdown: 'de-meeting', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
          },
          'tamera-extract-en': {
            en: { markdown: 'en-extract', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          },
        },
      },
    }

    // 'en' angefragt: das de-only-Template (sogar neuer) wird uebersprungen.
    const selected = selectShadowTwinArtifact(doc, 'transformation', 'en')
    expect(selected?.templateName).toBe('tamera-extract-en')
    expect(selected?.record.markdown).toBe('en-extract')
  })

  it('nimmt unter mehreren Templates derselben Sprache das neueste', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transformation: {
          t1: {
            en: { markdown: 'alt', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          },
          t2: {
            en: { markdown: 'neu', createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z' },
          },
        },
      },
    }

    const selected = selectShadowTwinArtifact(doc, 'transformation', 'en')
    expect(selected?.templateName).toBe('t2')
    expect(selected?.record.markdown).toBe('neu')
  })
})
