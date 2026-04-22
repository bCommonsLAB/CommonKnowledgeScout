/**
 * @fileoverview Cleanup: Verwirft alle bestehenden Translations (Legacy + Neu)
 *
 * @description
 * Dieses Skript ist die explizite Alternative zur Migration: statt die alte
 * `translations`-Collection in `docMetaJson.translations` zu kopieren, werden
 * BEIDE Datenquellen gelöscht. Damit beginnt der neue Übersetzungs-Workflow
 * mit einer sauberen Datenbasis – beim nächsten Publish werden Übersetzungen
 * über `phase-translations` neu erzeugt.
 *
 * Schritte:
 *  1. Drop der Legacy-Collection `translations` (1 Operation, deletet alle 25
 *     alten Cache-Einträge auf einen Schlag).
 *  2. Pro Library-Vector-Collection: `$unset` auf
 *     `docMetaJson.translations`, `docMetaJson.translationStatus`,
 *     `docMetaJson.translationErrors` für alle `kind: 'meta'`-Dokumente.
 *  3. Bewusst NICHT angefasst: `docMetaJson.publication` – ein bereits
 *     publiziertes Dokument bleibt publiziert, lediglich der Translation-Cache
 *     ist leer.
 *
 * @usage
 * ```powershell
 * # Dry-Run (zeigt nur, was gemacht würde, schreibt nichts):
 * pnpm tsx scripts/discard-translations.ts --dryRun
 *
 * # Echter Cleanup:
 * pnpm tsx scripts/discard-translations.ts
 *
 * # Optional: nur eine Library aufräumen
 * pnpm tsx scripts/discard-translations.ts --libraryId=<uuid>
 * ```
 */

import { getCollection } from '@/lib/mongodb-service'
import type { UserLibraries } from '@/lib/services/library-service'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import type { Library } from '@/types/library'
import type { Document } from 'mongodb'

interface CleanupOptions {
  dryRun: boolean
  libraryId?: string
}

interface CleanupCounters {
  legacyCollectionExisted: boolean
  legacyDocsDeleted: number
  librariesProcessed: number
  metaDocsCleared: number
  errors: number
}

/** CLI-Argumente parsen (--dryRun, --libraryId=...). */
function parseArgs(argv: string[]): CleanupOptions {
  const opts: CleanupOptions = { dryRun: false }
  for (const arg of argv.slice(2)) {
    if (arg === '--dryRun') opts.dryRun = true
    else if (arg.startsWith('--libraryId=')) opts.libraryId = arg.split('=')[1]
  }
  return opts
}

