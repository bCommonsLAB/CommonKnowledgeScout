/**
 * @fileoverview Preprocess-Skript: DIVA-Liefersystem-Snapshots nach MongoDB.
 *
 * @description
 * Liest pro Ordner die Sidecar `api2_GetJsonOptionValues.json` ueber den
 * StorageProvider (storage-unabhaengig), matcht die Basecolor-Dateien
 * deterministisch (KEIN LLM) und schreibt je Treffer einen DIVA-Snapshot in
 * `archive_item_properties__<libraryId>` (itemKey = VCodex). Dadurch weiss die
 * App zur Laufzeit instant, welche Dateien DIVA-Texturen sind (Filter +
 * Instant-Info), ohne die grosse JSON pro Datei zu parsen.
 *
 * Am Ende gibt es eine Legende: gematcht / Basecolor ohne Treffer /
 * Sidecar-Eintraege ohne Datei (typisch ausgelistete Texturen).
 *
 * @usage
 * ```bash
 * # Dry-Run (nur Legende, keine DB-Schreibzugriffe)
 * USER_EMAIL=me@example.com pnpm tsx scripts/preprocess-diva-textures.ts --libraryId=lib-123 --folderId=<id> --dryRun
 *
 * # Echter Lauf inkl. Unterordner
 * USER_EMAIL=me@example.com pnpm tsx scripts/preprocess-diva-textures.ts --libraryId=lib-123 --folderId=<id> --recursive
 * ```
 */

import { getServerProvider } from '@/lib/storage/server-provider'
import { loadSupplierData } from '@/lib/diva-texture/load-supplier-data'
import {
  buildFolderPreprocessPlan,
  tallyMatchesByAttribute,
  type PreprocessFile,
  type AttributeTally,
} from '@/lib/diva-texture/preprocess-folder'
import { writeDivaTextureSnapshot } from '@/lib/diva-texture/supplier-properties'
import type { StorageProvider } from '@/lib/storage/types'

interface Options {
  libraryId: string
  userEmail: string
  folderId: string
  recursive: boolean
  dryRun: boolean
}

interface FolderResult {
  folderId: string
  matched: number
  unmatchedFiles: string[]
  unmatchedEntries: number
  basecolorFiles: number
  /** Stoffgruppen-Verteilung der Treffer (GroupName → Anzahl). */
  groups: AttributeTally[]
}

/** Verarbeitet genau einen Ordner (sofern eine Sidecar vorhanden ist). */
async function processFolder(
  provider: StorageProvider,
  options: Options,
  folderId: string,
): Promise<FolderResult | null> {
  const supplier = await loadSupplierData(provider, folderId)
  if (!supplier) return null

  const items = await provider.listItemsById(folderId)
  const files: PreprocessFile[] = items
    .filter((it) => it.type === 'file')
    .map((it) => ({ id: it.id, name: it.metadata.name }))

  const plan = buildFolderPreprocessPlan(files, supplier.entries)

  if (!options.dryRun) {
    for (const match of plan.matches) {
      await writeDivaTextureSnapshot(options.libraryId, {
        entry: match.entry,
        file: match.file,
        parentId: folderId,
        sourceFile: supplier.sourceFileName,
        strategy: match.strategy,
      })
    }
  }

  return {
    folderId,
    matched: plan.matches.length,
    unmatchedFiles: plan.unmatchedFiles.map((f) => f.name),
    unmatchedEntries: plan.unmatchedEntries.length,
    basecolorFiles: plan.basecolorFileCount,
    groups: tallyMatchesByAttribute(plan.matches, 'GroupName'),
  }
}

/** Sammelt rekursiv alle Ordner-IDs ab einem Startordner ein. */
async function collectFolderIds(
  provider: StorageProvider,
  startId: string,
  recursive: boolean,
): Promise<string[]> {
  const result: string[] = [startId]
  if (!recursive) return result

  const queue = [startId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const items = await provider.listItemsById(current)
    for (const it of items) {
      if (it.type === 'folder') {
        result.push(it.id)
        queue.push(it.id)
      }
    }
  }
  return result
}

