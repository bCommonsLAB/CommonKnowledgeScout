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
 * benennt: die Fehler-Markierung eines Menschen (`twin_flagged`), seinen
 * Korrekturauftrag an den Agenten (`korrektur_offen`) und die
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
  /**
   * Elternordner laut MongoDB — die AUFGESCHRIEBENE Herkunft, nicht der
   * Fundort. Genau diese Differenz traegt `quelle_verschwunden` (W12): Wurde
   * dieser Ordner gescannt und die Datei trotzdem nicht gefunden, ist sie
   * weg — und nicht bloss ausserhalb des Scopes.
   */
  parentId: string
  /** Ordner-Id der Quelle (Aggregation im Baum). */
  folderId: string
  /** Library-relativer Pfad der Quelle ('' wenn der Scan sie nicht fand). */
  path: string
  artifacts: TwinArtifactView[]
}

/**
 * Zeitfenster, in dem eine Datei-Aenderung noch dem Kurations-Stempel
 * zugerechnet wird. Der Stempel und der Write passieren in derselben
 * Sekunde; zwei Minuten sind grosszuegig und lassen Uhr-Drift zu.
 */
const KURATIONS_FENSTER_MS = 2 * 60 * 1000

function textOderNull(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() !== '' ? wert : null
}

/**
 * Zeitpunkt, zu dem der INHALT eines Artefakts entstand — nicht der letzte
 * Schreibvorgang.
 *
 * Befund 27.08.2026 („die Tretmuehle"): Verifizieren schreibt das Artefakt
 * (`verified_by`/`verified_at`), also wandert sein `updatedAt` nach vorn.
 * Regeln, die Zeitstempel vergleichen, lasen darin eine INHALTS-Aenderung:
 * jeder Pruef-Klick machte den Bericht veraltet (`bericht_veraltet`, daraus
 * `stand_widerspruch`) und liess die Zusammenfassung ueberholt aussehen
 * (`transformation_stale`) — was zu einer Re-Transformation fuehrte, die
 * genau die eben gesetzte Verifikation wieder ungueltig machte. Eine
 * Schleife, die sich durch Arbeiten nicht schliessen laesst.
 *
 * Dieselbe Unterscheidung galt schon fuer Dateien: BERICHT.md/_INDEX.md sind
 * META ueber den Inhalt und altern den Bericht nicht (`coverage-inputs.ts`).
 * Ein Kurations-Stempel ist genauso Meta.
 *
 * Faellt die letzte Aenderung mit einem Kurations-Stempel zusammen, zaehlt
 * darum `generated_at`. Handkorrekturen am Twin (Cowork korrigiert Transkripte
 * im `_`-Ordner, Zyklus Schritt 3) bleiben Inhalts-Aenderungen — sie tragen
 * keinen Stempel.
 */
