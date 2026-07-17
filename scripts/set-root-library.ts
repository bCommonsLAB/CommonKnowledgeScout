/**
 * Setzt die globale Root-Library (E7): `/` rendert die Landingpage dieser Library.
 * Bewusst eigenstaendig (mongodb-Treiber + .env, dieselbe DB wie der Dev-Server).
 *
 * Aufruf:  node --import tsx scripts/set-root-library.ts [slug]
 *          (ohne Argument: Default 'oldiesforfuture')
 *          node --import tsx scripts/set-root-library.ts none   -> leert die Einstellung
 *          (`/` zeigt dann wieder die KnowledgeScout-Uebersicht)
 */

import { MongoClient } from 'mongodb'
import * as dotenv from 'dotenv'

dotenv.config()

const RAW_ARG = process.argv[2] || 'oldiesforfuture'
// 'none' (oder leer) leert die Einstellung -> `/` faellt auf die KnowledgeScout-Uebersicht zurueck.
const SLUG: string | null = RAW_ARG === 'none' ? null : RAW_ARG
const COLLECTION = 'app_config'
const SINGLETON_ID = 'global'

interface AppConfigDoc {
  _id: string
  rootLibrarySlug?: string | null
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DATABASE_NAME
  if (!uri) throw new Error('MONGODB_URI fehlt (.env nicht geladen?)')
  if (!dbName) throw new Error('MONGODB_DATABASE_NAME fehlt')

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const col = client.db(dbName).collection<AppConfigDoc>(COLLECTION)
    const res = await col.updateOne(
      { _id: SINGLETON_ID },
      { $set: { rootLibrarySlug: SLUG } },
      { upsert: true },
    )
    console.log(
      `[set-root-library] DB=${dbName} rootLibrarySlug=${SLUG === null ? '(geleert)' : `'${SLUG}'`} ` +
        `matched=${res.matchedCount} upserted=${res.upsertedId ? 'ja' : 'nein'} modified=${res.modifiedCount}`,
    )
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[set-root-library] FEHLER:', err instanceof Error ? err.message : err)
  process.exit(1)
})
