/**
 * @fileoverview Analyse + Reparatur: uneinheitliche `lv_bewertung`-Schluessel
 * einer Klimamassnahmen-Library auf die kanonischen snake_case-Werte bringen.
 *
 * @description
 * Befund 2026-07-09 (606 Prod-Docs): der Facetten-Filter zeigt doppelte
 * Schluessel, weil einzelne Dokumente Freitext-Varianten tragen:
 *   "Im Klimaplan enthalten" (1x)  -> "im_klimaplan"
 *   "nicht umsetzbar"        (11x) -> "nicht_umsetzbar"
 * Der Wert liegt IDENTISCH top-level UND in `docMetaJson.lv_bewertung`
 * (verifiziert, 0 Drift-Faelle) — beide Stellen werden gepatcht.
 *
 * Sicherheit (Muster rescue-source-favorites.ts):
 * - DEFAULT = ANALYSE (read-only). Schreiben nur mit `--apply`.
 * - `--db=<name>` und `--libraryId=<id>` sind PFLICHT (kein stiller Default).
 * - Vor dem Schreiben wird ein Backup der betroffenen Docs (fileId + alte
 *   Werte) nach `backups/lv-bewertung-<timestamp>.json` geschrieben.
 * - Idempotent: bereits kanonische Werte werden nicht angefasst.
 * - MONGODB_URI wird niemals geloggt.
 *
 * GRENZE (wie Backfill 2026-07-07): patcht NUR MongoDB, nicht das
 * Storage-Frontmatter der Quelldateien. Ein erneuter Voll-Reimport wuerde die
 * Freitext-Werte wieder einschleppen; fuer den Galerie-/Facetten-Pfad ist
 * Mongo die Quelle der Wahrheit.
 *
 * @usage
 *   pnpm tsx scripts/normalize-lv-bewertung.ts --db=<name> --libraryId=<id>          # Analyse
 *   pnpm tsx scripts/normalize-lv-bewertung.ts --db=<name> --libraryId=<id> --apply  # Reparatur
 *
 * @dependencies
 * - Env: MONGODB_URI (Instanz, identisch zu .env)
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { MongoClient, type Document } from 'mongodb'
import * as fs from 'fs'
import * as path from 'path'

/** Kanonisierung: Freitext-Variante -> snake_case-Schluessel. */
const LV_BEWERTUNG_MAPPING: Record<string, string> = {
  'Im Klimaplan enthalten': 'im_klimaplan',
  'nicht umsetzbar': 'nicht_umsetzbar',
}

/** Bekannte kanonische Werte (zur Vollstaendigkeits-Kontrolle im Report). */
const CANONICAL_VALUES = new Set([
  'im_klimaplan', 'in_fachplaenen', 'in_umsetzung', 'neu_umsetzbar',
  'nicht_umsetzbar', 'unklar', 'vertieft_pruefen',
])

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

async function main(): Promise<void> {
  const dbName = getArg('db')
  const libraryId = getArg('libraryId')
  const apply = process.argv.includes('--apply')
  if (!dbName || !libraryId) {
    console.error('Pflicht-Argumente fehlen: --db=<name> --libraryId=<id> [--apply]')
    process.exit(1)
  }
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI ist nicht gesetzt (.env)')

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const col = client.db(dbName).collection<Document>(`doc_meta__${libraryId}`)

    // Bestand + betroffene Docs erheben (Quelle der Wahrheit: docMetaJson).
    const rows = await col
      .find({ kind: 'meta', libraryId })
      .project({ _id: 1, fileId: 1, lv_bewertung: 1, 'docMetaJson.lv_bewertung': 1 })
      .toArray()

    const counts = new Map<string, number>()
    const affected: Array<{ _id: unknown; fileId: string; old: string; neu: string }> = []
    for (const r of rows) {
      const value = (r.docMetaJson as Document | undefined)?.lv_bewertung ?? r.lv_bewertung
      if (typeof value !== 'string') continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
      const neu = LV_BEWERTUNG_MAPPING[value]
      if (neu) affected.push({ _id: r._id, fileId: String(r.fileId), old: value, neu })
    }

    console.log(`Docs gesamt: ${rows.length}`)
    console.log('Wert-Verteilung:')
    for (const [k, v] of [...counts.entries()].sort()) {
      const marker = LV_BEWERTUNG_MAPPING[k] ? ` -> wird zu "${LV_BEWERTUNG_MAPPING[k]}"` : CANONICAL_VALUES.has(k) ? '' : '  (UNBEKANNT — nicht im Mapping!)'
      console.log(`  ${JSON.stringify(k)}: ${v}${marker}`)
    }
    console.log(`Zu normalisieren: ${affected.length} Docs`)

    if (!apply) {
      console.log('\nANALYSE-Modus (kein Schreiben). Reparatur mit --apply.')
      return
    }
    if (affected.length === 0) {
      console.log('Nichts zu tun — alle Werte bereits kanonisch.')
      return
    }

    // Backup der alten Werte (Wiederherstellbarkeit).
    const backupDir = path.join(process.cwd(), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const backupFile = path.join(backupDir, `lv-bewertung-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(backupFile, JSON.stringify({ dbName, libraryId, mapping: LV_BEWERTUNG_MAPPING, affected }, null, 2), 'utf8')
    console.log(`Backup geschrieben: ${backupFile}`)

    // Patch: top-level UND docMetaJson (verifiziert identisch, 0 Drift).
    let modified = 0
    for (const [oldValue, newValue] of Object.entries(LV_BEWERTUNG_MAPPING)) {
      const res = await col.updateMany(
        { kind: 'meta', libraryId, 'docMetaJson.lv_bewertung': oldValue },
        { $set: { lv_bewertung: newValue, 'docMetaJson.lv_bewertung': newValue } },
      )
      console.log(`"${oldValue}" -> "${newValue}": ${res.modifiedCount} Docs`)
      modified += res.modifiedCount
    }
    console.log(`Fertig: ${modified} Docs normalisiert.`)
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('FEHLER:', e instanceof Error ? e.message : e)
  process.exit(1)
})
