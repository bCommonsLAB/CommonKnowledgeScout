/**
 * @fileoverview Coverage-Service — die Kompositionsschicht der Agentensicht.
 *
 * @description
 * Orchestriert die VORHANDENEN Pruefmaschinen und ergaenzt nur, was keine
 * kann (Projektauftrag §2 Leitprinzip 1):
 *
 * 1. Sync-Engine-Check (`mode: 'check'`, `preset: 'repair'`) → Twin-Abdeckung,
 *    Konflikte, Alt-Namen, Pfad-Budget.
 * 2. Twin-Kern-/Verifikationsregeln aus `twin-core-fields.ts` (keine zweite
 *    Felddefinition).
 * 3. Archiv-Konventionen (`_INDEX.md`/`BERICHT.md`, Soll/Ist am Stand).
 * 4. Verweis-Audit (doppelte Buchhaltung, ohne LLM).
 *
 * Coverage wird BERECHNET; das Ergebnis (`CoverageReport`) ist abgeleitet und
 * wegwerfbar. Erklaerte Staende werden ausschliesslich GELESEN.
 *
 * Alle Aussenzugriffe laufen ueber Ports — damit ist der Service ohne Storage
 * und ohne MongoDB unit-testbar (Vorbild: `LibraryDocumentSource` in A1).
 *
 * @module agent-view
 */

import type { DocumentVerificationResult } from '@/lib/library-verification/types'
import type { LibrarySyncReport } from '@/lib/shadow-twin/sync-engine/report-types'
import { compileVorhabenPattern, evaluateArchiveRules } from './archive-rules'
import type { ArchiveScanResult } from './archive-types'
import { buildFileIndex, buildNewestChangeBySubtree, buildOwnChangeByFolder, locateFamilies, type RawTwinFamily } from './coverage-inputs'
import { auditAllDocuments } from './document-audit'
import { gapsFromSyncReport, type SourceLocation } from './engine-gaps'
import { gapsFromFieldVerification } from './field-gaps'
import { applyGapBudget } from './gap-budget'
import { buildFamilySummaries } from './family-summaries'
import { createGap, sortGaps } from './gap-registry'
import { orphanTwinDocuments, orphanTwinFolders } from './inventory-gaps'
import { filesWithoutExtension, sourcesWithoutTwin } from './source-gaps'
import { checkStandWiderspruch } from './stand-widerspruch'
import { buildTree } from './tree-builder'
import { evaluateTwinRules, type TwinFamilyView } from './twin-rules'
import { buildTotals } from './coverage-totals'
import type { CoverageConventions, CoverageGap, CoverageGapType, CoverageReport } from './types'
import { buildVorhabenCards } from './vorhaben-board'

/** Aussenzugriffe des Scans — in Tests vollstaendig ersetzbar. */
export interface CoverageScanPorts {
  scanArchive(args: { rootFolderId: string; excludeGlobs: readonly string[] }): Promise<ArchiveScanResult>
  runSyncCheck(args: { folderId: string | null }): Promise<LibrarySyncReport>
  loadTwinFamilies(): Promise<RawTwinFamily[]>
  /**
   * Library-Verifikation A1 im check-Modus (nur die Befund-Dokumente).
   * Die Feld-Pruefung bleibt bei A1 — die Sicht uebersetzt nur
   * `missing-base-field` (F2: `core_fields_missing`).
   */
  runFieldVerification(): Promise<DocumentVerificationResult[]>
  /** Zeitquelle (injiziert, damit Reports reproduzierbar testbar sind). */
  now(): string
}

export interface CoverageScanRequest {
  libraryId: string
  /** Scan-Wurzel im Storage (Library-Wurzel oder Teilbaum). */
  rootFolderId: string
  /** Gesetzt, wenn nur ein Teilbaum gescannt wurde (Scope-Kennzeichnung). */
  scopeFolderId: string | null
  /** Library-relativer Pfad der Scan-Wurzel, wenn der Aufrufer ihn kennt. */
  scopePath?: string | null
  conventions: CoverageConventions
}

