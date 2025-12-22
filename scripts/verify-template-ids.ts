/**
 * @fileoverview Verify Template IDs in MongoDB (read-only)
 *
 * @description
 * Dieses Script macht KEINE Änderungen an der Datenbank.
 * Es hilft beim Debugging der Template-ID-Migration:
 * - Zählt Templates mit alter _id-Struktur (ohne ':') vs neuer Struktur (mit ':')
 * - Prüft optional konkrete Template-Namen in einer Library:
 *   - existiert als neue _id: `${libraryId}:${name}`
 *   - existiert als alte _id: `${name}` (mit/ohne libraryId Filter)
 *
 * @usage
 * pnpm tsx scripts/verify-template-ids.ts
 * pnpm tsx scripts/verify-template-ids.ts --libraryId=<id> --name=Session_analyze_en --name=testimonial
 */

import { getCollection } from '@/lib/mongodb-service'
import type { TemplateDocument } from '@/lib/templates/template-types'

interface Options {
  libraryId?: string
  names: string[]
}

function parseArgs(argv: string[]): Options {
  const names: string[] = []
  let libraryId: string | undefined

  for (const arg of argv) {
    if (arg.startsWith('--libraryId=')) {
      libraryId = arg.split('=')[1]
      continue
    }
    if (arg.startsWith('--name=')) {
      const n = arg.split('=')[1]
      if (n) names.push(n)
      continue
    }
  }

  return { libraryId, names }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const col = await getCollection<TemplateDocument>('templates')

  const all = await col.find({}, { projection: { _id: 1, name: 1, libraryId: 1 } }).toArray()
  const oldStyle = all.filter(t => !String(t._id).includes(':'))
  const newStyle = all.filter(t => String(t._id).includes(':'))

  console.log('='.repeat(80))
  console.log('Verify Template IDs (read-only)')
  console.log('='.repeat(80))
  console.log(`[Verify] Gesamt Templates: ${all.length}`)
  console.log(`[Verify] Alte _id-Struktur (ohne ':'): ${oldStyle.length}`)
  console.log(`[Verify] Neue _id-Struktur (mit ':'): ${newStyle.length}`)
  console.log('')

  if (!options.libraryId || options.names.length === 0) {
    console.log('[Verify] Tipp: Für Detail-Checks nutze:')
    console.log('  pnpm tsx scripts/verify-template-ids.ts --libraryId=<id> --name=<templateName> [--name=...]')
    console.log('')
  }

  if (options.libraryId && options.names.length > 0) {
    const libraryId = options.libraryId
    console.log(`[Verify] Detail-Check: libraryId="${libraryId}"`)
    for (const name of options.names) {
      const newId = `${libraryId}:${name}`

      const existsNewById = await col.findOne({ _id: newId }, { projection: { _id: 1, name: 1, libraryId: 1 } })
      const existsOldByIdAndLibrary = await col.findOne(
        { _id: name, libraryId },
        { projection: { _id: 1, name: 1, libraryId: 1 } }
      )
      const existsAnyByNameAndLibrary = await col.findOne(
        { name, libraryId },
        { projection: { _id: 1, name: 1, libraryId: 1 } }
      )

      console.log(`- name="${name}"`)
      console.log(`  - newId="${newId}" exists: ${existsNewById ? 'JA' : 'NEIN'}`)
      console.log(`  - oldId="${name}" with libraryId exists: ${existsOldByIdAndLibrary ? 'JA' : 'NEIN'}`)
      console.log(`  - any doc with (libraryId,name) exists: ${existsAnyByNameAndLibrary ? `JA (_id=${existsAnyByNameAndLibrary._id})` : 'NEIN'}`)
    }
    console.log('')
  }
}

main().catch(err => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[Verify] Fehler:', msg)
  process.exit(1)
})


