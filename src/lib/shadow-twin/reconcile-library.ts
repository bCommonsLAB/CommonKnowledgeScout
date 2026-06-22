/**
 * @fileoverview Wiederverwendbare per-Library Shadow-Twin-Reconcile (Orchestrator).
 *
 * @description
 * Bringt Storage UND Mongo pro Quelle in den deterministischen Zustand
 * (kanonische `{base}.md` = vollstaendigstes Transkript). Idempotent, **Dry-Run
 * zuerst** (apply=false zeigt nur, was passieren WUERDE). Nutzt die reine
 * Plan-Logik {@link buildTranscriptReconcilePlan} + den getesteten Writer
 * {@link ShadowTwinService} (Mongo + kanonische Storage-Datei) und loescht
 * strikt unterlegene Varianten + tote `page_NNN.md`.
 *
 * Sicherheit: loescht nur, was der Plan als unterlegen/redundant markiert
 * (Konflikt → nichts an Transkripten). Storage-Loeschungen sind irreversibel →
 * Dry-Run-Report + mongodump als Netz (siehe 04-zielmodell.md §9).
 *
 * @module shadow-twin
 */

import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import {
  getAllShadowTwins,
  getShadowTwinsBySourceIds,
  readTranscriptRecord,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { buildTranscriptReconcilePlan, type ReconcileCandidate, type ReconcileStatus } from './reconcile-plan'
import { FileLogger } from '@/lib/debug/logger'

const PAGE_MD_RE = /^page_\d+\.md$/i

export interface ReconcileSourceResult {
  sourceId: string
  sourceName: string
  status: ReconcileStatus | 'skipped'
  winnerName: string | null
  winnerOrigin: 'storage' | 'mongo' | null
  winnerPages: number
  wroteCanonical: boolean
  updatedMongo: boolean
  /** Geloeschte (apply) bzw. zu loeschende (dry-run) Dateinamen. */
  deleted: string[]
  note?: string
}

export interface ReconcileReport {
  libraryId: string
  apply: boolean
  totalSources: number
  changed: number
  conflicts: number
  needsReextract: number
  results: ReconcileSourceResult[]
}

/** Erwartete Seitenzahl aus Transformation-Frontmatter (max), fuer needs-reextract. */
function extractExpectedPages(doc: ShadowTwinDocument): number | undefined {
  const transformation = doc.artifacts?.transformation
  if (!transformation) return undefined
  let max = 0
  for (const byLang of Object.values(transformation)) {
    for (const record of Object.values(byLang)) {
      const pages = record?.frontmatter?.pages
      if (typeof pages === 'number' && pages > max) max = pages
    }
  }
  return max > 0 ? max : undefined
}

/**
 * Reconcilet eine Library (oder eine Teilmenge von Quellen).
 *
 * @param apply false (Default) = Dry-Run/Report; true = schreibt/loescht wirklich.
 * @param sourceIds optionale Teilmenge; ohne Angabe alle Quellen der Library.
 */
export async function reconcileLibrary(args: {
  libraryId: string
  userEmail: string
  apply?: boolean
  sourceIds?: string[]
}): Promise<ReconcileReport> {
  const { libraryId, userEmail, apply = false, sourceIds } = args

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Library nicht gefunden: ${libraryId}`)
  const provider = await getServerProvider(userEmail, libraryId)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar')

  const docs = sourceIds?.length
    ? Array.from((await getShadowTwinsBySourceIds({ libraryId, sourceIds })).values())
    : await getAllShadowTwins(libraryId)

  const results: ReconcileSourceResult[] = []

  for (const doc of docs) {
    const sourceName = doc.sourceName || ''
    const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')
    const canonicalName = `${sourceBaseName}.md`
    const parentId = doc.parentId || ''

    const row: ReconcileSourceResult = {
      sourceId: doc.sourceId, sourceName, status: 'skipped',
      winnerName: null, winnerOrigin: null, winnerPages: 0,
      wroteCanonical: false, updatedMongo: false, deleted: [],
    }

    let folderId = doc.filesystemSync?.shadowTwinFolderId || null
    if (!folderId) {
      try { folderId = (await findShadowTwinFolder(parentId, sourceName, provider))?.id ?? null } catch { /* weiter */ }
    }
    if (!folderId) {
      row.note = 'Kein Shadow-Twin-Ordner im Storage'
      results.push(row)
      continue
    }

    let items
    try {
      items = await provider.listItemsById(folderId)
    } catch (err) {
      row.note = `Ordner nicht lesbar: ${err instanceof Error ? err.message : String(err)}`
      results.push(row)
      continue
    }

    const storageTranscripts = items.filter(
      (it) =>
        it.type === 'file' &&
        it.metadata.name.toLowerCase().endsWith('.md') &&
        parseArtifactName(it.metadata.name, sourceBaseName).kind === 'transcript',
    )
    const deadPageMd = items
      .filter((it) => it.type === 'file' && PAGE_MD_RE.test(it.metadata.name))
      .map((it) => ({ fileId: it.id, name: it.metadata.name }))

    const storageCandidates: ReconcileCandidate[] = await Promise.all(
      storageTranscripts.map(async (it) => {
        let markdown = ''
        try {
          const { blob } = await provider.getBinary(it.id)
          markdown = await blob.text()
        } catch (err) {
          FileLogger.warn('shadow-twins/reconcile', 'Variante nicht lesbar', {
            fileName: it.metadata.name, error: err instanceof Error ? err.message : String(err),
          })
        }
        return { fileId: it.id, name: it.metadata.name, markdown, origin: 'storage' as const }
      }),
    )

    const mongoRecord = readTranscriptRecord(doc)
    const candidates: ReconcileCandidate[] = mongoRecord
      ? [...storageCandidates, { name: canonicalName, markdown: mongoRecord.markdown, origin: 'mongo' }]
      : storageCandidates

    const plan = buildTranscriptReconcilePlan({
      canonicalName,
      transcriptCandidates: candidates,
      deadPageMd,
      expectedPages: extractExpectedPages(doc),
    })

    row.status = plan.status
    row.winnerName = plan.winnerName
    row.winnerOrigin = plan.winnerOrigin
    row.winnerPages = plan.winnerPages

    if (!apply) {
      row.deleted = plan.deletions.map((d) => d.name) // wuerde geloescht
      results.push(row)
      continue
    }

    // Apply: Gewinner schreiben (Mongo + kanonische {base}.md), dann Verlierer loeschen.
    if (plan.status === 'ok' && plan.winnerMarkdown && (plan.canonicalNeedsWrite || plan.mongoNeedsUpdate)) {
      const service = new ShadowTwinService({ library, userEmail, sourceId: doc.sourceId, sourceName, parentId, provider })
      await service.upsertMarkdown({
        kind: 'transcript', targetLanguage: '', markdown: plan.winnerMarkdown, shadowTwinFolderId: folderId,
      })
      row.wroteCanonical = plan.canonicalNeedsWrite
      row.updatedMongo = plan.mongoNeedsUpdate
    }
    for (const d of plan.deletions) {
      try {
        await provider.deleteItem(d.fileId)
        row.deleted.push(d.name)
      } catch (err) {
        FileLogger.warn('shadow-twins/reconcile', 'Loeschen fehlgeschlagen', {
          fileId: d.fileId, name: d.name, error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    results.push(row)
  }

  return {
    libraryId,
    apply,
    totalSources: results.length,
    changed: results.filter((r) => r.wroteCanonical || r.updatedMongo || r.deleted.length > 0).length,
    conflicts: results.filter((r) => r.status === 'conflict').length,
    needsReextract: results.filter((r) => r.status === 'needs-reextract').length,
    results,
  }
}
