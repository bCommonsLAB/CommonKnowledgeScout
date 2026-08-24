/**
 * @fileoverview Fixture-Welt fuer den W8-Invarianz-Test (Voll-Scan ≡ Merge).
 *
 * Eine kleine, MUTIERBARE Archiv-Welt in Library-relativen Pfaden plus die
 * Ports, mit denen der ECHTE `runCoverageScan` sie voll oder als Teilbaum
 * scannt. Der Teilbaum-Port rebasiert die Welt exakt so, wie `scanArchive`
 * sie saehe (Scan-Wurzel: Pfad '', Name '', Tiefe 0) — damit prueft der Test
 * die Produktions-Semantik, nicht eine Test-Vereinfachung.
 */

import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { RawTwinFamily } from '@/lib/agent-view/coverage-inputs'
import { isInSubtree } from '@/lib/agent-view/teilbaum'
import type { CoverageScanPorts, CoverageScanRequest } from '@/lib/agent-view/coverage-service'
import type { CoverageConventions } from '@/lib/agent-view/types'
import type { LibrarySyncReport, SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'

export const KONVENTIONEN: CoverageConventions = {
  standardTemplate: null,
  vorhabenFolderPattern: null,
  indexRequiredMaxDepth: null,
  berichtFreshness: true,
  scanExcludeGlobs: [],
}

export interface Welt {
  folders: ArchiveFolderNode[]
  families: RawTwinFamily[]
}

function ordner(args: {
  folderId: string
  path: string
  parent: string | null
  stand?: { wert: 'ungesichtet' | 'erschlossen' | 'strukturiert' | 'berichtet' | 'abgenommen'; seit: string }
  bericht?: { modifiedAt: string }
  dateien?: Array<{ fileId: string; name: string; modifiedAt: string }>
}): ArchiveFolderNode {
  const name = args.path === '' ? '' : (args.path.split('/').pop() as string)
  const depth = args.path === '' ? 0 : args.path.split('/').length
  const files = (args.dateien ?? []).map((datei) => ({
    fileId: datei.fileId,
    name: datei.name,
    path: args.path === '' ? datei.name : `${args.path}/${datei.name}`,
    modifiedAt: datei.modifiedAt,
  }))
  const index = args.stand
    ? {
        fileId: `idx-${args.folderId}`, name: '_INDEX.md',
        path: args.path === '' ? '_INDEX.md' : `${args.path}/_INDEX.md`,
        modifiedAt: '2026-08-01T08:00:00.000Z',
        meta: { bearbeitungsstand: args.stand.wert, bearbeitungsstand_seit: args.stand.seit }, body: '',
      }
    : null
  const bericht = args.bericht
    ? {
        fileId: `ber-${args.folderId}`, name: 'BERICHT.md',
        path: args.path === '' ? 'BERICHT.md' : `${args.path}/BERICHT.md`,
        modifiedAt: args.bericht.modifiedAt,
        meta: { status: 'aktiv' }, body: `# Bericht ${name}\n`,
      }
    : null
  if (index) files.push({ fileId: index.fileId, name: index.name, path: index.path, modifiedAt: index.modifiedAt })
  if (bericht) files.push({ fileId: bericht.fileId, name: bericht.name, path: bericht.path, modifiedAt: bericht.modifiedAt })
  return {
    folderId: args.folderId, name, path: args.path, parentFolderId: args.parent, depth,
    files, twinFolders: [], index, bericht,
    bearbeitungsstand: args.stand?.wert ?? null,
    // Wie der Scan liest: Datum grosszuegig als Tagesende.
    bearbeitungsstandSeit: args.stand ? `${args.stand.seit}T23:59:59.999Z` : null,
  }
}

/**
 * Welt: Wurzel → Bereich „1. Arbeit" (Vorhaben per Selbstdeklaration, mit
 * Bericht) → darunter der SCOPE „Pilot" mit Untervorhaben — plus ein
 * Geschwister ausserhalb, dessen Befund den Merge ueberleben muss.
 */
export function baueWelt(): Welt {
  const folders = [
    ordner({ folderId: 'root', path: '', parent: null, stand: { wert: 'strukturiert', seit: '2026-08-01' } }),
    ordner({
      folderId: 'f-arbeit', path: '1. Arbeit', parent: 'root',
      stand: { wert: 'berichtet', seit: '2026-08-12' }, bericht: { modifiedAt: '2026-08-12T10:00:00.000Z' },
    }),
    ordner({ folderId: 'f-pilot', path: '1. Arbeit/Pilot', parent: 'f-arbeit', stand: { wert: 'erschlossen', seit: '2026-08-05' } }),
    ordner({
      folderId: 'f-unter', path: '1. Arbeit/Pilot/Unter', parent: 'f-pilot',
      stand: { wert: 'berichtet', seit: '2026-08-10' }, bericht: { modifiedAt: '2026-08-10T09:00:00.000Z' },
      dateien: [{ fileId: 'src-u', name: 'Aufnahme.m4a', modifiedAt: '2026-08-09T12:00:00.000Z' }],
    }),
    // Kollaps-Wurzel INNERHALB des Scopes: `ungesichtet` fasst die Befunde
    // ihres Teilbaums zum Sammel-Gap zusammen (Gap-Budget) — der Merge muss
    // das exakt wie der Voll-Scan behandeln.
    ordner({
      folderId: 'f-roh', path: '1. Arbeit/Pilot/Roh', parent: 'f-pilot',
      stand: { wert: 'ungesichtet', seit: '2026-08-02' },
      dateien: [{ fileId: 'src-r', name: 'Scan.pdf', modifiedAt: '2026-08-04T12:00:00.000Z' }],
    }),
    ordner({
      folderId: 'f-anders', path: '1. Arbeit/Anders', parent: 'f-arbeit',
      stand: { wert: 'ungesichtet', seit: '2026-08-02' },
      dateien: [{ fileId: 'src-a', name: 'Notiz.pdf', modifiedAt: '2026-08-03T12:00:00.000Z' }],
    }),
    ordner({ folderId: 'f-ablage', path: '2. Ablage', parent: 'root' }),
  ]
  const families: RawTwinFamily[] = [
    {
      sourceId: 'src-u', sourceName: 'Aufnahme.m4a', parentId: 'f-unter',
      artifacts: [{
        kind: 'transcript', targetLanguage: '', updatedAt: '2026-08-09T13:00:00.000Z',
        frontmatter: {
          type: 'transcript', source_file: 'Aufnahme.m4a',
          generated_by: 'knowledgescout/gemini-2.5-pro', generated_at: '2026-08-09T13:00:00.000Z',
          verified_by: 'human:peter', verified_at: '2026-08-10',
        },
      }],
    },
  ]
  return { folders, families }
}

function strip(path: string, prefix: string): string {
  return path === prefix ? '' : path.slice(prefix.length + 1)
}

/** Die Welt, wie `scanArchive` sie ab der Scope-Wurzel saehe (Scope-relativ). */
export function rebasiere(welt: Welt, scopeFolderId: string): ArchiveFolderNode[] {
  const scope = welt.folders.find((folder) => folder.folderId === scopeFolderId)
  if (!scope) throw new Error(`Scope nicht in der Welt: ${scopeFolderId}`)
  const prefix = scope.path
  return welt.folders
    .filter((folder) => folder.folderId === scopeFolderId || isInSubtree(folder.path, prefix))
    .map((folder) => ({
      ...structuredClone(folder),
      path: strip(folder.path, prefix),
      name: folder.folderId === scopeFolderId ? '' : folder.name,
      parentFolderId: folder.folderId === scopeFolderId ? null : folder.parentFolderId,
      depth: folder.depth - scope.depth,
      files: folder.files.map((file) => ({ ...file, path: strip(file.path, prefix) })),
      index: folder.index ? { ...folder.index, path: strip(folder.index.path, prefix) } : null,
      bericht: folder.bericht ? { ...folder.bericht, path: strip(folder.bericht.path, prefix) } : null,
    }))
}

function leererSyncReport(rows: SourceSyncReportRow[]): LibrarySyncReport {
  return {
    libraryId: 'lib-1', mode: 'check', preset: 'repair',
    totalSources: rows.length, scannedFiles: 0, skippedWithoutDoc: 0, skippedExcluded: 0,
    changed: 0, conflicts: 0, needsPipeline: 0, needsReextract: 0,
    planned: {}, selected: {}, executed: {}, failed: {},
    errors: 0, sources: rows, sourcesTruncated: false,
  }
}

/** Ports auf die Welt; `mische` verwuerfelt die Ordner-Reihenfolge (Determinismus-Test). */
export function weltPorts(welt: Welt, args: { now: string; mische?: boolean }): CoverageScanPorts {
  return {
    scanArchive: async ({ rootFolderId }) => {
      const folders = rootFolderId === 'root' ? structuredClone(welt.folders) : rebasiere(welt, rootFolderId)
      if (args.mische) folders.reverse()
      return { folders, skippedExcluded: 0 }
    },
    runSyncCheck: async ({ folderId }) => {
      // Engine-Sicht: eine Zeile je Quelle im jeweiligen Scan-Bereich.
      const imScan = folderId === null
        ? welt.folders
        : welt.folders.filter((f) => f.folderId === folderId || isInSubtree(f.path, welt.folders.find((s) => s.folderId === folderId)?.path ?? ''))
      const ids = new Set(imScan.flatMap((folder) => folder.files.map((file) => file.fileId)))
      const rows = welt.families
        .filter((family) => ids.has(family.sourceId))
        .map((family) => ({
          sourceId: family.sourceId, sourceName: family.sourceName, transcriptStatus: 'ok' as const,
          winnerName: `${family.sourceName}.md`, winnerOrigin: 'mongo' as const, winnerPages: 1,
          operations: [], notes: [],
        }))
      return leererSyncReport(rows)
    },
    loadTwinFamilies: async () => structuredClone(welt.families),
    runFieldVerification: async () => [],
    now: () => args.now,
  }
}

export function vollRequest(): CoverageScanRequest {
  return { libraryId: 'lib-1', rootFolderId: 'root', scopeFolderId: null, scopePath: null, conventions: KONVENTIONEN }
}

export function teilRequest(scopeFolderId: string): CoverageScanRequest {
  return { libraryId: 'lib-1', rootFolderId: scopeFolderId, scopeFolderId, scopePath: null, conventions: KONVENTIONEN }
}
