/**
 * @fileoverview Orchestrator fuer die Stoffgruppen-Klassifikation (Stufe 4).
 *
 * @description
 * Vereinfachte Batch-Funktion (User-Entscheid, weicht vom Plan ab):
 *   - KEINE eigene Gruppen-Klassifikations-Persistenz, KEINE groupClassificationId.
 *   - 1 LLM-Call ueber `runDivaTextureFirstPass` auf einem repraesentativen Bild.
 *   - Anschliessend Pass-1-Klassifikation auf alle Mitglieder ins Frontmatter
 *     patchen (Edge-Case #6: `classification_locked`; Edge-Case #17: `classification_rejected`
 *     werden NICHT ueberschrieben).
 *
 * Die Datei kapselt die I/O-Schritte (vector-repo, shadow_twin, Storage, LLM)
 * um die pure Helfer in `group-classify.ts` herum. Storage-Zugriffe gehen
 * ausschliesslich ueber den uebergebenen StorageProvider (storage-abstraction.mdc).
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { findDocs, setDocPass1Classification } from '@/lib/repositories/vector-repo'
import {
  getShadowTwinsBySourceIds,
  updateShadowTwinArtifactMarkdown,
} from '@/lib/repositories/shadow-twin-repo'
import { getArchiveItemProperties } from '@/lib/repositories/archive-item-properties-repo'
import { runDivaTextureFirstPass, type FirstPassImage } from './first-pass-runner'
import { loadSupplierData } from './load-supplier-data'
import { matchTextureCode } from './match-texture-code'
import {
  applyClassificationToMember,
  extractClassification,
  pickRepresentative,
  shouldSkipMember,
  type AnalysisSourceImageChoice,
  type GroupMember,
  type Pass1Classification,
} from './group-classify'
import { FileLogger } from '@/lib/debug/logger'

/** Eingaben fuer den Group-Classify-Run. */
export interface GroupClassifyRunArgs {
  library: Library
  /** Mongo-Collection-Key der Library. */
  libraryKey: string
  libraryId: string
  provider: StorageProvider
  userEmail: string
  groupName: string
  /** Sprache der Artefakte (z.B. "de"). */
  targetLanguage: string
  /** Template-Name der DIVA-Texture-Transformation (z.B. "Diva-Texture-Analysis"). */
  templateName: string
  /** Injizierter LLM-Image-Call (Secretary Service). */
  analyzeImage: (args: { image: FirstPassImage; context: Record<string, unknown> }) => Promise<string>
  /** Liefersystem-Preview serverseitig laden (Stolperfalle #5). */
  fetchPreviewImage?: (url: string) => Promise<FirstPassImage>
  /** Wenn true: nichts schreiben, nur Klassifikation zurueckgeben. */
  dryRun?: boolean
}

/** Ergebnis eines Group-Classify-Runs. */
export interface GroupClassifyRunResult {
  groupName: string
  representative: {
    fileId: string
    sourceFileName: string
    sourceImage: 'basecolor' | 'supplier-preview'
  }
  classification: Pass1Classification
  members: {
    total: number
    applied: string[]
    skippedLocked: string[]
    skippedRejected: string[]
    skippedRepresentativeNotFound: string[]
  }
  dryRun: boolean
}

/** Material-ID-Aufloesung: pro Source-Filename → VCodex (aus dem Sidecar). */
type MaterialIdResolver = (sourceFileName: string) => string | null

/**
 * Baut den Material-ID-Resolver einmal pro Gruppe: laedt den Sidecar im
 * Texturverzeichnis und matcht jeden Mitglieds-Dateinamen gegen den Eintrag,
 * um die VCodex zu bekommen. Ergebnis ist eine kleine in-memory-Map.
 *
 * Hintergrund: Die Mitglieder einer Gruppe teilen sich (typischerweise) das
 * gleiche Sidecar — wir laden es einmal, nicht N-mal.
 */
async function buildMaterialIdResolver(
  provider: StorageProvider,
  parentId: string,
): Promise<MaterialIdResolver> {
  const supplier = await loadSupplierData(provider, parentId)
  if (!supplier) return () => null
  return (sourceFileName: string) => {
    const result = matchTextureCode(sourceFileName, supplier.entries)
    return result.match?.entry.VCodex ?? null
  }
}

/**
 * Liest die Quellbild-Wahl eines Materials aus dem Archiv-Property-Store
 * (analysisSourceImage). Liefert null, wenn der Lookup-Key oder das Property
 * fehlt — kein silent fallback auf "basecolor", damit das Logging
 * (siehe Plan Edge-Case #13) zwischen "kein Eintrag" und "basecolor explizit"
 * unterscheiden kann.
 */
