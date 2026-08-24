/**
 * @fileoverview Twin-Familien-Summaries fuer den Coverage-Report (Welle 4, F4).
 *
 * @description
 * Bildet die gescannten Twin-Familien auf die Twin-Knoten des Baums ab:
 * fuehrendes Artefakt (Contract §2b, via `selectLeadingArtifact` — keine
 * zweite Auswahllogik) plus Kurationszustand (`twin_status`, Vertrauensampel
 * nach der temporalen Regel §3.2). Die UI rechnet nichts nach; die
 * Verify-Aktion adressiert das fuehrende Artefakt EXAKT ueber diese Daten.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import {
  actorLevel,
  isVerificationValid,
  selectLeadingArtifact,
} from '@/lib/shadow-twin/twin-core-fields'
import type { TwinArtifactView, TwinFamilyView } from './twin-rules'
import type { LeadingArtifactSummary, TwinFamilySummary, VerificationState } from './types'

/**
 * Budget gespeicherter Familien (16-MB-Dokumentgrenze von MongoDB, analog
 * `MAX_STORED_GAPS`). Wird gekappt, sagt es der Report AUSDRUECKLICH
 * (`familiesTruncated`) — kein stilles Abschneiden.
 */
export const MAX_FAMILY_SUMMARIES = 5000

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Vertrauensampel des fuehrenden Artefakts (F1, Contract §3.2). */
export function verificationStateOf(frontmatter: Record<string, unknown>): VerificationState {
  const verifiedBy = stringOrNull(frontmatter['verified_by'])
  if (verifiedBy === null) return 'unverifiziert'
  if (!isVerificationValid({ generatedAt: frontmatter['generated_at'], verifiedAt: frontmatter['verified_at'] })) {
    return 'ungueltig'
  }
  return actorLevel(verifiedBy)?.startsWith('human:') ? 'mensch' : 'maschinell'
}

function toLeadingSummary(artifact: TwinArtifactView): LeadingArtifactSummary {
  const fm = artifact.frontmatter
  return {
    kind: artifact.kind === 'transformation' ? 'transformation' : 'transcript',
    templateName: artifact.templateName ?? null,
    targetLanguage: artifact.targetLanguage,
    twinStatus: stringOrNull(fm['twin_status']),
    generatedBy: stringOrNull(fm['generated_by']),
    generatedAt: stringOrNull(fm['generated_at']),
    verifiedBy: stringOrNull(fm['verified_by']),
    verifiedAt: stringOrNull(fm['verified_at']),
    verification: verificationStateOf(fm),
  }
}

export interface BuildFamilySummariesResult {
  families: TwinFamilySummary[]
  truncated: boolean
}

/**
 * Baut die Familien-Summaries des Reports: stabil nach Pfad sortiert und am
 * Budget gekappt ({@link MAX_FAMILY_SUMMARIES}).
 */
export function buildFamilySummaries(args: {
  families: readonly TwinFamilyView[]
  standardTemplate: string | null
}): BuildFamilySummariesResult {
  const summaries = args.families
    .map((family): TwinFamilySummary => {
      const leading = selectLeadingArtifact(family.artifacts, args.standardTemplate)
      // A2: beide pruefbaren Artefakte einzeln — der Baum und die Detail-Tabs
      // tragen je ein eigenes Haekchen (Entscheidung 4, 24.08.2026). Die
      // „Zusammenfassung" ist EXAKT die Standard-Transformation; ohne
      // konfiguriertes Standard-Template bleibt sie null (kein Raten).
      const transkript = family.artifacts.find((artifact) => artifact.kind === 'transcript') ?? null
      const standardTemplate = args.standardTemplate
      const zusammenfassung =
        standardTemplate === null
          ? null
          : family.artifacts.find(
              (artifact) => artifact.kind === 'transformation' && artifact.templateName === standardTemplate,
            ) ?? null
      return {
        sourceId: family.sourceId,
        sourceName: family.sourceName,
        folderId: family.folderId,
        path: family.path || family.sourceName,
        artifactCount: family.artifacts.length,
        leading: leading ? toLeadingSummary(leading) : null,
        transkript: transkript ? toLeadingSummary(transkript) : null,
        zusammenfassung: zusammenfassung ? toLeadingSummary(zusammenfassung) : null,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))

  const truncated = summaries.length > MAX_FAMILY_SUMMARIES
  return {
    families: truncated ? summaries.slice(0, MAX_FAMILY_SUMMARIES) : summaries,
    truncated,
  }
}