export function inhaltsZeitpunkt(artifact: TwinArtifactView): string {
  // Altbestand aus Mongo kann ohne Frontmatter kommen; dann bleibt nur der
  // Write-Zeitpunkt — das fehlende Feld meldet `twin_core_missing`.
  const fm: Record<string, unknown> = artifact.frontmatter ?? {}
  const stempel = textOderNull(fm['verified_at']) ?? textOderNull(fm['flagged_at'])
  if (stempel === null) return artifact.updatedAt

  const abstand = Math.abs(Date.parse(artifact.updatedAt) - Date.parse(stempel))
  if (Number.isNaN(abstand) || abstand > KURATIONS_FENSTER_MS) return artifact.updatedAt

  // Der letzte Write war die Kuration — der Inhalt ist so alt wie seine
  // Erzeugung. Fehlt `generated_at`, bleibt es beim Write-Zeitpunkt; das
  // fehlende Feld meldet `twin_core_missing` als eigener Befund.
  return textOderNull(fm['generated_at']) ?? artifact.updatedAt
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

/** Beschreibt EINEN offenen Korrekturauftrag fuer den Beleg des Befunds. */
function beschreibeAuftrag(artifact: TwinArtifactView): string {
  const fm = artifact.frontmatter
  const auftrag = typeof fm['korrektur_auftrag'] === 'string' ? fm['korrektur_auftrag'].trim() : ''
  const wer = typeof fm['korrektur_von'] === 'string' ? fm['korrektur_von'] : '—'
  const wann = typeof fm['korrektur_at'] === 'string' ? fm['korrektur_at'].slice(0, 10) : '—'
  return `${describeArtifact(artifact)}: ${auftrag} — ${wer}, ${wann}`
}

/** Traegt das Artefakt einen offenen (noch nicht gemeldeten) Auftrag? */
function hatOffenenAuftrag(artifact: TwinArtifactView): boolean {
  const fm = artifact.frontmatter
  const auftrag = typeof fm['korrektur_auftrag'] === 'string' ? fm['korrektur_auftrag'].trim() : ''
  if (auftrag === '') return false
  // Gemeldete Erledigung schliesst den Befund (K4). Ohne diese Bedingung
  // bliebe er nach der Reparatur ewig stehen.
  const erledigt = typeof fm['korrektur_erledigt_at'] === 'string' ? fm['korrektur_erledigt_at'].trim() : ''
  return erledigt === ''
}

/**
 * `korrektur_offen` (K3): Peter hat diktiert, was mit dieser Datei geschehen
 * soll — und anders als bei `twin_flagged` haengt ein ausfuehrbarer Auftrag
 * daran. Deshalb zeigt der Befund auf COWORK, nicht auf ihn zurueck.
 *
 * Wie bei der Markierung zaehlt JEDES Artefakt der Familie, nicht nur das
 * fuehrende: Wer am Transkript beauftragt, meint das Transkript.
 */
export function checkKorrekturOffen(family: TwinFamilyView): CoverageGap | null {
  const beauftragt = family.artifacts.filter(hatOffenenAuftrag)
  if (beauftragt.length === 0) return null
  return createGap({
    ...familyGapBase(family),
    type: 'korrektur_offen',
    message:
      beauftragt.length === 1
        ? 'Korrekturauftrag von Peter — was zu tun ist, steht im Auftragstext'
        : `${beauftragt.length} Korrekturauftraege von Peter an dieser Quelle`,
    detail: beauftragt.map(beschreibeAuftrag).sort((a, b) => a.localeCompare(b)).join(' | '),
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

  // Verglichen wird der INHALTS-Zeitpunkt, nicht der letzte Write: Sonst macht
  // eine Verifikation des Transkripts die Zusammenfassung „ueberholt" und
  // loest eine Re-Transformation aus, die die Verifikation wieder entwertet.
  const transkriptInhalt = inhaltsZeitpunkt(transcript)
  const standardInhalt = inhaltsZeitpunkt(standard)
  const transcriptTime = Date.parse(transkriptInhalt)
  const standardTime = Date.parse(standardInhalt)
  if (Number.isNaN(transcriptTime) || Number.isNaN(standardTime) || transcriptTime <= standardTime) return []
  return [
    createGap({
      ...familyGapBase(family),
      type: 'transformation_stale',
      message: 'Das Transkript wurde nach der Zusammenfassung geaendert — sie gibt es nicht mehr wieder',
      detail: `Transkript ${transkriptInhalt}, Transformation ${standardInhalt}`,
    }),
  ]
}

/** Alle Twin-Regeln fuer EINE Familie. */
export function evaluateTwinRules(family: TwinFamilyView, standardTemplate: string | null): CoverageGap[] {
  const core = checkTwinCoreMissing(family)
  const markiert = checkFlagged(family)
  const beauftragt = checkKorrekturOffen(family)
  return [
    ...(core ? [core] : []),
    ...(markiert ? [markiert] : []),
    ...(beauftragt ? [beauftragt] : []),
    ...checkLeadingVerification(family, standardTemplate),
    ...checkTransformationState(family, standardTemplate),
  ]
}