async function readSourceImageChoice(
  libraryId: string,
  materialId: string | null,
): Promise<AnalysisSourceImageChoice> {
  if (materialId === null) return null
  const props = await getArchiveItemProperties(libraryId, materialId)
  const choice = props.analysisSourceImage
  if (choice === 'basecolor' || choice === 'supplier-preview') return choice
  return null
}

/** Konvertiert ein DocCardMeta-aehnliches Objekt in einen GroupMember. */
function toGroupMember(
  fileId: string,
  sourceFileName: string,
  classificationLocked: boolean | undefined,
  classificationRejected: boolean | undefined,
  sourceImageChoice: AnalysisSourceImageChoice,
): GroupMember {
  return { fileId, sourceFileName, classificationLocked, classificationRejected, sourceImageChoice }
}

/**
 * Fuehrt die Stoffgruppen-Klassifikation aus.
 *
 * Schritte:
 *  1. Mitglieder der Stoffgruppe aus dem vector-repo laden.
 *  2. Pro Mitglied die Quellbild-Wahl bestimmen (Sidecar-Lookup einmal pro Gruppe).
 *  3. Repraesentatives Mitglied waehlen (Plan Phase C; siehe `pickRepresentative`).
 *  4. Source-Image des Repraesentativen laden (StorageProvider.getBinary).
 *  5. `runDivaTextureFirstPass` ausfuehren — liefert Markdown mit Pass-1-Feldern.
 *  6. Klassifikation extrahieren; bei dryRun an dieser Stelle abbrechen.
 *  7. Pro Mitglied (inkl. Repraesentativ), das weder gelockt noch verworfen ist:
 *     - shadow_twin-Artefakt-Markdown patchen,
 *     - docMetaJson im vector-repo aktualisieren.
 */
