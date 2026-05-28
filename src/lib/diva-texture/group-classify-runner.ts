/**
 * @fileoverview Orchestrator fuer die Stoffgruppen-Propagation (Stufe 4).
 *
 * @description
 * Vereinfachtes Modell (User-Entscheid 2026-05-28): die Galerie macht
 * KEINEN LLM-Call. Pass 1 laeuft pro Material via Archiv-Pipeline; diese
 * Funktion liest die VORHANDENE Klassifikation eines Repraesentativen aus
 * MongoDB und propagiert sie per Frontmatter-Patch auf alle nicht
 * gelockten / nicht verworfenen Mitglieder der Stoffgruppe.
 *
 * Architekturregel (Lea-Regel #10): jeder LLM-Call laeuft ueber
 * `/api/external/jobs/*` — die Galerie ist eine reine Verifikations-/
 * Korrektur-UI. Korrekturen werden in das Shadow-Twin-Artefakt
 * zurueckgeschrieben (Markdown + parsed Frontmatter), damit ein
 * spaeterer Korrektur-Lauf (Stufe 5) sie als CONTEXT sieht.
 */

import type { Library } from '@/types/library'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { findDocs, setDocPass1Classification } from '@/lib/repositories/vector-repo'
import {
  getShadowTwinsBySourceIds,
  updateShadowTwinArtifactMarkdown,
} from '@/lib/repositories/shadow-twin-repo'
import {
  applyClassificationToMember,
  pickRepresentative,
  shouldSkipMember,
  type GroupMember,
  type Pass1Classification,
} from './group-classify'
import { FileLogger } from '@/lib/debug/logger'

/** Eingaben fuer den Propagations-Lauf. */
export interface GroupClassifyRunArgs {
  library: Library
  /** Mongo-Collection-Key der Library. */
  libraryKey: string
  libraryId: string
  userEmail: string
  groupName: string
  /** Sprache der Artefakte (z.B. "de"). */
  targetLanguage: string
  /** Template-Name der DIVA-Texture-Transformation (z.B. "Diva-Texture-Analysis"). */
  templateName: string
  /**
   * Wenn `true`: nichts schreiben, nur den Vorschlag (Repraesentativ +
   * Klassifikation + Mitglieder-Statistik) zurueckgeben — fuer den
   * Galerie-Dialog "Preview".
   */
  dryRun?: boolean
}

/** Ergebnis eines Propagations-Laufs. */
export interface GroupClassifyRunResult {
  groupName: string
  representative: {
    fileId: string
    sourceFileName: string
    /**
     * Welches Quellbild der ursprueglichen Pass-1-Analyse zugrunde lag —
     * informativ. Wert kommt aus dem Archiv-Property-Store oder dem
     * urspruenglichen Pipeline-Lauf. Default `basecolor`, wenn nicht
     * ermittelbar.
     */
    sourceImage: 'basecolor' | 'supplier-preview'
  }
  classification: Pass1Classification
  members: {
    total: number
    /** Mitglieder, deren Frontmatter erfolgreich gepatcht wurde. */
    applied: string[]
    /**
     * Mitglieder, bei denen `material_class` sich durch die Propagation
     * geaendert hat → `needs_visual_refresh=true` gesetzt.
     */
    markedForRefresh: string[]
    skippedLocked: string[]
    skippedRejected: string[]
    /**
     * Mitglieder ohne Shadow-Twin-Artefakt fuer das gewaehlte Template/
     * Sprache. Sie sind nicht propagierbar — Hinweis fuer den User
     * "bitte Pass-1 im Archiv ausfuehren".
     */
    skippedNoArtifact: string[]
  }
  dryRun: boolean
}

/** Hilft beim Sammeln der Frontmatter-Werte eines Mitglieds aus dem vector-repo. */
interface MemberSnapshot {
  fileId: string
  sourceFileName: string
  materialClass: string
  materialType: string
  confidenceClass: number
  confidenceType: number | ''
  needsHumanReview: boolean
  classificationLocked: boolean
  classificationRejected: boolean
}

