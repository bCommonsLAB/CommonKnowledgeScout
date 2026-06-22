/**
 * @fileoverview Unit-Tests: sprach-neutrales Transkript-Modell
 *
 * Ein Transkript ist die Originalsprache des Dokuments (rohes OCR/Extraktion) und damit
 * sprach-neutral: genau EIN Record pro Quelle. Die Zielsprache betrifft nur die AUSGABE
 * der Transformation, nicht die EINGABE (Transkript).
 *
 * Der sprach-tolerante Transkript-Fallback im Loader
 * (`loadShadowTwinMarkdown('forTemplateTransformation')`) delegiert die eigentliche
 * Auflösung an `getMarkdown -> getShadowTwinArtifact -> pickArtifact -> readTranscriptRecord`.
 * Daher testen wir die drei geforderten Szenarien an dieser Implementierungs-Naht
 * (robust, ohne den gesamten Loader-Abhängigkeitsgraphen zu mocken):
 *   - "en vorhanden + de angefragt -> Fallback" (Legacy-Map, nur en)
 *   - "exakter/neutraler Treffer" (Single-Record vorhanden)
 *   - "kein Transkript -> null"
 */

import { describe, it, expect } from 'vitest'
import { readTranscriptRecord, buildArtifactPath } from '@/lib/repositories/shadow-twin-repo'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'

const rec = (markdown: string, updatedAt: string) => ({
  markdown,
  frontmatter: {},
  createdAt: updatedAt,
  updatedAt,
})

describe('readTranscriptRecord — sprach-toleranter Lese-Pfad', () => {
  it('exakter/neutraler Treffer: liefert den sprach-neutralen Single-Record', () => {
    const doc = { artifacts: { transcript: rec('# Original', '2026-01-01T00:00:00Z') } }
    expect(readTranscriptRecord(doc)?.markdown).toBe('# Original')
  })

  it('Sprach-Fallback: nur en-Transkript vorhanden (de angefragt) -> liefert das en-Transkript', () => {
    // Legacy-Form Record<lang, record>: nur 'en'. Der Job würde 'de' anfragen, bekommt aber
    // das einzige vorhandene Transkript ('en') als Transformations-Eingabe.
    const doc = { artifacts: { transcript: { en: rec('# English transcript', '2026-01-01T00:00:00Z') } } }
    expect(readTranscriptRecord(doc)?.markdown).toBe('# English transcript')
  })

  it('Legacy-Map mit mehreren Sprachen: neuestes (updatedAt) gewinnt deterministisch', () => {
    const doc = {
      artifacts: {
        transcript: {
          en: rec('# alt en', '2026-01-01T00:00:00Z'),
          de: rec('# neu de', '2026-02-01T00:00:00Z'),
        },
      },
    }
    expect(readTranscriptRecord(doc)?.markdown).toBe('# neu de')
  })

  it('kein Transkript vorhanden -> null', () => {
    expect(readTranscriptRecord({ artifacts: {} })).toBeNull()
    expect(readTranscriptRecord({ artifacts: { transcript: {} } })).toBeNull()
    expect(readTranscriptRecord(null)).toBeNull()
    expect(readTranscriptRecord(undefined)).toBeNull()
  })
})

describe('Pfad- und Namens-Modell — Transkript ist sprach-neutral', () => {
  it('buildArtifactPath: transcript ist unabhängig von targetLanguage', () => {
    expect(buildArtifactPath({ sourceId: 's', kind: 'transcript', targetLanguage: 'de' })).toBe('artifacts.transcript')
    expect(buildArtifactPath({ sourceId: 's', kind: 'transcript', targetLanguage: 'en' })).toBe('artifacts.transcript')
  })

  it('buildArtifactPath: transformation bleibt sprach-spezifisch', () => {
    expect(
      buildArtifactPath({ sourceId: 's', kind: 'transformation', targetLanguage: 'de', templateName: 'tpl' })
    ).toBe('artifacts.transformation.tpl.de')
  })

  it('buildArtifactName: transcript ist suffixlos (kein Sprach-Suffix)', () => {
    expect(buildArtifactName({ sourceId: 's', kind: 'transcript', targetLanguage: 'de' }, 'Bericht.pdf')).toBe('Bericht.md')
    expect(buildArtifactName({ sourceId: 's', kind: 'transcript', targetLanguage: 'en' }, 'Bericht.pdf')).toBe('Bericht.md')
  })
})
