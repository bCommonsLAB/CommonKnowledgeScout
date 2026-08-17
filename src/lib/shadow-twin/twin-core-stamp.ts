/**
 * Writer-Stempel fuer den Twin-Kern (Twin-Datei-Contract §4.1:
 * "Kern setzt der Writer, nicht das LLM").
 *
 * Aufgerufen am Schreib-Engpass der Pipeline (`persistShadowTwinToMongo`),
 * BEVOR das Markdown gespeichert wird — dieselbe gestempelte Fassung geht
 * nach MongoDB UND in den Dateisystem-Spiegel (kein Drift zwischen beiden).
 *
 * Semantik:
 * - `generated_by`/`generated_at` werden bei jedem Generierungsereignis NEU
 *   gesetzt. Re-Generierung = neuer Stempel; eine aeltere Verifikation wird
 *   ueber die temporale Regel (`isVerificationValid`) sichtbar ungueltig,
 *   geloescht wird nichts.
 * - Strukturfelder (`type`, `source_file`, `template`, `language`) werden nur
 *   GEFUELLT, wenn sie fehlen — vorhandene Template-/Extraktor-Werte werden
 *   nie still ueberschrieben; ein Widerspruch bleibt sichtbar und wird spaeter
 *   von der Agentensicht gemeldet (`no-silent-fallbacks`).
 * - Nur `transcript` und `transformation` sind Contract-Twins. `canonical` ist
 *   intern, `raw` ein lossless Backup — beide bleiben byte-identisch.
 * - Kurations-Felder (`twin_status`, `verified_by`, `verified_at`) gehoeren
 *   der Kuration (Contract §3.2) und werden hier NIE gesetzt.
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'

export interface TwinCoreStampContext {
  kind: ArtifactKind
  /** Dateiname der Quelle (fuer `source_file`). */
  sourceFileName: string
  /** Zielsprache der Transformation (fuer `language`; beim Transkript ohne Wirkung). */
  targetLanguage: string
  /** Template-Name — PFLICHT bei `kind: 'transformation'`. */
  templateName?: string
  /** Actor nach OKF-Schreibweise, z. B. `knowledgescout/pipeline`. */
  generatedBy: string
  /** Zeitstempel des Generierungsereignisses (Default: jetzt, ISO-8601). */
  generatedAt?: string
}

const STAMPABLE_KINDS: ReadonlySet<ArtifactKind> = new Set(['transcript', 'transformation'])

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/**
 * Stempelt den Twin-Kern ins Frontmatter eines erzeugten Artefakts.
 * Body und unbekannte Frontmatter-Felder bleiben erhalten (Patch, kein
 * Neuschreiben — Contract §4.2). Fuer nicht stempelbare Arten wird das
 * Markdown unveraendert zurueckgegeben.
 */
export function stampTwinCoreFrontmatter(markdown: string, ctx: TwinCoreStampContext): string {
  if (!STAMPABLE_KINDS.has(ctx.kind)) return markdown

  if (isMissingValue(ctx.generatedBy)) {
    throw new Error('stampTwinCoreFrontmatter: generatedBy ist Pflicht (kein stiller Default)')
  }
  if (ctx.kind === 'transformation' && isMissingValue(ctx.templateName)) {
    throw new Error(
      `stampTwinCoreFrontmatter: templateName ist Pflicht bei Transformationen (source=${ctx.sourceFileName})`
    )
  }

  const { meta } = parseFrontmatter(markdown)

  const updates: Record<string, unknown> = {
    generated_by: ctx.generatedBy,
    generated_at: ctx.generatedAt ?? new Date().toISOString(),
  }
  if (isMissingValue(meta.type)) updates.type = ctx.kind
  if (isMissingValue(meta.source_file)) updates.source_file = ctx.sourceFileName
  if (ctx.kind === 'transformation') {
    if (isMissingValue(meta.template)) updates.template = ctx.templateName
    if (isMissingValue(meta.language)) updates.language = ctx.targetLanguage
  }

  return patchFrontmatter(markdown, updates)
}