function toMember(snapshot: MemberSnapshot): GroupMember {
  return {
    fileId: snapshot.fileId,
    sourceFileName: snapshot.sourceFileName,
    classificationLocked: snapshot.classificationLocked,
    classificationRejected: snapshot.classificationRejected,
    sourceImageChoice: null,
  }
}

/**
 * Liest die Klassifikation des Repraesentativen aus dessen Frontmatter-
 * Snapshot. Gibt `null` zurueck, wenn die Pflichtfelder fehlen (z.B. weil
 * der Repraesentativ noch nie Pass 1 im Archiv durchlaufen hat).
 */
function classificationFromSnapshot(rep: MemberSnapshot): Pass1Classification | null {
  if (!rep.materialClass) return null
  if (!Number.isFinite(rep.confidenceClass) || rep.confidenceClass <= 0) return null
  return {
    material_class: rep.materialClass,
    material_type: rep.materialType,
    confidence_class: rep.confidenceClass,
    confidence_type: rep.confidenceType,
    needs_human_review: rep.needsHumanReview,
  }
}

/**
 * Fuehrt die Stoffgruppen-Propagation aus — OHNE LLM-Call.
 *
 * Schritte:
 *  1. Mitglieder via vector-repo holen (`docMetaJson.group_name`-Filter).
 *  2. Repraesentativen waehlen (erstes nicht gelocktes/nicht verworfenes
 *     Mitglied mit gueltiger Pass-1-Klassifikation).
 *  3. Klassifikation aus dem Repraesentativ-Snapshot extrahieren.
 *  4. Bei `dryRun=true` ohne Schreibvorgang zurueckkehren.
 *  5. Sonst pro Mitglied (inkl. Repraesentativ) das Shadow-Twin-Artefakt
 *     patchen und das `docMetaJson` im vector-repo aktualisieren. Wenn die
 *     `material_class` des Mitglieds sich aendert, wird zusaetzlich
 *     `needs_visual_refresh=true` ins Artefakt geschrieben.
 */
