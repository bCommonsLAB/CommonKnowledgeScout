/**
 * @fileoverview Twin-Kern- und Verifikations-Regeln der Agentensicht.
 *
 * @description
 * KEINE zweite Felddefinition: Pflichtfelder, temporale Verifikationsregel und
 * die Wahl des fuehrenden Artefakts kommen unveraendert aus
 * `@/lib/shadow-twin/twin-core-fields` (Contract §2b/§3). Diese Datei
 * uebersetzt deren Ergebnisse nur in Befunde.
 *
 * ADR 0006 (Modell B): Fehlende menschliche Pruefung ist KEIN Befund mehr —
 * Maschinenarbeit gilt als angenommen. Befund ist nur, was jemand als falsch
 * benennt: die Fehler-Markierung eines Menschen (`twin_flagged`) und die
 * Selbst-Verifikation der Maschine (`self_verified`).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import {
  actorLevel,
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
    message: `In ${details.length} Auswertung(en) fehlen Pflichtangaben`,
    detail: details.sort((a, b) => a.localeCompare(b)).join(' | '),
  })
}

/**
 * `self_verified` am fuehrenden Artefakt (Contract §3.2): Erzeuger und Pruefer
 * sind dieselbe Maschine. Das bleibt ein Befund — es behauptet eine Pruefung,
 * die niemand vorgenommen hat.
 *
 * Kein `twin_unverified` mehr (ADR 0006): Eine fehlende menschliche Pruefung
 * ist der Normalzustand, keine Schuld.
 */
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
  if (verifiedBy === null || verifiedBy !== generatedBy) return []

  return [
    createGap({
      ...familyGapBase(family),
      type: 'self_verified',
      message: 'Erzeugt und geprueft von derselben Maschine — eine menschliche Pruefung fehlt',
      detail: `Die Zusammenfassung (${describeArtifact(leading)}) wurde von ${generatedBy} erzeugt UND von ${generatedBy} bestaetigt.`,
    }),
  ]
}

/** Beschreibt EINE Fehler-Markierung fuer den Beleg des Befunds. */
function beschreibeMarkierung(artifact: TwinArtifactView): string {
  const fm = artifact.frontmatter
  const notiz = typeof fm['flagged_note'] === 'string' ? fm['flagged_note'].trim() : ''
  const wer = typeof fm['flagged_by'] === 'string' ? fm['flagged_by'] : '—'
  const wann = typeof fm['flagged_at'] === 'string' ? fm['flagged_at'].slice(0, 10) : '—'
  // Fehlende Notiz wird BENANNT, nicht ergaenzt: Altbestand kann sie nicht
  // haben, der Schreibweg erzwingt sie (no-silent-fallbacks).
  return `${describeArtifact(artifact)}: ${notiz === '' ? '(ohne Notiz)' : notiz} — ${wer}, ${wann}`
}

/**
 * `twin_flagged` (ADR 0006): Ein Mensch hat ein Artefakt der Familie als
 * fehlerhaft markiert (`twin_status: flagged`). Das ist der einzige
 * menschliche Widerstand, den die Sicht kennt — er sperrt die Abnahme, bis
 * er aufgeloest ist (Reparatur + Verifizieren).
 *
 * Anders als die Verifikations-Regeln zaehlt hier JEDES Artefakt der Familie,
 * nicht nur das fuehrende: Wer ein Transkript als falsch markiert, meint das
 * Transkript.
 */
export function checkFlagged(family: TwinFamilyView): CoverageGap | null {
  const markiert = family.artifacts.filter((artifact) => artifact.frontmatter['twin_status'] === 'flagged')
  if (markiert.length === 0) return null
  return createGap({
    ...familyGapBase(family),
    type: 'twin_flagged',
    message:
      markiert.length === 1
        ? 'Von dir als fehlerhaft markiert — die Abnahme bleibt gesperrt, bis das geklaert ist'
        : `${markiert.length} Artefakte von dir als fehlerhaft markiert — die Abnahme bleibt gesperrt`,
    detail: markiert.map(beschreibeMarkierung).sort((a, b) => a.localeCompare(b)).join(' | '),
  })
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
        message: `Aus dieser Datei wurde noch keine Zusammenfassung erzeugt (Vorlage „${standardTemplate}")`,
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
      message: 'Das Transkript wurde nach der Zusammenfassung geaendert — sie gibt es nicht mehr wieder',
      detail: `Transkript ${transcript.updatedAt}, Transformation ${standard.updatedAt}`,
    }),
  ]
}

/** Alle Twin-Regeln fuer EINE Familie. */
export function evaluateTwinRules(family: TwinFamilyView, standardTemplate: string | null): CoverageGap[] {
  const core = checkTwinCoreMissing(family)
  const markiert = checkFlagged(family)
  return [
    ...(core ? [core] : []),
    ...(markiert ? [markiert] : []),
    ...checkLeadingVerification(family, standardTemplate),
    ...checkTransformationState(family, standardTemplate),
  ]
}
