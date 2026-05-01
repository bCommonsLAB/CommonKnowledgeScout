// @vitest-environment node

/**
 * Characterization Tests fuer Pure-Helpers aus shared/artifact-info-panel.tsx
 * (Welle 3-II-d, Schritt 1 — Sicherheitsnetz vor Helper-Extract).
 *
 * Fixiert das Verhalten der 4 Pure-Helpers:
 * - formatShort (ISO-Datum -> kurze deutsche Anzeige)
 * - sourceBaseName (Dateiname ohne Extension)
 * - buildFileName (Artefakt-Dateiname konstruieren)
 * - artifactKey (eindeutiger React-Key fuer Artefakt)
 */

import { describe, it, expect } from 'vitest'

interface MongoArtifact {
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  updatedAt: string
  createdAt: string
  markdownLength: number
}

// 1:1-Kopie der Pure-Logik aus artifact-info-panel.tsx (Z. 40-64).
function formatShort(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function sourceBaseName(sourceName: string): string {
  const trimmed = sourceName.trim()
  const lastDot = trimmed.lastIndexOf('.')
  return lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed
}
function buildFileName(base: string, artifact: MongoArtifact): string {
  if (artifact.kind === 'transcript') {
    return `${base}.${artifact.targetLanguage}.md`
  }
  return `${base}.${artifact.templateName || 'unknown'}.${artifact.targetLanguage}.md`
}
function artifactKey(a: MongoArtifact): string {
  return `${a.kind}::${a.targetLanguage}::${a.templateName || ''}`
}

describe('formatShort (artifact-info-panel) — Pure-Logik-Vertrag', () => {
  it('liefert "—" fuer undefined/leeren String', () => {
    expect(formatShort(undefined)).toBe('—')
    expect(formatShort('')).toBe('—')
  })

  it('liefert "—" fuer ungueltiges Datum', () => {
    expect(formatShort('not-a-date')).toBe('—')
  })

  it('formatiert ISO-Datum als kurze deutsche Anzeige', () => {
    const result = formatShort('2026-01-15T10:30:00Z')
    expect(result).toMatch(/15\.01\.26/)
  })
})

describe('sourceBaseName (artifact-info-panel) — Pure-Logik-Vertrag', () => {
  it('entfernt die Datei-Extension', () => {
    expect(sourceBaseName('document.pdf')).toBe('document')
    expect(sourceBaseName('audio.mp3')).toBe('audio')
  })

  it('behaelt mehrteilige Basis-Namen', () => {
    expect(sourceBaseName('my.report.draft.pdf')).toBe('my.report.draft')
  })

  it('akzeptiert Namen ohne Extension', () => {
    expect(sourceBaseName('README')).toBe('README')
  })

  it('behaelt fuehrenden Punkt (Hidden-File-Pattern)', () => {
    expect(sourceBaseName('.gitignore')).toBe('.gitignore')
  })

  it('trimmt Whitespace', () => {
    expect(sourceBaseName('  doc.pdf  ')).toBe('doc')
  })
})

describe('buildFileName (artifact-info-panel) — Pure-Logik-Vertrag', () => {
  const baseArtifact: MongoArtifact = {
    kind: 'transcript',
    targetLanguage: 'de',
    updatedAt: '2026-01-01',
    createdAt: '2026-01-01',
    markdownLength: 100,
  }

  it('Transcript: base.targetLanguage.md', () => {
    expect(buildFileName('audio', { ...baseArtifact, kind: 'transcript', targetLanguage: 'de' })).toBe('audio.de.md')
    expect(buildFileName('audio', { ...baseArtifact, kind: 'transcript', targetLanguage: 'en' })).toBe('audio.en.md')
  })

  it('Transformation: base.template.targetLanguage.md', () => {
    const artifact: MongoArtifact = { ...baseArtifact, kind: 'transformation', templateName: 'Bericht', targetLanguage: 'de' }
    expect(buildFileName('audio', artifact)).toBe('audio.Bericht.de.md')
  })

  it('Transformation ohne templateName: "unknown" als Fallback', () => {
    const artifact: MongoArtifact = { ...baseArtifact, kind: 'transformation', targetLanguage: 'de' }
    expect(buildFileName('audio', artifact)).toBe('audio.unknown.de.md')
  })
})

describe('artifactKey (artifact-info-panel) — Pure-Logik-Vertrag', () => {
  const a: MongoArtifact = {
    kind: 'transformation',
    targetLanguage: 'de',
    templateName: 'Besprechung',
    updatedAt: '2026-01-01',
    createdAt: '2026-01-01',
    markdownLength: 100,
  }

  it('konstruiert den Key aus kind::targetLanguage::templateName', () => {
    expect(artifactKey(a)).toBe('transformation::de::Besprechung')
  })

  it('Transcript ohne templateName endet mit ::', () => {
    expect(artifactKey({ ...a, kind: 'transcript', templateName: undefined })).toBe('transcript::de::')
  })

  it('unterscheidet Sprachen', () => {
    expect(artifactKey({ ...a, targetLanguage: 'en' })).toBe('transformation::en::Besprechung')
  })

  it('unterscheidet Templates', () => {
    expect(artifactKey({ ...a, templateName: 'Vortrag' })).toBe('transformation::de::Vortrag')
  })
})
