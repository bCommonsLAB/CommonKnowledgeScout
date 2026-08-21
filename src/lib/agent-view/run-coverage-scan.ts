/**
 * @fileoverview Server-Verdrahtung des Coverage-Scans (Ports → echte Dienste).
 *
 * @description
 * EINZIGE Stelle der Agentensicht, die konkrete Dienste kennt: Library-Config,
 * `StorageProvider` (ueber die Factory, nie ein Backend direkt —
 * `storage-abstraction.mdc`), Sync-Engine und das Twin-Repository. Der
 * Coverage-Service selbst bleibt dadurch storage- und datenbankfrei.
 *
 * @module agent-view
 */

import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { createMongoDocumentSource } from '@/lib/library-verification/document-source'
import { runLibraryVerification } from '@/lib/library-verification/verify-engine'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { getAllShadowTwins, readTranscriptRecord, type ShadowTwinArtifactRecord, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { LibraryService } from '@/lib/services/library-service'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { Library } from '@/types/library'
import { scanArchive } from './archive-scan'
import { runCoverageScan, type CoverageScanPorts } from './coverage-service'
import type { RawTwinFamily } from './coverage-inputs'
import type { TwinArtifactView } from './twin-rules'
import type { CoverageConventions, CoverageReport } from './types'

/** Nur der Kopf einer Markdown-Datei traegt Frontmatter (Kosten-Zaun). */
const FRONTMATTER_HEAD_CHARS = 8192

/** Liest die Konventionen der Library — sichtbar im Report, nie hartkodiert. */
export function readConventions(library: Library): CoverageConventions {
  const agentView = library.config?.agentView
  const pattern = agentView?.vorhabenFolderPattern?.trim()
  const depth = agentView?.indexRequiredMaxDepth
  return {
    standardTemplate: library.config?.secretaryService?.template?.trim() || null,
    vorhabenFolderPattern: pattern ? pattern : null,
    indexRequiredMaxDepth: typeof depth === 'number' && Number.isFinite(depth) ? depth : null,
    berichtFreshness: agentView?.berichtFreshness !== false,
    scanExcludeGlobs: library.config?.scanExcludeGlobs ?? [],
  }
}

function frontmatterOf(record: ShadowTwinArtifactRecord): Record<string, unknown> {
  if (record.frontmatter && typeof record.frontmatter === 'object') return record.frontmatter
  const markdown = typeof record.markdown === 'string' ? record.markdown.slice(0, FRONTMATTER_HEAD_CHARS) : ''
  return parseFrontmatter(markdown).meta
}

/** Bildet ein Twin-Dokument auf die Sicht der Regeln ab (Contract §2). */
export function toRawTwinFamily(doc: ShadowTwinDocument): RawTwinFamily {
  const artifacts: TwinArtifactView[] = []
  const transcript = readTranscriptRecord(doc)
  if (transcript) {
    artifacts.push({ kind: 'transcript', targetLanguage: '', frontmatter: frontmatterOf(transcript), updatedAt: transcript.updatedAt })
  }
  for (const [templateName, byLanguage] of Object.entries(doc.artifacts?.transformation ?? {})) {
    if (!byLanguage || typeof byLanguage !== 'object') continue
    for (const [targetLanguage, record] of Object.entries(byLanguage)) {
      if (!record || typeof record !== 'object') continue
      artifacts.push({ kind: 'transformation', templateName, targetLanguage, frontmatter: frontmatterOf(record), updatedAt: record.updatedAt })
    }
  }
  return { sourceId: doc.sourceId, sourceName: doc.sourceName, parentId: doc.parentId, artifacts }
}

export interface ScanLibraryCoverageArgs {
  libraryId: string
  userEmail: string
  /** Teilbaum-Scope; fehlt = ganze Library. */
  folderId?: string | null
  /** Library-relativer Pfad des Scopes, wenn der Aufrufer ihn kennt (MCP). */
  scopePath?: string | null
  /** Zeitquelle (Tests injizieren eine feste Uhr). */
  now?: () => string
}

/**
 * Fuehrt einen vollstaendigen Coverage-Scan aus. Der Report wird NICHT hier
 * gespeichert — das entscheidet die Route (Trennung Berechnung/Cache).
 */
export async function scanLibraryCoverage(args: ScanLibraryCoverageArgs): Promise<CoverageReport> {
  const { libraryId, userEmail } = args
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Library nicht gefunden: ${libraryId}`)
  const provider = await getServerProvider(userEmail, libraryId)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar')

  const scopeFolderId = args.folderId?.trim() ? args.folderId.trim() : null
  const rootFolderId = scopeFolderId ?? 'root'

  const ports: CoverageScanPorts = {
    scanArchive: (scanArgs) => scanArchive({ provider, ...scanArgs }),
    runSyncCheck: ({ folderId }) =>
      runLibrarySync({
        libraryId,
        userEmail,
        mode: 'check',
        preset: 'repair',
        scope: folderId ? { folderId } : {},
      }),
    loadTwinFamilies: async () => (await getAllShadowTwins(libraryId)).map(toRawTwinFamily),
    // A1 unveraendert wiederverwenden (check-Modus, ohne SSE): der Generator
    // wird bis zum Ende gefahren, der Rueckgabewert ist der Bericht.
    runFieldVerification: async () => {
      const generator = runLibraryVerification({
        libraryId,
        mode: 'check',
        libraryDetailViewType: library.config?.chat?.gallery?.detailViewType,
        facetDefs: parseFacetDefs(library),
        source: createMongoDocumentSource(library),
      })
      let next = await generator.next()
      while (!next.done) next = await generator.next()
      return next.value.documents
    },
    now: args.now ?? (() => new Date().toISOString()),
  }

  return runCoverageScan(
    {
      libraryId, rootFolderId, scopeFolderId,
      scopePath: scopeFolderId === null ? null : args.scopePath ?? null,
      conventions: readConventions(library),
    },
    ports,
  )
}