async function run(options: Options): Promise<void> {
  const provider = await getServerProvider(options.userEmail, options.libraryId)
  const folderIds = await collectFolderIds(provider, options.folderId, options.recursive)

  const results: FolderResult[] = []
  for (const folderId of folderIds) {
    const result = await processFolder(provider, options, folderId)
    if (result) results.push(result)
  }

  // ── Legende ─────────────────────────────────────────────────────────────
  console.log('\n=== DIVA-Texture Preprocess — Legende ===')
  console.log(`Library: ${options.libraryId} · Start: ${options.folderId} · Recursive: ${options.recursive ? 'JA' : 'NEIN'} · Dry-Run: ${options.dryRun ? 'JA' : 'NEIN'}`)
  console.log(`Ordner mit Sidecar: ${results.length} von ${folderIds.length} durchsucht\n`)

  let totalMatched = 0
  let totalUnmatchedFiles = 0
  let totalUnmatchedEntries = 0
  const globalGroups = new Map<string, number>()
  for (const r of results) {
    totalMatched += r.matched
    totalUnmatchedFiles += r.unmatchedFiles.length
    totalUnmatchedEntries += r.unmatchedEntries
    for (const g of r.groups) globalGroups.set(g.value, (globalGroups.get(g.value) ?? 0) + g.count)
    console.log(`📁 ${r.folderId}`)
    console.log(`   Basecolor-Dateien: ${r.basecolorFiles} · gematcht: ${r.matched} · ohne Treffer: ${r.unmatchedFiles.length} · Sidecar-Eintraege ohne Datei: ${r.unmatchedEntries}`)
    if (r.unmatchedFiles.length > 0) {
      console.log(`   ⚠ Basecolor ohne DIVA-Info: ${r.unmatchedFiles.join(', ')}`)
    }
  }

  console.log('\n=== Summe ===')
  console.log(`Gematcht (mit DIVA-Info): ${totalMatched}`)
  console.log(`Basecolor ohne DIVA-Info: ${totalUnmatchedFiles}`)
  console.log(`Sidecar-Eintraege ohne Datei (ausgelistet?): ${totalUnmatchedEntries}`)

  // Stoffgruppen-Verteilung (primaerer Gruppen-Key fuer die spaetere Ansicht).
  const sortedGroups = Array.from(globalGroups.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (sortedGroups.length > 0) {
    console.log('\n=== Stoffgruppen-Verteilung (gematcht) ===')
    for (const [group, count] of sortedGroups) {
      console.log(`   ${group}: ${count}`)
    }
  }

  if (options.dryRun) console.log('\n(Dry-Run: es wurde NICHTS in MongoDB geschrieben.)')
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const get = (name: string): string | undefined =>
    args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]

  const libraryId = get('libraryId')
  const userEmail = process.env.USER_EMAIL || get('userEmail')

  if (!libraryId || !userEmail) {
    console.error('Fehler: --libraryId und USER_EMAIL (env) bzw. --userEmail sind erforderlich.')
    console.error('Usage: USER_EMAIL=me@example.com pnpm tsx scripts/preprocess-diva-textures.ts --libraryId=lib-123 [--folderId=root] [--recursive] [--dryRun]')
    process.exit(1)
  }

  return {
    libraryId,
    userEmail,
    folderId: get('folderId') || 'root',
    recursive: args.includes('--recursive'),
    dryRun: args.includes('--dryRun'),
  }
}

async function main(): Promise<void> {
  const options = parseArgs()
  try {
    await run(options)
    process.exit(0)
  } catch (error) {
    console.error('Preprocess fehlgeschlagen:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

if (require.main === module) {
  void main()
}

export { run as runDivaTexturePreprocess }
export type { Options as DivaTexturePreprocessOptions }
