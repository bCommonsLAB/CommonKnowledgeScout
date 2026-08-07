/**
 * Backfill: macht die Shadow-Twin-Config aller Bestands-Libraries EXPLIZIT.
 *
 * Hintergrund: `getShadowTwinConfig` defaultete historisch still auf
 * `primaryStore='filesystem'`; UI und fuenf API-Routen gingen dagegen von
 * Mongo aus ("Mongo ist nicht aktiv"-400er). Der Code-Default steht jetzt
 * auf 'mongo' — dieses Skript zieht die Datenbank nach, damit KEINE Library
 * mehr von Defaults abhaengt:
 *
 *   - primaryStore fehlt            → 'mongo' setzen
 *   - persistToFilesystem fehlt     → true setzen (Backup-Spiegel bleibt an)
 *   - allowFilesystemFallback fehlt → true setzen
 *
 * Explizites `primaryStore='filesystem'` wird NIE still umgestellt, nur
 * gemeldet (Daten-Migration noetig, User-Entscheid). `mode` bleibt unberuehrt.
 *
 * TROCKENLAUF ist Standard; erst `--apply` schreibt.
 *
 * Aufruf (Prod: MONGODB_DATABASE_NAME=common-knowledge-scout-prod voranstellen):
 *   node --import tsx scripts/normalize-library-shadow-twin-config.ts [--user <email>] [--apply]
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { connectToDatabase } from '../src/lib/mongodb-service'

const COLLECTION = process.env.MONGODB_COLLECTION_NAME ?? 'libraries'

interface ShadowTwinCfg {
  mode?: string
  primaryStore?: string
  persistToFilesystem?: boolean
  allowFilesystemFallback?: boolean
  cleanupFilesystemOnMigrate?: boolean
}

interface LibraryEntry {
  id?: string
  label?: string
  config?: { shadowTwin?: ShadowTwinCfg } & Record<string, unknown>
}

interface UserLibrariesDoc {
  _id?: unknown
  email?: string
  libraries?: LibraryEntry[]
}

function parseArgs(argv: string[]): { user: string | null; apply: boolean } {
  const i = argv.indexOf('--user')
  return { user: i >= 0 ? argv[i + 1] ?? null : null, apply: argv.includes('--apply') }
}

/** Liefert die Patch-Beschreibung oder null, wenn nichts fehlt. */
function computePatch(cfg: ShadowTwinCfg | undefined): { next: ShadowTwinCfg; changed: string[] } | null {
  const next: ShadowTwinCfg = { ...cfg }
  const changed: string[] = []
  if (cfg?.primaryStore === undefined) {
    next.primaryStore = 'mongo'
    changed.push("primaryStore→'mongo'")
  }
  if (cfg?.persistToFilesystem === undefined) {
    next.persistToFilesystem = true
    changed.push('persistToFilesystem→true')
  }
  if (cfg?.allowFilesystemFallback === undefined) {
    next.allowFilesystemFallback = true
    changed.push('allowFilesystemFallback→true')
  }
  return changed.length > 0 ? { next, changed } : null
}

async function main(): Promise<void> {
  const { user, apply } = parseArgs(process.argv.slice(2))
  const db = await connectToDatabase()
  const coll = db.collection<UserLibrariesDoc>(COLLECTION)
  const docs = user
    ? await coll.find({ email: { $regex: `^${user}$`, $options: 'i' } }).toArray()
    : await coll.find({}).toArray()

  console.log(`${apply ? 'APPLY' : 'TROCKENLAUF'} — ${docs.length} User-Dokument(e), DB=${db.databaseName}\n`)

  let patched = 0
  let filesystemExplicit = 0
  for (const doc of docs) {
    let docDirty = false
    for (const lib of doc.libraries ?? []) {
      const cfg = lib.config?.shadowTwin
      const label = `${doc.email ?? '?'} / "${lib.label ?? ''}" (${lib.id ?? 'keine id'})`

      if (cfg?.primaryStore === 'filesystem') {
        filesystemExplicit++
        console.log(`⚠ EXPLIZIT filesystem — NICHT angefasst: ${label}`)
        continue
      }
      const patch = computePatch(cfg)
      if (!patch) {
        console.log(`✓ vollstaendig: ${label}`)
        continue
      }
      patched++
      docDirty = true
      lib.config = { ...lib.config, shadowTwin: patch.next }
      console.log(`→ ${apply ? 'setze' : 'wuerde setzen'}: ${patch.changed.join(', ')}  bei ${label}`)
      if (cfg?.mode !== 'v2') {
        console.log(`  Hinweis: mode="${cfg?.mode ?? '(fehlt)'}" — bleibt unberuehrt (Upgrade-Button in den Settings)`)
      }
    }
    if (apply && docDirty) {
      await coll.updateOne({ _id: doc._id }, { $set: { libraries: doc.libraries } })
    }
  }

  console.log(`\nErgebnis: ${patched} Library(s) ${apply ? 'gepatcht' : 'zu patchen'}, ${filesystemExplicit}× explizit filesystem (gemeldet).`)
  process.exit(0)
}

main().catch((error) => {
  console.error('Fehler:', error)
  process.exit(1)
})
