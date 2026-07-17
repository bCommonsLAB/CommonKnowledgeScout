/**
 * shared/artifact-info-panel/helpers.ts
 *
 * Pure-Helper + Types fuer ArtifactInfoPanel.
 *
 * Aus `shared/artifact-info-panel.tsx` ausgegliedert
 * (Welle 3-II-d, Schritt 2/7).
 */

/** UI-seitiges DTO fuer ein MongoDB-Shadow-Twin-Artefakt. */
export interface MongoArtifact {
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  updatedAt: string
  createdAt: string
  markdownLength: number
}

/** Formatiert ISO-Datum als kurze deutsche Anzeige. */
export function formatShort(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Liefert den Datei-Basis-Namen ohne Extension (letzten Punkt). */
export function sourceBaseName(sourceName: string): string {
  const trimmed = sourceName.trim()
  const lastDot = trimmed.lastIndexOf('.')
  return lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed
}

/** Baut den erwarteten Dateinamen fuer ein Artefakt. */
export function buildFileName(base: string, artifact: MongoArtifact): string {
  if (artifact.kind === 'transcript') {
    // Transkript ist sprach-neutral -> kein Sprach-Suffix.
    return `${base}.md`
  }
  return `${base}.${artifact.templateName || 'unknown'}.${artifact.targetLanguage}.md`
}

/** Eindeutiger Key fuer ein Artefakt (fuer React-Key und Delete-Tracking). */
export function artifactKey(a: MongoArtifact): string {
  return `${a.kind}::${a.targetLanguage}::${a.templateName || ''}`
}
