/**
 * Einmalige Basis-Feld-Reparatur fuer die Oldies-Library (Befund der
 * Library-Verifikation, 2026-07-20): `source` fehlt in ALLEN Meta-Docs,
 * `authors` ist in einem Doc leer.
 *
 * Entscheidung (dokumentiert in der Session): `source` = "Oldies for Future"
 * — Konvention wie in den anderen Libraries (source = herausgebende
 * Institution); alle Inhalte stammen von der Vereins-Webseite. `authors`
 * analog. Die Werte werden NUR gesetzt, wenn das Feld fehlt/leer ist
 * (kein Ueberschreiben vorhandener Werte). Gleicher Persistenz-Pfad wie
 * die Repair-Engine: `docMetaJson.<feld>` in der doc_meta-Collection.
 *
 * Read-only-Vorschau:  node --import tsx scripts/repair-oldies-base-fields.ts
 * Ausfuehren:          node --import tsx scripts/repair-oldies-base-fields.ts --apply
 */
import { MongoClient } from 'mongodb'
import * as dotenv from 'dotenv'

dotenv.config()

const LIBRARY_ID = process.env.REPAIR_LIBRARY_ID || '5a28b4bd-c498-41f9-8d63-e93a0d05d7ca'
const COLLECTION = process.env.REPAIR_COLLECTION || `doc_meta__${LIBRARY_ID}`
const SOURCE_VALUE = 'Oldies for Future'
const AUTHORS_VALUE = ['Oldies for Future']

const APPLY = process.argv.includes('--apply')

/** Fehlend im Sinne der Verifikation (hasValue in document-check.ts). */
function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DATABASE_NAME
  if (!uri || !dbName) throw new Error('MONGODB_URI/MONGODB_DATABASE_NAME fehlt')

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const col = client.db(dbName).collection(COLLECTION)
    const docs = await col
      .find({ kind: 'meta', libraryId: LIBRARY_ID })
      .project<{ _id: string; fileId: string; fileName?: string; docMetaJson?: Record<string, unknown> }>({
        fileId: 1,
        fileName: 1,
        'docMetaJson.source': 1,
        'docMetaJson.authors': 1,
      })
      .toArray()

    let patched = 0
    for (const d of docs) {
      const json = d.docMetaJson ?? {}
      const set: Record<string, unknown> = {}
      if (isMissing(json.source)) set['docMetaJson.source'] = SOURCE_VALUE
      if (isMissing(json.authors)) set['docMetaJson.authors'] = AUTHORS_VALUE
      if (Object.keys(set).length === 0) continue

      patched += 1
      console.log(`${APPLY ? 'PATCH' : 'WUERDE PATCHEN'}: ${d.fileName ?? d.fileId} -> ${Object.keys(set).join(', ')}`)
      // doc_meta nutzt string-_ids (z.B. "<fileId>-meta"), nicht ObjectId
      if (APPLY) await col.updateOne({ _id: d._id as never }, { $set: set })
    }

    console.log(
      `\n${docs.length} Meta-Docs geprueft, ${patched} ${APPLY ? 'gepatcht' : 'zu patchen'} (DB=${dbName}, Collection=${COLLECTION})`,
    )
    if (!APPLY) console.log('Trockenlauf — zum Ausfuehren mit --apply aufrufen.')
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[repair-oldies-base-fields] FEHLER:', err instanceof Error ? err.message : err)
  process.exit(1)
})
