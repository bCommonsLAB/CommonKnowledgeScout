/**
 * Reparatur: stellt zerstoerte OneDrive-Client-Secrets wieder her.
 *
 * Hintergrund: Vor dem D5-Fix (preserveMaskedSecrets, 2026-06-12) konnte ein
 * Settings-Speichern die Client-Maske '********' in die DB zurueckschreiben —
 * das echte Secret war damit weg und der OAuth-Login scheiterte mit
 * "Fehlende oder ungueltige Konfigurationsparameter: Client Secret".
 *
 * Alle OneDrive-Libraries dieses Bestands nutzen DIESELBE Azure-App
 * (gleiche tenantId + clientId). Das Skript kopiert deshalb das intakte
 * Secret einer Quell-Library in Ziel-Libraries, deren Secret maskiert ist —
 * NUR wenn tenantId und clientId exakt uebereinstimmen. Secret-Werte werden
 * nie ausgegeben.
 *
 * TROCKENLAUF ist Standard; erst --apply schreibt.
 *
 * Aufruf (Prod: MONGODB_DATABASE_NAME=common-knowledge-scout-prod voranstellen):
 *   node --import tsx scripts/restore-onedrive-client-secret.ts \
 *     --user <email> --source <library-id> [--apply]
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { connectToDatabase } from '../src/lib/mongodb-service'

const COLLECTION = process.env.MONGODB_COLLECTION_NAME ?? 'libraries'

interface LibEntry {
  id?: string
  label?: string
  type?: string
  config?: { tenantId?: string; clientId?: string; clientSecret?: string } & Record<string, unknown>
}

function parseArgs(argv: string[]): { user: string; source: string; apply: boolean } {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const user = get('--user')
  const source = get('--source')
  if (!user || !source) {
    throw new Error('Aufruf: --user <email> --source <library-id-mit-intaktem-secret> [--apply]')
  }
  return { user, source, apply: argv.includes('--apply') }
}

async function main(): Promise<void> {
  const { user, source, apply } = parseArgs(process.argv.slice(2))
  const db = await connectToDatabase()
  const coll = db.collection<{ _id?: unknown; email?: string; libraries?: LibEntry[] }>(COLLECTION)
  const doc = await coll.findOne({ email: { $regex: `^${user}$`, $options: 'i' } })
  if (!doc) throw new Error(`Kein Libraries-Dokument fuer ${user}`)

  const src = (doc.libraries ?? []).find((l) => l.id === source)
  const secret = src?.config?.clientSecret
  if (!src || !secret || secret.startsWith('*')) {
    throw new Error('Quell-Library fehlt oder ihr Secret ist selbst unbrauchbar (maskiert/leer)')
  }

  console.log(`${apply ? 'APPLY' : 'TROCKENLAUF'} — DB=${db.databaseName}, Quelle: "${src.label}"\n`)

  let patched = 0
  for (const lib of doc.libraries ?? []) {
    if (lib.type !== 'onedrive' || lib.id === source) continue
    const cfg = lib.config ?? {}
    const broken = !cfg.clientSecret || cfg.clientSecret.startsWith('*')
    if (!broken) {
      console.log(`✓ intakt: "${lib.label}"`)
      continue
    }
    if (cfg.tenantId !== src.config?.tenantId || cfg.clientId !== src.config?.clientId) {
      console.log(`⚠ andere Azure-App — NICHT angefasst: "${lib.label}"`)
      continue
    }
    patched++
    if (apply) {
      cfg.clientSecret = secret
      lib.config = cfg
    }
    console.log(`→ ${apply ? 'wiederhergestellt' : 'wuerde wiederherstellen'}: "${lib.label}" (${lib.id})`)
  }

  if (apply && patched > 0) {
    await coll.updateOne({ _id: doc._id }, { $set: { libraries: doc.libraries } })
  }
  console.log(`\nErgebnis: ${patched} Library(s) ${apply ? 'repariert' : 'zu reparieren'}.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('Fehler:', error)
  process.exit(1)
})
