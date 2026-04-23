/**
 * @fileoverview Migration: Markdown-Bildpfade auf absolute Azure-URLs einfrieren
 *
 * @description
 * Scannt fuer eine Library alle Mongo-Shadow-Twin-Dokumente und ersetzt verbleibende relative
 * Bildpfade in Markdown-Artefakten mittels `binaryFragments` durch absolute Azure-URLs.
 * Damit werden Bestandsdokumente an die in Phase 3 etablierte deterministische Markdown-
 * Form angepasst.
 *
 * Modi:
 *  - Dry-Run (Default): zaehlt nur, was ersetzt werden wuerde, schreibt nichts.
 *  - Apply (`--apply`): schreibt die geaenderten Markdown-Strings zurueck in MongoDB.
 *
 * @usage
 * ```bash
 * # Dry-Run
 * pnpm tsx scripts/migrate-media-urls.ts --libraryId=lib-123
 *
 * # Tatsaechliches Apply
 * pnpm tsx scripts/migrate-media-urls.ts --libraryId=lib-123 --apply
 * ```
 *
 * @dependencies
 * - @/lib/repositories/shadow-twin-repo: getShadowTwinCollectionName
 * - @/lib/mongodb-service: getCollection
 * - @/lib/shadow-twin/media-persistence-service: freezeMarkdownImageUrls
 */

import { getCollection } from '@/lib/mongodb-service'
import { getShadowTwinCollectionName } from '@/lib/repositories/shadow-twin-repo'
import { migrateDocumentImages } from '@/lib/shadow-twin/migrate-document-images'

interface MigrationArgs {
  libraryId: string
  apply: boolean
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.libraryId) {
    console.error('Usage: tsx scripts/migrate-media-urls.ts --libraryId=<id> [--apply]')
    process.exit(1)
  }

  const collectionName = getShadowTwinCollectionName(args.libraryId)
  const col = await getCollection<Record<string, unknown>>(collectionName)
  const cursor = col.find({ libraryId: args.libraryId })

  let docsScanned = 0
  let docsChanged = 0
  let totalReplacements = 0
  let totalUnresolved = 0

  console.log(`[migrate-media-urls] Library=${args.libraryId} mode=${args.apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`[migrate-media-urls] Collection=${collectionName}`)

  for await (const doc of cursor) {
    docsScanned++
    const { changed, newDoc, stats } = migrateDocumentImages(doc)
    if (changed) {
      docsChanged++
      totalReplacements += stats.totalReplacements
      totalUnresolved += stats.unresolved.length
      console.log(
        `[migrate-media-urls] sourceId=${stats.sourceId} ` +
          `scanned=${stats.artifactsScanned} changed=${stats.artifactsChanged} ` +
          `replacements=${stats.totalReplacements} unresolved=${stats.unresolved.length}`,
      )
      if (args.apply) {
        await col.updateOne(
          { _id: doc._id as unknown as never },
          { $set: { artifacts: newDoc.artifacts, updatedAt: newDoc.updatedAt } },
        )
      }
    }
  }

  console.log(
    `[migrate-media-urls] DONE docsScanned=${docsScanned} docsChanged=${docsChanged} ` +
      `replacements=${totalReplacements} unresolved=${totalUnresolved} ` +
      (args.apply ? 'CHANGES PERSISTED' : 'NO CHANGES PERSISTED (dry-run)'),
  )
  process.exit(0)
}

function parseArgs(argv: string[]): MigrationArgs {
  const out: MigrationArgs = { libraryId: '', apply: false }
  for (const a of argv) {
    const m = a.match(/^--libraryId=(.+)$/)
    if (m) out.libraryId = m[1]
    if (a === '--apply') out.apply = true
  }
  return out
}

main().catch((err) => {
  console.error('[migrate-media-urls] FATAL', err)
  process.exit(2)
})
