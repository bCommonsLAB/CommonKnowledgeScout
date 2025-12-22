/**
 * @fileoverview Restore templates into MongoDB from JSON export (safe upsert)
 *
 * @description
 * Dieses Script ist dafür gedacht, Templates nach einem fehlerhaften Migrationslauf
 * wiederherzustellen, sofern du noch ein JSON-Export (Backup) der Template-Dokumente hast.
 *
 * Es schreibt ausschließlich Dokumente mit der neuen _id-Struktur:
 *   _id = `${libraryId}:${name}`
 *
 * WICHTIG:
 * - Es löscht nichts.
 * - Es überschreibt nichts (wenn _id bereits existiert, wird übersprungen).
 *
 * @usage
 * pnpm tsx scripts/restore-templates-from-json.ts --file=./backup.json --dryRun
 * pnpm tsx scripts/restore-templates-from-json.ts --file=./backup.json
 *
 * Unterstützte JSON-Formate:
 * - einzelnes TemplateDocument
 * - Array<TemplateDocument>
 *
 * Datumsfelder:
 * - unterstützt ISO-Strings
 * - unterstützt Mongo-Export-Form: { "$date": "..." }
 */

import { readFile } from 'node:fs/promises'
import { getCollection } from '@/lib/mongodb-service'
import type { TemplateDocument } from '@/lib/templates/template-types'

type JsonDate = string | { $date: string }

type JsonTemplateDocument = Omit<TemplateDocument, 'createdAt' | 'updatedAt'> & {
  createdAt: JsonDate
  updatedAt: JsonDate
}

interface Options {
  file: string
  dryRun: boolean
}

function parseArgs(argv: string[]): Options {
  const fileArg = argv.find(a => a.startsWith('--file='))
  const file = fileArg ? fileArg.split('=')[1] : ''
  const dryRun = argv.includes('--dryRun')

  if (!file) {
    throw new Error('Missing required argument: --file=path/to/backup.json')
  }

  return { file, dryRun }
}

function toDate(d: JsonDate): Date {
  if (typeof d === 'string') return new Date(d)
  if (d && typeof d === 'object' && '$date' in d) return new Date(d.$date)
  return new Date(String(d))
}

function normalizeTemplate(t: JsonTemplateDocument): TemplateDocument {
  const createdAt = toDate(t.createdAt)
  const updatedAt = toDate(t.updatedAt)

  // _id wird IMMER neu gesetzt (neues Format)
  const newId = `${t.libraryId}:${t.name}`

  return {
    ...t,
    _id: newId,
    createdAt,
    updatedAt,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const raw = await readFile(options.file, 'utf-8')
  const parsed = JSON.parse(raw) as JsonTemplateDocument | JsonTemplateDocument[]
  const templates = Array.isArray(parsed) ? parsed : [parsed]

  const col = await getCollection<TemplateDocument>('templates')

  console.log('='.repeat(80))
  console.log('Restore templates from JSON (safe upsert)')
  console.log('='.repeat(80))
  console.log(`[Restore] File: ${options.file}`)
  console.log(`[Restore] Dry-Run: ${options.dryRun ? 'JA' : 'NEIN'}`)
  console.log(`[Restore] Templates im Backup: ${templates.length}`)
  console.log('')

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const t of templates) {
    try {
      if (!t.libraryId || !t.name || !t.user) {
        throw new Error('Template missing required fields (libraryId/name/user)')
      }

      const normalized = normalizeTemplate(t)
      const exists = await col.findOne({ _id: normalized._id }, { projection: { _id: 1 } })
      if (exists) {
        console.log(`[Restore] SKIP exists: _id="${normalized._id}"`)
        skipped++
        continue
      }

      console.log(`[Restore] INSERT _id="${normalized._id}" (name="${normalized.name}", libraryId="${normalized.libraryId}")`)
      if (!options.dryRun) {
        await col.insertOne(normalized)
      }
      inserted++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Restore] ERROR:', msg)
      errors++
    }
  }

  console.log('')
  console.log('='.repeat(80))
  console.log(`[Restore] Ergebnis: ${inserted} inserted, ${skipped} skipped, ${errors} errors`)
  console.log('='.repeat(80))
}

main().catch(err => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[Restore] Fatal:', msg)
  process.exit(1)
})


