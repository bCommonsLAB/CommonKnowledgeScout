/**
 * @fileoverview Kurations-Patch — Server-Verdrahtung (Twin-Datei-Contract §4).
 *
 * @description
 * DIE eine Schreiboperation der Kuration: laedt das Zielartefakt aus MongoDB
 * (Wahrheit fuer erzeugte Twins), prueft den Spiegel-Drift-Guard gegen den
 * Storage und patcht dann NUR die Kurations-Felder ueber
 * `ShadowTwinService.patchArtifactFrontmatter` (Erhalt unbekannter Felder und
 * des Bodys, §4.2). Der Spiegel wird — wenn konfiguriert — in den `_`-Ordner
 * mitgeschrieben; Alt-Form-Sidecars werden NIE fortgeschrieben (Contract §2),
 * fehlende Spiegel erzeugt der naechste Export.
 *
 * Entscheidungslogik und typisierte Fehler: `curation-plan.ts`.
 * Konsumenten: Kurations-Route (`api/library/[libraryId]/shadow-twins/curation`),
 * darueber die Agentensicht (F4) — sie hat keinen eigenen Schreibpfad.
 *
 * @module shadow-twin
 */

import { FileLogger } from '@/lib/debug/logger'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import {
  getShadowTwinsBySourceIds,
  readTranscriptRecord,
  type ShadowTwinArtifactRecord,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { resolveArtifact } from './artifact-resolver'
import {
  CurationArtifactNotFoundError,
  MirrorDriftError,
  buildCurationPatches,
  hasMirrorDrift,
  type CurationArtifactRef,
} from './curation-plan'
import { getShadowTwinConfig } from './shadow-twin-config'
import { ShadowTwinService } from './store/shadow-twin-service'
import { isVerificationValid } from './twin-core-fields'

/** Wohin der Spiegel-Write ging — sichtbar statt still (`no-silent-fallbacks`). */
export type CurationMirrorTarget =
  | 'twin_folder'
  | 'skipped_no_folder'
  | 'skipped_legacy_sidecar'
  | 'skipped_disabled'

export interface CurationPatchArgs {
  library: Library
  userEmail: string
  sourceId: string
  artifact: CurationArtifactRef
  /** Feld-Patch (nur `twin_status`) — Validierung in `buildCurationPatches`. */
  set?: Record<string, unknown> | null
  /** Verify-Aktion: `verified_by: human:<userEmail>` + `verified_at`. */
  verify: boolean
  /** Zeitquelle (Tests injizieren eine feste Uhr). */
  now?: () => string
}

export interface CurationPatchResult {
  artifact: CurationArtifactRef
  /** Kurationszustand NACH dem Patch (aus dem gespeicherten Frontmatter). */
  curation: {
    twinStatus: string | null
    generatedBy: string | null
    generatedAt: string | null
    verifiedBy: string | null
    verifiedAt: string | null
    /** Temporale Regel §3.2: `verified_at >= generated_at`. */
    verificationValid: boolean
  }
  mirror: CurationMirrorTarget
}

function pickTargetRecord(
  doc: ShadowTwinDocument,
  artifact: CurationArtifactRef,
): ShadowTwinArtifactRecord {
  if (artifact.kind === 'transcript') {
    const record = readTranscriptRecord(doc)
    if (record) return record
    throw new CurationArtifactNotFoundError(`Kein Transkript fuer Quelle „${doc.sourceName}"`)
  }
  const record = doc.artifacts?.transformation?.[artifact.templateName ?? '']?.[artifact.targetLanguage]
  if (record && typeof record.markdown === 'string') return record
  throw new CurationArtifactNotFoundError(
    `Keine Transformation ${artifact.templateName}/${artifact.targetLanguage} fuer Quelle „${doc.sourceName}"`,
  )
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Spiegel lesen (Drift-Guard) und das Spiegel-Ziel des Writes bestimmen. */
async function checkMirrorAndResolveTarget(args: {
  provider: StorageProvider
  doc: ShadowTwinDocument
  artifact: CurationArtifactRef
  mongoMarkdown: string
}): Promise<{ mirror: CurationMirrorTarget; shadowTwinFolderId?: string }> {
  const { provider, doc, artifact } = args
  const resolved = await resolveArtifact(provider, {
    sourceItemId: doc.sourceId,
    sourceName: doc.sourceName,
    parentId: doc.parentId,
    targetLanguage: artifact.targetLanguage,
    templateName: artifact.templateName,
    preferredKind: artifact.kind,
  })

  if (resolved) {
    const binary = await provider.getBinary(resolved.fileId)
    const mirrorMarkdown = await binary.blob.text()
    if (hasMirrorDrift({ mongoMarkdown: args.mongoMarkdown, mirrorMarkdown })) {
      throw new MirrorDriftError(resolved.fileName)
    }
    if (resolved.location === 'dotFolder' && resolved.shadowTwinFolderId) {
      return { mirror: 'twin_folder', shadowTwinFolderId: resolved.shadowTwinFolderId }
    }
    // Alt-Form neben der Quelle: driftfrei, aber nie fortschreiben (Contract §2) —
    // die Namens-Migration der Engine ueberfuehrt sie in den `_`-Ordner.
    return { mirror: 'skipped_legacy_sidecar' }
  }

  const folder = await findShadowTwinFolder(doc.parentId, doc.sourceName, provider)
  if (folder) return { mirror: 'twin_folder', shadowTwinFolderId: folder.id }
  return { mirror: 'skipped_no_folder' }
}

/**
 * Fuehrt EINEN Kurations-Patch aus (Contract §4): validieren → Drift-Guard →
 * Feld-Patch (Mongo + ggf. Spiegel im `_`-Ordner). Wirft typisierte Fehler
 * aus `curation-plan.ts`; nichts wird bei einem Befund ueberschrieben.
 */
export async function applyCurationPatch(args: CurationPatchArgs): Promise<CurationPatchResult> {
  const { library, userEmail, sourceId, artifact } = args
  const now = args.now ?? (() => new Date().toISOString())

  const docs = await getShadowTwinsBySourceIds({ libraryId: library.id, sourceIds: [sourceId] })
  const doc = docs.get(sourceId)
  if (!doc) throw new CurationArtifactNotFoundError(`Keine Twin-Familie fuer sourceId=${sourceId}`)

  const record = pickTargetRecord(doc, artifact)
  const meta = record.frontmatter ?? parseFrontmatter(record.markdown).meta
  const patches = buildCurationPatches({
    set: args.set,
    verify: args.verify,
    userEmail,
    generatedBy: meta['generated_by'],
    now: now(),
  })

  // Drift-Guard braucht den Storage — schlaegt der Provider fehl, bricht die
  // Kuration LAUT ab (kein Patch ohne Guard, `no-silent-fallbacks.mdc`).
  const provider = await getServerProvider(userEmail, library.id)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar — Drift-Guard nicht pruefbar')
  const target = await checkMirrorAndResolveTarget({
    provider, doc, artifact, mongoMarkdown: record.markdown,
  })

  const mirrorDisabled = !getShadowTwinConfig(library).persistToFilesystem
  const mirror: CurationMirrorTarget = mirrorDisabled ? 'skipped_disabled' : target.mirror

  const service = new ShadowTwinService({
    library, userEmail, sourceId, sourceName: doc.sourceName, parentId: doc.parentId, provider,
  })
  const patched = await service.patchArtifactFrontmatter({
    kind: artifact.kind,
    targetLanguage: artifact.targetLanguage,
    templateName: artifact.templateName,
    patches,
    shadowTwinFolderId: mirror === 'twin_folder' ? target.shadowTwinFolderId : undefined,
    skipFilesystemMirror: mirror !== 'twin_folder',
  })

  const patchedMeta = parseFrontmatter(patched.markdown).meta
  FileLogger.info('shadow-twin-curation', 'Kurations-Patch angewendet', {
    libraryId: library.id, sourceId, kind: artifact.kind,
    templateName: artifact.templateName, patchedKeys: Object.keys(patches), mirror,
  })

  return {
    artifact,
    curation: {
      twinStatus: stringOrNull(patchedMeta['twin_status']),
      generatedBy: stringOrNull(patchedMeta['generated_by']),
      generatedAt: stringOrNull(patchedMeta['generated_at']),
      verifiedBy: stringOrNull(patchedMeta['verified_by']),
      verifiedAt: stringOrNull(patchedMeta['verified_at']),
      verificationValid:
        stringOrNull(patchedMeta['verified_by']) !== null &&
        isVerificationValid({
          generatedAt: patchedMeta['generated_at'],
          verifiedAt: patchedMeta['verified_at'],
        }),
    },
    mirror,
  }
}