export async function runGroupClassification(
  args: GroupClassifyRunArgs,
): Promise<GroupClassifyRunResult> {
  const {
    library,
    libraryKey,
    libraryId,
    provider,
    userEmail,
    groupName,
    targetLanguage,
    templateName,
    analyzeImage,
    fetchPreviewImage,
  } = args

  // 1. Mitglieder laden
  const groupQuery = { 'docMetaJson.group_name': groupName }
  const { items: docs } = await findDocs(libraryKey, libraryId, groupQuery, {
    userEmail,
    limit: 500,
  })
  if (docs.length === 0) {
    throw new Error(`Stoffgruppe "${groupName}" enthaelt keine Materialien`)
  }

  // 2. Shadow-Twin-Lookup vorbereiten (parentId + sourceName + parsed Artefakt-Key)
  // Der fileId in vector-repo IS the source image id (job.correlation.source.itemId),
  // siehe phase-ingest.ts. Wir nutzen denselben sourceId fuer shadow_twin-Lookups.
  const sourceIds = docs.map((d) => d.fileId).filter((id): id is string => typeof id === 'string')
  const shadowTwinMap = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

  // 3. Material-ID-Resolver einmal pro Gruppe aufbauen — siehe buildMaterialIdResolver.
  const firstTwin = sourceIds.map((id) => shadowTwinMap.get(id)).find((t) => t && t.parentId)
  if (!firstTwin) {
    throw new Error(`Stoffgruppe "${groupName}": kein Shadow-Twin mit parentId gefunden`)
  }
  const groupParentId = firstTwin.parentId
  const resolveMaterialId = await buildMaterialIdResolver(provider, groupParentId)

  // 4. Quellbild-Wahl pro Mitglied resolven
  const members: GroupMember[] = []
  for (const doc of docs) {
    const fileId = doc.fileId
    const sourceFileName = doc.sourceFileName
    if (typeof fileId !== 'string' || typeof sourceFileName !== 'string') continue
    const materialId = resolveMaterialId(sourceFileName)
    const choice = await readSourceImageChoice(libraryId, materialId)
    members.push(
      toGroupMember(
        fileId,
        sourceFileName,
        doc.classification_locked,
        doc.classification_rejected,
        choice,
      ),
    )
  }

  // 5. Repraesentativ waehlen
  const representative = pickRepresentative(members)
  if (!representative) {
    throw new Error(
      `Stoffgruppe "${groupName}": alle Mitglieder sind gelockt oder verworfen — keine Klassifikation moeglich`,
    )
  }

  // 6. Source-Image des Repraesentativen laden
  const sourceItem = await provider.getItemById(representative.fileId)
  const sourcePath = await (async () => {
    try {
      return await provider.getPathById(representative.fileId)
    } catch {
      return ''
    }
  })()
  const { blob } = await provider.getBinary(representative.fileId)
  const imageBuffer = Buffer.from(await blob.arrayBuffer())
  const imageFileName = sourceItem.metadata.name
  const imageMimeType = sourceItem.metadata.mimeType || 'image/jpeg'

  // 7. runDivaTextureFirstPass
  const repTwin = shadowTwinMap.get(representative.fileId)
  if (!repTwin) {
    throw new Error(
      `Repraesentativ "${representative.fileId}" hat keinen Shadow-Twin — kann nicht klassifizieren`,
    )
  }
  const baseContext: Record<string, unknown> = {
    fileName: imageFileName,
    mimeType: imageMimeType,
    libraryId,
    filePath: sourcePath,
  }
  const extMatch = imageFileName.match(/\.([a-zA-Z0-9]+)$/)
  if (extMatch) baseContext.fileExtension = extMatch[1].toLowerCase()

  const runnerResult = await runDivaTextureFirstPass({
    provider,
    parentId: repTwin.parentId,
    fileName: imageFileName,
    filePath: sourcePath,
    baseImage: { buffer: imageBuffer, fileName: imageFileName, mimeType: imageMimeType },
    baseContext,
    getImageChoice: async (materialId) => {
      const props = await getArchiveItemProperties(libraryId, materialId)
      const choice = props.analysisSourceImage
      return choice === 'basecolor' || choice === 'supplier-preview' ? choice : null
    },
    fetchPreviewImage,
    analyzeImage,
  })

  const classification = extractClassification(runnerResult.markdown)
  if (!classification) {
    throw new Error(
      `Klassifikations-LLM-Antwort fuer "${groupName}" enthielt keine Pflichtfelder (material_class / confidence_class)`,
    )
  }

  // 8. Dry-Run: nichts schreiben
  if (args.dryRun === true) {
    return {
      groupName,
      representative: {
        fileId: representative.fileId,
        sourceFileName: representative.sourceFileName,
        sourceImage: runnerResult.sourceImage,
      },
      classification,
      members: {
        total: members.length,
        applied: [],
        skippedLocked: members.filter((m) => shouldSkipMember(m).reason === 'locked').map((m) => m.fileId),
        skippedRejected: members
          .filter((m) => shouldSkipMember(m).reason === 'rejected')
          .map((m) => m.fileId),
        skippedRepresentativeNotFound: [],
      },
      dryRun: true,
    }
  }

  // 9. Bulk-Apply auf alle nicht gelockten/verworfenen Mitglieder
  const applied: string[] = []
  const skippedLocked: string[] = []
  const skippedRejected: string[] = []
  const skippedRepresentativeNotFound: string[] = []

  for (const member of members) {
    const skip = shouldSkipMember(member)
    if (skip.skip) {
      if (skip.reason === 'locked') skippedLocked.push(member.fileId)
      else if (skip.reason === 'rejected') skippedRejected.push(member.fileId)
      continue
    }
    const twin = shadowTwinMap.get(member.fileId)
    if (!twin) {
      skippedRepresentativeNotFound.push(member.fileId)
      continue
    }
    const artifactKey: ArtifactKey = {
      sourceId: twin.sourceId,
      kind: 'transformation',
      targetLanguage,
      templateName,
    }
    const artifact =
      twin.artifacts?.transformation?.[templateName]?.[targetLanguage] ?? null
    if (!artifact || typeof artifact.markdown !== 'string' || artifact.markdown.trim() === '') {
      skippedRepresentativeNotFound.push(member.fileId)
      continue
    }

    const patchedMarkdown = applyClassificationToMember(artifact.markdown, classification)
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
    })
    applied.push(member.fileId)
  }

  FileLogger.info('diva-texture/group-classify', 'Stoffgruppen-Klassifikation abgeschlossen', {
    groupName,
    representativeFileId: representative.fileId,
    appliedCount: applied.length,
    lockedCount: skippedLocked.length,
    rejectedCount: skippedRejected.length,
    notFoundCount: skippedRepresentativeNotFound.length,
    libraryLabel: library.label,
  })

  return {
    groupName,
    representative: {
      fileId: representative.fileId,
      sourceFileName: representative.sourceFileName,
      sourceImage: runnerResult.sourceImage,
    },
    classification,
    members: {
      total: members.length,
      applied,
      skippedLocked,
      skippedRejected,
      skippedRepresentativeNotFound,
    },
    dryRun: false,
  }
}
