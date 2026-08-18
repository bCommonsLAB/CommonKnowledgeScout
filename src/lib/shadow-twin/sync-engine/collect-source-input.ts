/**
 * @fileoverview Sammelt pro Quelle alle Daten fuer planSourceSync (I/O-Schicht).
 *
 * @description
 * Liest Twin-Ordner, Transkript-Varianten (inkl. Inhalt), Transformations-Slots,
 * tote page_NNN.md und Bild-Bestand — und baut daraus den reinen Plan-Input.
 * Spiegelt die Kandidaten-Sammlung aus reconcile-library.ts, erweitert um
 * Transformationen und Bild-Spiegel (Design §3).
 *
 * Quellen ohne Twin-Ordner werden mit leerem Storage-Bestand geplant
 * (Mongo-only-Libraries: Plan enthaelt dann hoechstens Spiegel-Operationen).
 *
 * @module shadow-twin/sync-engine
 */

import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { isReconstructablePageImage } from '@/lib/shadow-twin/reconstruct-from-storage'
import { readTranscriptRecord, type MongoBinaryFragment, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { ReconcileCandidate } from '@/lib/shadow-twin/reconcile-plan'
import type { SourceSyncInput } from '@/lib/shadow-twin/sync-plan/plan-source-sync'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import type { NameMigrationInput } from '@/lib/shadow-twin/sync-plan/plan-name-migration'
import { buildNameMigrationInput, classifyTranscriptCandidates, type NameMigrationContext } from './collect-name-migration'
import { collectTransformations } from './collect-transformations'
import { FolderCache } from './folder-cache'
import { toDate } from './to-date'

// Per-Seite-OCR (totes Gewicht): page_001.md UND page_001.en.md (wie reconcile-library).
const PAGE_MD_RE = /^page_\d+(\.[a-z]{2,3})?\.md$/i

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

export interface CollectedSource {
  input: SourceSyncInput
  /** Kontext fuer die Ausfuehrung (Ordner, Items, Quelle). */
  shadowTwinFolderId: string | null
  twinFolderItems: StorageItem[]
  sourceItem: StorageItem | null
  parentId: string
  /** Sammel-Notizen (z.B. nicht lesbare Transformations-Slots) fuer den Report. */
  collectNotes: string[]
}

/**
 * Sammelt den Plan-Input EINER Quelle. Wirft bei nicht lesbarem Twin-Ordner
 * (der Orchestrator erfasst das als Quell-Fehler — kein stilles Weiterplanen
 * mit halbem Bestand).
 */
export async function collectSourceInput(args: {
  doc: ShadowTwinDocument
  provider: StorageProvider
  folderCache: FolderCache
  /** Quelldatei-Item, falls vom Scan bekannt (sonst wird nicht nachgeladen). */
  sourceItem?: StorageItem | null
  /** Namens-Migration (Welle 5c); ohne Kontext wird nicht klassifiziert. */
  nameMigrationCtx?: NameMigrationContext
}): Promise<CollectedSource> {
  const { doc, provider, folderCache, sourceItem = null, nameMigrationCtx } = args
  const sourceName = doc.sourceName || ''
  const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')
  const canonicalName = `${sourceBaseName}.md`
  const parentId = doc.parentId || ''

  // Kaputte Dokumente (ohne Dateiname/Ordner) NICHT planen: ein Spiegel wuerde
  // sonst Muell-Dateien wie `.{template}.{lang}.md` in einen "_"-Ordner schreiben.
  if (!sourceName || !parentId) {
    return {
      input: {
        sourceId: doc.sourceId, sourceName, canonicalTranscriptName: canonicalName,
        transcriptCandidates: [], transformations: [],
      },
      shadowTwinFolderId: null, twinFolderItems: [], sourceItem, parentId,
      collectNotes: ['Datenbank-Eintrag ohne Dateinamen oder Ordner — nichts geplant (Bestand pruefen)'],
    }
  }

  // Twin-Ordner: erst Mongo-Verweis, dann Storage-Suche.
  let folderId = doc.filesystemSync?.shadowTwinFolderId || null
  if (!folderId && parentId && sourceName) {
    try {
      folderId = (await findShadowTwinFolder(parentId, sourceName, provider))?.id ?? null
    } catch {
      // Suche fehlgeschlagen (z.B. Parent nicht listbar) → wie "kein Ordner" behandeln;
      // Mongo-Bestand traegt den Plan trotzdem.
      folderId = null
    }
  }

  const twinFolderItems: StorageItem[] = folderId ? await folderCache.list(folderId) : []

  // Transkript-Varianten im Storage ({base}.… mit kind=transcript) + Inhalt lesen.
  const storageTranscripts = twinFolderItems.filter(
    (it) =>
      it.type === 'file' &&
      it.metadata.name.toLowerCase().endsWith('.md') &&
      it.metadata.name.startsWith(`${sourceBaseName}.`) &&
      parseArtifactName(it.metadata.name, sourceBaseName).kind === 'transcript',
  )
  const storageCandidates: ReconcileCandidate[] = await Promise.all(
    storageTranscripts.map(async (it) => {
      let markdown = ''
      try {
        const { blob } = await provider.getBinary(it.id)
        markdown = await blob.text()
      } catch (err) {
        // Wie reconcile-library: nicht lesbare Variante als leer werten + loggen.
        FileLogger.warn('shadow-twins/sync-engine', 'Transkript-Variante nicht lesbar', {
          fileName: it.metadata.name, error: err instanceof Error ? err.message : String(err),
        })
      }
      // modifiedAt speist den Handkorrektur-Vorrang (Welle 0d, reconcile-plan.ts).
      return {
        fileId: it.id, name: it.metadata.name, markdown, origin: 'storage' as const,
        modifiedAt: toDate(it.metadata.modifiedAt),
      }
    }),
  )
  // Namens-Migration (Welle 5c): Muster-A-Dateien ({base}.{lang}.md MIT
  // Frontmatter) sind Transformationen — raus aus der Transkript-Reconcile.
  let nameMigration: NameMigrationInput | undefined
  let classifiedStorageCandidates = storageCandidates
  if (nameMigrationCtx) {
    const classified = classifyTranscriptCandidates({
      storageCandidates, sourceBaseName, sourceName, twinFolderItems,
      parentPathLength: nameMigrationCtx.parentPathLength,
    })
    classifiedStorageCandidates = classified.transcriptCandidates
    nameMigration = buildNameMigrationInput(sourceBaseName, classified, nameMigrationCtx)
  }

  const mongoRecord = readTranscriptRecord(doc)
  const transcriptCandidates: ReconcileCandidate[] = mongoRecord
    ? [...classifiedStorageCandidates, {
        name: canonicalName, markdown: mongoRecord.markdown, origin: 'mongo',
        modifiedAt: toDate(mongoRecord.updatedAt),
      }]
    : classifiedStorageCandidates

  // Tote page_NNN.md (Schutz fuer Quellen, die selbst page_NNN.* heissen).
  const deadPageMd = twinFolderItems
    .filter(
      (it) =>
        it.type === 'file' &&
        PAGE_MD_RE.test(it.metadata.name) &&
        !it.metadata.name.startsWith(`${sourceBaseName}.`),
    )
    .map((it) => ({ fileId: it.id, name: it.metadata.name }))

  // Transformations-Slots (Mongo ∪ Storage, Inhalt gelesen).
  const { transformations, notes } = await collectTransformations({
    doc, twinFolderItems, sourceBaseName, sourceName, provider,
  })

  // Bilder: Mongo-Fragmente ohne Storage-Spiegel (Export) + rekonstruierbare (B1).
  const fragments = (doc.binaryFragments as MongoBinaryFragment[] | undefined) ?? []
  const twinFileNames = new Set(
    twinFolderItems.filter((it) => it.type === 'file').map((it) => it.metadata.name),
  )
  const imagesMissingInStorage = fragments
    .filter((f) => !!f.url && !!f.name && !twinFileNames.has(f.name as string))
    .map((f) => ({ name: f.name as string, url: f.url as string }))
  const hasFragments = fragments.length > 0
  const reconstructablePageImages = hasFragments
    ? 0
    : twinFolderItems.filter((it) => it.type === 'file' && isReconstructablePageImage(it.metadata.name)).length

  const input: SourceSyncInput = {
    sourceId: doc.sourceId,
    sourceName,
    sourceModifiedAt: sourceItem ? toDate(sourceItem.metadata.modifiedAt) : null,
    canonicalTranscriptName: canonicalName,
    transcriptCandidates,
    transcriptUpdatedAt: mongoRecord ? toDate(mongoRecord.updatedAt) : null,
    deadPageMd,
    expectedPages: extractExpectedPages(doc),
    transformations,
    imagesMissingInStorage,
    reconstructablePageImages,
    nameMigration,
  }
  return { input, shadowTwinFolderId: folderId, twinFolderItems, sourceItem, parentId, collectNotes: notes }
}
