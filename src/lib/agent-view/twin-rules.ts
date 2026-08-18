/**
 * @fileoverview Twin-Kern- und Verifikations-Regeln der Agentensicht.
 *
 * @description
 * KEINE zweite Felddefinition: Pflichtfelder, temporale Verifikationsregel und
 * die Wahl des fuehrenden Artefakts kommen unveraendert aus
 * `@/lib/shadow-twin/twin-core-fields` (Contract §2b/§3). Diese Datei
 * uebersetzt deren Ergebnisse nur in Befunde.
 *
 * Ampel und Verifikation haengen am FUEHRENDEN Artefakt — ein unverifiziertes
 * Transkript neben geprueffter Transformation ist Normalzustand, kein Befund.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import {
  isVerificationValid,
  missingTwinCoreFields,
  selectLeadingArtifact,
} from '@/lib/shadow-twin/twin-core-fields'
import { createGap } from './gap-registry'
import type { CoverageGap } from './types'

/** Ein Artefakt der Twin-Familie, wie die Agentensicht es braucht. */
export interface TwinArtifactView {
  kind: ArtifactKind
  templateName?: string
  targetLanguage: string
  /** Flaches Frontmatter des Artefakts (Mongo-Record bzw. Spiegel). */
  frontmatter: Record<string, unknown>
  /** Letzte Aenderung des Artefakts (ISO). */
  updatedAt: string
}

/** Eine Twin-Familie: Quelle + ihre erzeugten Artefakte (Contract §2). */
export interface TwinFamilyView {
  sourceId: string
  sourceName: string
  /** Ordner-Id der Quelle (Aggregation im Baum). */
  folderId: string
  /** Library-relativer Pfad der Quelle ('' wenn der Scan sie nicht fand). */
  path: string
  artifacts: TwinArtifactView[]
}

/**
 * Actor-Ebene einer OKF-Actor-Angabe: `knowledgescout/gemini-2.5-pro` →
 * `knowledgescout`, `human:peter` → `human:peter`. Die Invariante
 * „niemand verifiziert die eigene Generierung" gilt auf DIESER Ebene
 * (Contract §3.2).
 */
export function actorLevel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  return trimmed.split('/')[0].trim().toLowerCase()
}

function familyGapBase(family: TwinFamilyView) {
  return {
    scope: 'source' as const,
    targetId: family.sourceId,
    targetName: family.sourceName,
    folderId: family.folderId,
    path: family.path || family.sourceName,
  }
}

function describeArtifact(artifact: TwinArtifactView): string {
  if (artifact.kind === 'transformation') {
    return `${artifact.templateName ?? '(ohne Template)'}.${artifact.targetLanguage || '?'}`
  }
  return artifact.kind
}

/** `twin_core_missing`: Pflichtfelder des Twin-Kerns fehlen (Contract §3.1). */
export function checkTwinCoreMissing(family: TwinFamilyView): CoverageGap | null {
  const details: string[] = []
  for (const artifact of family.artifacts) {
    const missing = missingTwinCoreFields(artifact.frontmatter, artifact.kind)
    if (missing.length > 0) details.push(`${describeArtifact(artifact)}: ${missing.join(', ')}`)
  }
  if (details.length === 0) return null
  return createGap({
    ...familyGapBase(family),
    type: 'twin_core_missing',
    message: `Twin-Kern unvollstaendig (${details.length} Artefakt(e))`,
    detail: details.sort((a, b) => a.localeCompare(b)).join(' | '),
  })
}

/** `twin_unverified` + `self_verified` am fuehrenden Artefakt. */
export function checkLeadingVerification(
  family: TwinFamilyView,
  standardTemplate: string | null,
): CoverageGap[] {
  const leading = selectLeadingArtifact(family.artifacts, standardTemplate)
  if (!leading) return []
  const fm = leading.frontmatter
  const generatedBy = actorLevel(fm['generated_by'])
  if (generatedBy === null) return []

  const verifiedBy = actorLevel(fm['verified_by'])
  const gaps: CoverageGap[] = []

  if (verifiedBy !== null && verifiedBy === generatedBy) {
    gaps.push(
      createGap({
        ...familyGapBase(family),
        type: 'self_verified',
        message: 'Erzeuger und Pruefer sind derselbe Akteur',
        detail: `${describeArtifact(leading)}: generated_by/verified_by = ${generatedBy}`,
      }),
    )
    return gaps
  }

  const valid =
    verifiedBy !== null &&
    isVerificationValid({ generatedAt: fm['generated_at'], verifiedAt: fm['verified_at'] })
  if (!valid) {
    gaps.push(
      createGap({
        ...familyGapBase(family),
        type: 'twin_unverified',
        message: 'Fuehrendes Artefakt ist nicht (mehr) gueltig verifiziert',
        detail:
          verifiedBy === null
            ? `${describeArtifact(leading)}: kein verified_by`
            : `${describeArtifact(leading)}: verified_at ${String(fm['verified_at'] ?? '—')} < generated_at ${String(fm['generated_at'] ?? '—')}`,
      }),
    )
  }
  return gaps
}

/** `transformation_missing`/`transformation_stale` (Contract §2b). */
export function checkTransformationState(
  family: TwinFamilyView,
  standardTemplate: string | null,
): CoverageGap[] {
  if (standardTemplate === null || standardTemplate.trim() === '') return []
  const transcript = family.artifacts.find((artifact) => artifact.kind === 'transcript')
  if (!transcript) return []

  const standard = family.artifacts.find(
    (artifact) => artifact.kind === 'transformation' && artifact.templateName === standardTemplate,
  )
  if (!standard) {
    return [
      createGap({
        ...familyGapBase(family),
        type: 'transformation_missing',
        message: `Transformation nach Standard-Template „${standardTemplate}" fehlt`,
        detail: `vorhandene Artefakte: ${family.artifacts.map(describeArtifact).sort((a, b) => a.localeCompare(b)).join(', ')}`,
      }),
    ]
  }

  const transcriptTime = Date.parse(transcript.updatedAt)
  const standardTime = Date.parse(standard.updatedAt)
  if (Number.isNaN(transcriptTime) || Number.isNaN(standardTime) || transcriptTime <= standardTime) return []
  return [
    createGap({
      ...familyGapBase(family),
      type: 'transformation_stale',
      message: 'Transkript ist juenger als die Transformation',
      detail: `Transkript ${transcript.updatedAt}, Transformation ${standard.updatedAt}`,
    }),
  ]
}

/** Alle Twin-Regeln fuer EINE Familie. */
export function evaluateTwinRules(family: TwinFamilyView, standardTemplate: string | null): CoverageGap[] {
  const core = checkTwinCoreMissing(family)
  return [
    ...(core ? [core] : []),
    ...checkLeadingVerification(family, standardTemplate),
    ...checkTransformationState(family, standardTemplate),
  ]
}
