/**
 * Diagnose-Script (read-only): listet die Libraries eines Users mit ihrer echten
 * ID auf. Nötig, weil neue Libraries im UI eine zufällige UUID bekommen — diese
 * ID braucht das Seed-Script (TEST_LIBRARY_ID), damit die Test-Templates an der
 * im UI angelegten Library hängen.
 *
 * Usage:
 *   TEST_LIBRARY_USER=peter.aichner@crystal-design.com pnpm tsx scripts/list-libraries.ts
 */

import { connectToDatabase } from '../src/lib/mongodb-service'

const USER_EMAIL = process.env.TEST_LIBRARY_USER ?? ''
const COLLECTION = process.env.MONGODB_COLLECTION_NAME ?? 'libraries'

interface LibraryLite {
  id?: string
  label?: string
  type?: string
}

interface UserLibrariesDoc {
  email?: string
  libraries?: LibraryLite[]
}

async function main(): Promise<void> {
  const db = await connectToDatabase()
  const coll = db.collection<UserLibrariesDoc>(COLLECTION)
  const docs = USER_EMAIL
    ? await coll.find({ email: { $regex: `^${USER_EMAIL}$`, $options: 'i' } }).toArray()
    : await coll.find({}).toArray()

  if (docs.length === 0) {
    console.log(`Keine Libraries gefunden${USER_EMAIL ? ` für ${USER_EMAIL}` : ''}.`)
    process.exit(0)
  }

  for (const doc of docs) {
    console.log(`\nUser: ${doc.email ?? '(unbekannt)'}`)
    for (const lib of doc.libraries ?? []) {
      console.log(`  • id=${lib.id ?? '(keine)'}   label="${lib.label ?? ''}"   type=${lib.type ?? '?'}`)
    }
  }
  process.exit(0)
}

main().catch((error) => {
  console.error('Fehler:', error)
  process.exit(1)
})