async function main() {
  const opts = parseArgs(process.argv)
  console.log('='.repeat(80))
  console.log('Cleanup: alle Translations verwerfen (Legacy + Neu)')
  console.log('='.repeat(80))
  console.log(`Dry-Run: ${opts.dryRun ? 'JA' : 'NEIN'}`)
  if (opts.libraryId) console.log(`Filter Library-ID: ${opts.libraryId}`)
  console.log('='.repeat(80))

  const counters: CleanupCounters = {
    legacyCollectionExisted: false,
    legacyDocsDeleted: 0,
    librariesProcessed: 0,
    metaDocsCleared: 0,
    errors: 0,
  }

  // ──────────────────────────────────────────────────────────────────────
  // 1) Legacy-Collection 'translations' droppen
  // ──────────────────────────────────────────────────────────────────────
  // Wir nutzen countDocuments + drop, damit das Reporting genau ist.
  try {
    const transCol = await getCollection<Document>('translations')
    const legacyCount = await transCol.countDocuments({})
    counters.legacyCollectionExisted = legacyCount > 0
    counters.legacyDocsDeleted = legacyCount
    console.log(`Legacy 'translations'-Collection: ${legacyCount} Eintraege gefunden.`)
    if (!opts.dryRun && legacyCount > 0) {
      await transCol.drop()
      console.log("  -> Collection 'translations' gedroppt.")
    } else if (opts.dryRun) {
      console.log("  -> [dryRun] wuerde Collection 'translations' droppen.")
    }
  } catch (err) {
    counters.errors++
    console.error(
      "[discard] Fehler beim Bearbeiten der 'translations'-Collection:",
      err instanceof Error ? err.message : err,
    )
  }

  // ──────────────────────────────────────────────────────────────────────
  // 2) Alle Library-Vector-Collections nach Translation-Feldern aufraeumen
  // ──────────────────────────────────────────────────────────────────────
  // Library-Source-of-Truth ist die gleiche Collection, die der LibraryService
  // benutzt: process.env.MONGODB_COLLECTION_NAME (Default 'libraries').
  const libCollectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries'
  console.log(`\nLese Libraries aus Collection '${libCollectionName}'...`)

  const libsCol = await getCollection<UserLibraries>(libCollectionName)
  const allUserLibs = await libsCol.find({}).toArray()

  // Dedupe – die gleiche libraryId kann theoretisch in mehreren userLibraries
  // Dokumenten auftauchen.
  const libraries: Library[] = []
  for (const ul of allUserLibs) {
    for (const lib of ul.libraries ?? []) {
      if (opts.libraryId && lib.id !== opts.libraryId) continue
      if (!libraries.some((l) => l.id === lib.id)) {
        libraries.push(lib as unknown as Library)
      }
    }
  }
  console.log(`Gefundene Libraries: ${libraries.length}`)

  for (const lib of libraries) {
    let collectionName: string
    try {
      collectionName = getCollectionNameForLibrary(lib)
    } catch (err) {
      // Library ohne konfigurierte Vector-Collection – ueberspringen.
      console.warn(
        `[discard] Library '${lib.id}' hat keine Vector-Collection konfiguriert, ueberspringe.`,
        err instanceof Error ? err.message : err,
      )
      continue
    }

    try {
      const col = await getCollection<Document>(collectionName)
      // Filter: nur Meta-Dokumente, die ueberhaupt mind. eines der drei
      // Translation-Felder gesetzt haben (sonst ist updateMany unnoetiger
      // Schreibtraffic).
      const filter = {
        kind: 'meta',
        $or: [
          { 'docMetaJson.translations': { $exists: true } },
          { 'docMetaJson.translationStatus': { $exists: true } },
          { 'docMetaJson.translationErrors': { $exists: true } },
        ],
      }
      const matchCount = await col.countDocuments(filter)
      counters.librariesProcessed++

      if (matchCount === 0) {
        console.log(
          `  - Library '${lib.id}' (${collectionName}): keine Translations vorhanden.`,
        )
        continue
      }

      if (opts.dryRun) {
        console.log(
          `  - [dryRun] Library '${lib.id}' (${collectionName}): wuerde ${matchCount} Meta-Dokumente bereinigen.`,
        )
        counters.metaDocsCleared += matchCount
        continue
      }

      const res = await col.updateMany(filter, {
        $unset: {
          'docMetaJson.translations': '',
          'docMetaJson.translationStatus': '',
          'docMetaJson.translationErrors': '',
        },
      })
      counters.metaDocsCleared += res.modifiedCount
      console.log(
        `  - Library '${lib.id}' (${collectionName}): ${res.modifiedCount} Meta-Dokumente bereinigt.`,
      )
    } catch (err) {
      counters.errors++
      console.error(
        `[discard] Fehler bei Library '${lib.id}' (${collectionName}):`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 3) Zusammenfassung
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('Ergebnis:')
  console.table({
    'Legacy "translations" gedroppt': counters.legacyCollectionExisted ? 'ja' : 'nein',
    'Legacy-Eintraege geloescht': counters.legacyDocsDeleted,
    'Libraries verarbeitet': counters.librariesProcessed,
    'Meta-Dokumente bereinigt': counters.metaDocsCleared,
    Fehler: counters.errors,
  })
}

main()
  .then(() => {
    console.log('Cleanup beendet.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Cleanup fehlgeschlagen:', err)
    process.exit(1)
  })