/** Fuehrt EINEN Coverage-Scan aus und liefert den (wegwerfbaren) Report. */
export async function runCoverageScan(
  request: CoverageScanRequest,
  ports: CoverageScanPorts,
): Promise<CoverageReport> {
  const { conventions } = request
  const vorhabenPattern = compileVorhabenPattern(conventions.vorhabenFolderPattern)

  // A1 separat isolieren: Ein Feld-Pruefungs-Fehler bricht den Scan nicht ab,
  // sondern wird als scan_error ausgewiesen (`no-silent-fallbacks`).
  const [archive, syncReport, rawFamilies, fieldVerification] = await Promise.all([
    ports.scanArchive({ rootFolderId: request.rootFolderId, excludeGlobs: conventions.scanExcludeGlobs }),
    ports.runSyncCheck({ folderId: request.scopeFolderId }),
    ports.loadTwinFamilies(),
    ports
      .runFieldVerification()
      .then((documents) => ({ documents, error: null as string | null }))
      .catch((error: unknown) => ({
        documents: [] as DocumentVerificationResult[],
        error: error instanceof Error ? error.message : String(error),
      })),
  ])

  // Pfad-Sortierung entkoppelt den Report von der Scan-Reihenfolge: mit
  // concurrency > 1 (W8) haengt `archive.folders` von Antwortzeiten ab —
  // der Report bleibt trotzdem reproduzierbar (Akzeptanzkriterium 6).
  const folders = [...archive.folders].sort((a, b) => a.path.localeCompare(b.path))
  const folderIds = new Set(folders.map((folder) => folder.folderId))
  // Bibliotheks-Wurzel: kein Vorhaben, kein BERICHT noetig (Entscheid
  // 2026-08-19). Bei Teilbaum-Scans ist die Scan-Wurzel ein normaler Ordner.
  const libraryRootFolderId = request.scopeFolderId === null ? request.rootFolderId : null
  const fileIndex = buildFileIndex(folders)
  // Teilbaum-Scope gilt auch fuer Buch 2 (Mongo): Familien, deren Quelle der
  // Scan nicht fand UND deren Elternordner nicht im Teilbaum liegt, gehoeren
  // nicht in diesen Report — sonst kippen library-weite Twins gesammelt an
  // die Scope-Wurzel und verseuchen Regeln und Verweis-Audit (Cowork-Befund).
  // Library-weit bleibt alles (Orphan-Erkennung braucht die volle Menge).
  const familiesForScope =
    request.scopeFolderId === null
      ? rawFamilies
      : rawFamilies.filter((family) => fileIndex.has(family.sourceId) || folderIds.has(family.parentId))
  const families = locateFamilies({ families: familiesForScope, fileIndex, folderIds, rootFolderId: request.rootFolderId })
  const newestChange = buildNewestChangeBySubtree({ folders, families })

  const locations = new Map<string, SourceLocation>(
    [...fileIndex.entries()].map(([fileId, location]) => [fileId, { folderId: location.folderId, path: location.path }]),
  )

  const gaps: CoverageGap[] = [
    ...gapsFromSyncReport({ report: syncReport, locations, rootFolderId: request.rootFolderId }),
    // W1-Nachzug: Quellen, die die Engine still uebersprungen hat
    // (skippedWithoutDoc — keine Report-Zeile) und die auch Mongo nicht kennt.
    ...sourcesWithoutTwin({
      folders,
      engineSourceIds: new Set(syncReport.sources.map((row) => row.sourceId)),
      familySourceIds: new Set(families.map((family) => family.sourceId)),
    }),
    // Archiv-Hygiene: endungslose Dateien sind meist abgeschnittene
    // Sync-Reste — genau das will man gemeldet haben (Cowork-Befund).
    ...filesWithoutExtension(folders),
    ...gapsFromFieldVerification({
      documents: fieldVerification.documents, locations, rootFolderId: request.rootFolderId,
      scoped: request.scopeFolderId !== null,
    }),
    ...(fieldVerification.error === null
      ? []
      : [
          createGap({
            type: 'scan_error',
            scope: 'library',
            targetId: request.rootFolderId,
            targetName: '(Library)',
            folderId: request.rootFolderId,
            path: '',
            message: 'Feld-Verifikation (A1) fehlgeschlagen — core_fields_missing unvollstaendig',
            detail: fieldVerification.error,
          }),
        ]),
    ...families.flatMap((family) => evaluateTwinRules(family, conventions.standardTemplate)),
    ...orphanTwinFolders(folders),
    // Twin-Dokumente ohne Scan-Fund sind nur beim Library-weiten Scan
    // aussagekraeftig — im Teilbaum-Scope liegt die Quelle womoeglich
    // ausserhalb (kein Raten, siehe inventory-gaps.ts).
    ...(request.scopeFolderId === null
      ? orphanTwinDocuments({ families, scannedFileIds: new Set(fileIndex.keys()), rootFolderId: request.rootFolderId })
      : []),
    ...folders.flatMap((folder) =>
      evaluateArchiveRules(folder, {
        conventions,
        vorhabenPattern,
        newestChangeInSubtree: newestChange.get(folder.folderId) ?? null,
        isLibraryRoot: folder.folderId === libraryRootFolderId,
      }),
    ),
    ...auditAllDocuments({ folders, families, fileIndex, vorhabenPattern }),
  ]

  const budget = applyGapBudget(folders, gaps)
  const sourceCountByFolder = countSourcesByFolder(families)
  const ownChangeByFolder = buildOwnChangeByFolder({ folders, families })
  const firstPass = buildTree({ folders, gaps: budget.gaps, sourceCountByFolder, ownChangeByFolder })

  const standGaps: CoverageGap[] = []
  for (const node of flattenNodes(firstPass)) {
    const gap = checkStandWiderspruch({
      node,
      newestChangeInSubtree: newestChange.get(node.folderId) ?? null,
      subtreeGapTypes: Object.keys(node.gapsByType) as CoverageGapType[],
    })
    if (gap) standGaps.push(gap)
  }

  const effectiveGaps = sortGaps([...budget.gaps, ...standGaps])
  const tree = buildTree({ folders, gaps: effectiveGaps, sourceCountByFolder, ownChangeByFolder })
  const totals = buildTotals({
    folders, families, gaps: effectiveGaps, archive,
    budget: budget.collapsed,
    engineSkippedExcluded: syncReport.skippedExcluded ?? 0,
  })

  // Twin-Knoten des Baums (Welle 4, F4): fuehrendes Artefakt + Kurationszustand.
  const familySummaries = buildFamilySummaries({ families, standardTemplate: conventions.standardTemplate })

  return {
    libraryId: request.libraryId,
    generatedAt: ports.now(),
    derived: true,
    scope: { folderId: request.scopeFolderId, path: request.scopePath ?? null },
    conventions,
    totals,
    gaps: effectiveGaps,
    tree,
    vorhaben: buildVorhabenCards({ folders, tree, gaps: effectiveGaps, vorhabenPattern, libraryRootFolderId }),
    families: familySummaries.families,
    familiesTruncated: familySummaries.truncated,
  }
}

function countSourcesByFolder(families: readonly TwinFamilyView[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const family of families) counts.set(family.folderId, (counts.get(family.folderId) ?? 0) + 1)
  return counts
}

function flattenNodes(nodes: ReturnType<typeof buildTree>): ReturnType<typeof buildTree> {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}
