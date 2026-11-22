/**
 * Entfernt den ausgebauten Schalter `publicPublishing.stageEnabled` aus den
 * gespeicherten Library-Konfigurationen (Plan `teppich-der-dokumente`, Welle
 * T0b: Die Common-UX-Buehne ist ausgebaut, das Feld liest niemand mehr).
 *
 * Bewusst eigenstaendig (mongodb-Treiber + .env, dieselbe DB wie der Server).
 * Ohne `--apply` wird nur gezaehlt und gezeigt, nichts geschrieben.
 *
 * Aufruf:  node --import tsx scripts/remove-stage-enabled.ts            (Probelauf)
 *          node --import tsx scripts/remove-stage-enabled.ts --apply    (schreibt)
 */

import { MongoClient, type Document } from 'mongodb'
import * as dotenv from 'dotenv'

dotenv.config()

const APPLY = process.argv.includes('--apply')
const FELD = 'config.publicPublishing.stageEnabled'

interface StoredLibrary {
  id?: string
  label?: string
  config?: { publicPublishing?: { stageEnabled?: unknown; slugName?: string } }
}

interface UserLibrariesDoc {
  email?: string
  libraries?: StoredLibrary[]
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DATABASE_NAME
  const collectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries'
  if (!uri) throw new Error('MONGODB_URI fehlt (.env nicht geladen?)')
  if (!dbName) throw new Error('MONGODB_DATABASE_NAME fehlt')

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const col = client.db(dbName).collection<UserLibrariesDoc>(collectionName)
    const filter: Document = { libraries: { $elemMatch: { [FELD]: { $exists: true } } } }
    const docs = await col.find(filter, { projection: { libraries: 1 } }).toArray()

    let betroffen = 0
    let eingeschaltet = 0
    for (const doc of docs) {
      for (const lib of doc.libraries ?? []) {
        const pub = lib.config?.publicPublishing
        if (!pub || !('stageEnabled' in pub)) continue
        betroffen++
        if (pub.stageEnabled === true) eingeschaltet++
        console.log(`  ${lib.id ?? '(ohne id)'}  slug=${pub.slugName ?? '-'}  stageEnabled=${String(pub.stageEnabled)}`)
      }
    }
    console.log(`[remove-stage-enabled] DB=${dbName} Libraries mit Feld: ${betroffen}, davon eingeschaltet: ${eingeschaltet}`)

    if (!APPLY) {
      console.log('[remove-stage-enabled] Probelauf, nichts geschrieben. Mit --apply entfernen.')
      return
    }
    if (betroffen === 0) return

    const res = await col.updateMany(
      filter,
      { $unset: { [`libraries.$[lib].${FELD}`]: '' } },
      { arrayFilters: [{ [`lib.${FELD}`]: { $exists: true } }] },
    )
    console.log(`[remove-stage-enabled] geschrieben: Dokumente geaendert=${res.modifiedCount} (gefunden=${res.matchedCount})`)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[remove-stage-enabled] FEHLER:', err instanceof Error ? err.message : err)
  process.exit(1)
})