export async function runGroupClassification(
  args: GroupClassifyRunArgs,
): Promise<GroupClassifyRunResult> {
  const {
    library,
    libraryKey,
    libraryId,
    userEmail,
    groupName,
    targetLanguage,
    templateName,
  } = args

  // 1. Mitglieder + ihre Snapshots laden
  const groupQuery = { 'docMetaJson.group_name': groupName }
  const { items: docs } = await findDocs(libraryKey, libraryId, groupQuery, {
    userEmail,
    limit: 500,
  })
  if (docs.length === 0) {
    throw new Error(`Stoffgruppe "${groupName}" enthaelt keine Materialien`)
  }

  const snapshots: MemberSnapshot[] = []
  for (const doc of docs) {
    const fileId = doc.fileId
    const sourceFileName = doc.sourceFileName
    if (typeof fileId !== 'string' || typeof sourceFileName !== 'string') continue
    const confidenceType: number | '' =
      typeof doc.confidence_type === 'number' ? doc.confidence_type : ''
    snapshots.push({
      fileId,
      sourceFileName,
      materialClass: doc.material_class ?? '',
      materialType: doc.material_type ?? '',
      confidenceClass: typeof doc.confidence_class === 'number' ? doc.confidence_class : 0,
      confidenceType,
      needsHumanReview: false,
      classificationLocked: doc.classification_locked === true,
      classificationRejected: doc.classification_rejected === true,
    })
  }

  // 2. Repraesentativen waehlen — nur unter Mitgliedern mit gueltiger Klassifikation
  const classifiable = snapshots.filter((s) => classificationFromSnapshot(s) !== null)
  const members = snapshots.map(toMember)
  const candidates = classifiable.map(toMember)
  const representativeMember = pickRepresentative(candidates)
  if (!representativeMember) {
    throw new Error(
      `Stoffgruppe "${groupName}": kein klassifizierter Repraesentant gefunden. ` +
        `Bitte zuerst Pass 1 fuer mindestens ein Mitglied im Archiv ausfuehren.`,
    )
  }
  const repSnapshot = classifiable.find((s) => s.fileId === representativeMember.fileId)!
  const classification = classificationFromSnapshot(repSnapshot)!

  // 3. Shadow-Twin-Lookup vorbereiten (fuer das Patchen der Artefakte)
  const sourceIds = snapshots.map((s) => s.fileId)
  const shadowTwinMap = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

  // 4. Dry-Run: Vorschau ohne Schreibvorgang
  if (args.dryRun === true) {
    return {
      groupName,
      representative: {
        fileId: repSnapshot.fileId,
        sourceFileName: repSnapshot.sourceFileName,
        sourceImage: 'basecolor',
      },
      classification,
      members: {
        total: members.length,
        applied: [],
        markedForRefresh: [],
        skippedLocked: members
          .filter((m) => shouldSkipMember(m).reason === 'locked')
          .map((m) => m.fileId),
        skippedRejected: members
          .filter((m) => shouldSkipMember(m).reason === 'rejected')
          .map((m) => m.fileId),
        skippedNoArtifact: [],
      },
      dryRun: true,
    }
  }

  // 5. Bulk-Apply
  const applied: string[] = []
  const markedForRefresh: string[] = []
  const skippedLocked: string[] = []
  const skippedRejected: string[] = []
  const skippedNoArtifact: string[] = []

  for (const snapshot of snapshots) {
    const member = toMember(snapshot)
    const skip = shouldSkipMember(member)
    if (skip.skip) {
      if (skip.reason === 'locked') skippedLocked.push(member.fileId)
      else if (skip.reason === 'rejected') skippedRejected.push(member.fileId)
      continue
    }
    const twin = shadowTwinMap.get(member.fileId)
    if (!twin) {
      skippedNoArtifact.push(member.fileId)
      continue
    }
    const artifact = twin.artifacts?.transformation?.[templateName]?.[targetLanguage] ?? null
    if (!artifact || typeof artifact.markdown !== 'string' || artifact.markdown.trim() === '') {
      skippedNoArtifact.push(member.fileId)
      continue
    }

    const classChanged = snapshot.materialClass !== classification.material_class
    const patchedMarkdown = applyClassificationToMember(artifact.markdown, classification, {
      markVisualRefresh: classChanged,
    })

    const artifactKey: ArtifactKey = {
      sourceId: twin.sourceId,
      kind: 'transformation',
      targetLanguage,
      templateName,
    }
    await updateShadowTwinArtifactMarkdown({
      libraryId,
      sourceId: twin.sourceId,
      artifactKey,
      markdown: patchedMarkdown,
    })
    await setDocPass1Classification(libraryKey, member.fileId, {
      material_class: classification.material_class,
      material_type: classification.material_type,
      confidence_class: classification.confidence_class,
      confidence_type: classification.confidence_type,
      needs_human_review: classification.needs_human_review,
      last_pass: 1,
      pass1_status: classification.needs_human_review ? 'needs_review' : 'done',
      needs_visual_refresh: classChanged ? true : undefined,
    })
    applied.push(member.fileId)
    if (classChanged) markedForRefresh.push(member.fileId)
  }

  FileLogger.info('diva-texture/group-classify', 'Stoffgruppen-Propagation abgeschlossen', {
    groupName,
    representativeFileId: repSnapshot.fileId,
    appliedCount: applied.length,
    refreshCount: markedForRefresh.length,
    lockedCount: skippedLocked.length,
    rejectedCount: skippedRejected.length,
    noArtifactCount: skippedNoArtifact.length,
    libraryLabel: library.label,
  })

  return {
    groupName,
    representative: {
      fileId: repSnapshot.fileId,
      sourceFileName: repSnapshot.sourceFileName,
      sourceImage: 'basecolor',
    },
    classification,
    members: {
      total: members.length,
      applied,
      markedForRefresh,
      skippedLocked,
      skippedRejected,
      skippedNoArtifact,
    },
    dryRun: false,
  }
}
