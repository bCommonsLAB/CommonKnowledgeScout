/**
 * @fileoverview Backfill: Seite je Chunk (D7, Plan `story-dreiteilung-fragenchronik`).
 *
 * @description
 * Seit D7 bekommt jeder Chunk einer Quelle mit Seitenankern (`--- Seite N ---`)
 * beim Einlesen das Feld `page`. Bestehende Libraries haben es nicht. Dieses
 * Skript rechnet es nach — aus genau dem Text, der eingebettet wurde:
 * `buildMetadataPrefix(docMetaJson)` + Trenner + `docMetaJson.markdown`
 * (ingestion-service), gegen die `startChar`/`endChar` der Chunks.
 *
 * Grenzen: Chunks ohne Offsets und Dokumente, deren Markdown seit dem Einlesen
 * geaendert wurde, werden gemeldet und nicht geraten. Quellen ohne Anker
 * (Audio, Video, Markdown ohne Seiten) bekommen KEIN Feld — das ist korrekt.
 *
 * Sicherheit (Muster normalize-lv-bewertung.ts):
 * - DEFAULT = ANALYSE (read-only). Schreiben nur mit `--apply`.
 * - `--db=<name>` und `--collection=<vector-collection>` sind PFLICHT.
 * - Idempotent: Chunks mit `page` werden uebersprungen (`--force` rechnet sie neu).
 *
 * @usage
 *   pnpm tsx scripts/backfill-chunk-pages.ts --db=<name> --collection=<name>          # Analyse
 *   pnpm tsx scripts/backfill-chunk-pages.ts --db=<name> --collection=<name> --apply  # Schreiben
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { MongoClient, type Document } from 'mongodb'
import { splitByPages } from '@/lib/ingestion/page-split'
import { seiteFuerChunk } from '@/lib/ingestion/vector-builder'
import { buildMetadataPrefix } from '@/lib/ingestion/metadata-formatter'

/** Trenner zwischen Metadaten-Praefix und Body — identisch zu ingestion-service. */
const BODY_TRENNER = '\n\n--- Dokument-Body beginnt hier ---\n\n'

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

async function main(): Promise<void> {
  const dbName = getArg('db')
  const collectionName = getArg('collection')
  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')
  if (!dbName || !collectionName) throw new Error('Pflicht: --db=<name> --collection=<vector-collection>')
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI fehlt')

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const col = client.db(dbName).collection<Document>(collectionName)
    const metas = await col
      .find({ kind: 'meta', 'docMetaJson.markdown': { $regex: /^---\s*Seite\s*\d+\s*---\s*$/m } }, { projection: { fileId: 1, docMetaJson: 1 } })
      .toArray()
    console.log(`[backfill-chunk-pages] ${metas.length} Dokumente mit Seitenankern in ${dbName}.${collectionName}`)

    let gesetzt = 0
    let ohneOffsets = 0
    let ohneSeite = 0
    let uebersprungen = 0
    for (const meta of metas) {
      const fileId = String(meta.fileId)
      const docMetaJson = (meta.docMetaJson ?? {}) as Record<string, unknown>
      const markdown = typeof docMetaJson.markdown === 'string' ? docMetaJson.markdown.trim() : ''
      if (!markdown) continue
      const prefix = buildMetadataPrefix(docMetaJson)
      const finalMarkdown = prefix ? `${prefix}${BODY_TRENNER}${markdown}` : markdown
      const spans = splitByPages(finalMarkdown)
      const filter: Document = force ? { kind: 'chunk', fileId } : { kind: 'chunk', fileId, page: { $exists: false } }
      const chunks = await col.find(filter, { projection: { _id: 1, startChar: 1, endChar: 1, page: 1 } }).toArray()
      for (const chunk of chunks) {
        if (typeof chunk.startChar !== 'number') {
          ohneOffsets++
          continue
        }
        const page = seiteFuerChunk(spans, chunk.startChar, typeof chunk.endChar === 'number' ? chunk.endChar : undefined)
        if (page === undefined) {
          ohneSeite++
          continue
        }
        if (!force && chunk.page === page) {
          uebersprungen++
          continue
        }
        if (apply) await col.updateOne({ _id: chunk._id }, { $set: { page } })
        gesetzt++
      }
    }
    console.log(
      `[backfill-chunk-pages] ${apply ? 'geschrieben' : 'wuerde schreiben'}: ${gesetzt} · ohne Offsets: ${ohneOffsets} · vor dem ersten Anker: ${ohneSeite} · unveraendert: ${uebersprungen}`,
    )
    if (!apply) console.log('[backfill-chunk-pages] Analyse-Modus — mit --apply schreiben.')
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('[backfill-chunk-pages] Fehler:', error)
  process.exit(1)
})
