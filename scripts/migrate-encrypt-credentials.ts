/**
 * Migration: verschluesselt bestehende KLARTEXT-Storage-Zugangsdaten in der
 * `libraries`-Collection (Nextcloud-App-Passwort, OAuth-Client-Secret/-Tokens,
 * API-Keys, Azure-Connection-String) mit AES-256-GCM.
 *
 * Eigenschaften:
 * - Idempotent: bereits verschluesselte Werte (`enc:v1:`) werden uebersprungen.
 * - Loggt NIE Secret-Werte – nur Zaehler.
 * - Benoetigt `CREDENTIALS_ENCRYPTION_KEY` (sonst expliziter Abbruch).
 *
 * Usage:
 *   CREDENTIALS_ENCRYPTION_KEY=... pnpm tsx scripts/migrate-encrypt-credentials.ts [--dry-run]
 */

import { connectToDatabase } from '../src/lib/mongodb-service'
import {
  LIBRARY_SECRET_FIELDS,
  encryptLibrarySecrets,
} from '../src/lib/security/library-credentials'
import { isEncryptedSecret } from '../src/lib/security/credential-cipher'
import type { Library } from '../src/types/library'

interface UserLibrariesDoc {
  _id?: unknown
  email?: string
  libraries?: Library[]
}

const COLLECTION = process.env.MONGODB_COLLECTION_NAME || 'libraries'
const DRY_RUN = process.argv.includes('--dry-run')

/**
 * Zaehlt vorhandene, noch UNVERSCHLUESSELTE (Legacy-Klartext) Secret-Felder.
 * Dient nur der Entscheidung „muss dieses Dokument geschrieben werden?".
 */
function countPlaintextSecrets(library: Library): number {
  const config = library.config as Record<string, unknown> | undefined
  if (!config) return 0

  let count = 0
  for (const field of LIBRARY_SECRET_FIELDS) {
    const value =
      field.kind === 'top'
        ? config[field.key]
        : ((config[field.parent] as Record<string, unknown> | undefined)?.[field.key])
    if (typeof value === 'string' && value !== '' && !isEncryptedSecret(value)) {
      count++
    }
  }
  return count
}

async function main(): Promise<void> {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    console.error(
      'CREDENTIALS_ENCRYPTION_KEY ist nicht gesetzt – Abbruch. ' +
        'Schluessel generieren: `openssl rand -base64 32`.',
    )
    process.exit(1)
  }

  const db = await connectToDatabase()
  const col = db.collection<UserLibrariesDoc>(COLLECTION)
  const docs = await col.find({}).toArray()

  let docsScanned = 0
  let docsUpdated = 0
  let secretsEncrypted = 0

  for (const doc of docs) {
    docsScanned++
    if (!Array.isArray(doc.libraries) || doc.libraries.length === 0) continue

    const plaintextInDoc = doc.libraries.reduce(
      (sum, lib) => sum + countPlaintextSecrets(lib),
      0,
    )
    if (plaintextInDoc === 0) continue

    const encryptedLibraries = doc.libraries.map(encryptLibrarySecrets)
    secretsEncrypted += plaintextInDoc

    console.log(
      `[migrate] ${doc.email ?? '(unbekannt)'}: ${plaintextInDoc} Klartext-Secret(s) ` +
        `${DRY_RUN ? 'wuerden verschluesselt' : 'verschluesselt'}.`,
    )

    if (!DRY_RUN) {
      await col.updateOne(
        { _id: doc._id },
        { $set: { libraries: encryptedLibraries } },
      )
    }
    docsUpdated++
  }

  console.log(
    `\n[migrate] Fertig${DRY_RUN ? ' (DRY-RUN, nichts geschrieben)' : ''}: ` +
      `${docsScanned} Dokument(e) geprueft, ${docsUpdated} betroffen, ` +
      `${secretsEncrypted} Secret(s) verschluesselt.`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error('[migrate] Fehler:', error instanceof Error ? error.message : error)
  process.exit(1)
})
