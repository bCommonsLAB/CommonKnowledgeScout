/**
 * Read-only-Inspektion: Welche Basis-Felder fehlen in den Meta-Docs der
 * Oldies-Library und welche Kandidaten-Felder existieren, aus denen sich
 * `source`/`date`/`authors`/`tags` deterministisch ableiten liessen?
 *
 * Aufruf:  node --import tsx scripts/inspect-base-fields.ts
 */
import { MongoClient } from 'mongodb'
import * as dotenv from 'dotenv'

dotenv.config()

const LIBRARY_ID = '5a28b4bd-c498-41f9-8d63-e93a0d05d7ca'
const COLLECTION = `doc_meta__${LIBRARY_ID}`
const BASE = ['title', 'date', 'authors', 'language', 'source', 'tags'] as const

function short(v: unknown): string {
  const s = JSON.stringify(v)
  return s && s.length > 60 ? `${s.slice(0, 57)}...` : String(s)
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
      .project({ fileId: 1, fileName: 1, docMetaJson: 1 })
      .toArray()

    console.log(`Meta-Docs gesamt: ${docs.length}\n`)
    const candidateKeys = new Map<string, number>()

    for (const d of docs) {
      const json = (d.docMetaJson ?? {}) as Record<string, unknown>
      const missing = BASE.filter((f) => {
        const v = json[f]
        if (v === undefined || v === null) return true
        if (typeof v === 'string' && v.trim() === '') return true
        if (Array.isArray(v) && v.length === 0) return true
        return false
      })
      if (missing.length === 0) continue

      // Kandidaten: Felder, die inhaltlich Quelle/Datum/Autoren liefern koennten.
      const interesting = Object.keys(json).filter((k) =>
        /source|url|date|year|author|speaker|creator|origin|event|channel|tag/i.test(k),
      )
      for (const k of interesting) candidateKeys.set(k, (candidateKeys.get(k) ?? 0) + 1)

      console.log(`${d.fileName}  [fehlt: ${missing.join(', ')}]`)
      for (const k of interesting) console.log(`   ${k} = ${short(json[k])}`)
    }

    console.log('\nKandidaten-Felder (Haeufigkeit in Docs mit Befund):')
    for (const [k, n] of [...candidateKeys.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${n}`)
    }
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('FEHLER:', err instanceof Error ? err.message : err)
  process.exit(1)
})
