/**
 * @fileoverview Altlasten-Bereinigung: Sitzungen, die nur die Themenuebersicht
 * eroeffnet hat (D8 Sitzungsstart, Plan `story-dreiteilung-fragenchronik`).
 *
 * @description
 * Vor D8 legte der Stream fuer JEDE Anfrage ohne `chatId` einen Chat an — auch
 * fuer die Themenuebersicht (`TOC_QUESTION`). Wer nur die Uebersicht ansah,
 * hinterliess eine Sitzung mit der englischen Systemfrage als Titel; die
 * Story-Chronik zeigte sie unter „Meine Fragen". Seit D8 eroeffnet erst die
 * erste Frage der Person eine Sitzung.
 *
 * Dieses Skript findet ueber ALLE Libraries Chats mit dem Systemtitel
 * (`istThemenuebersichtTitel`) und loescht die, an denen keine Frage einer
 * Person haengt (nur `toc`-Query-Logs oder gar keine). Ihre Uebersichts-Logs
 * bleiben erhalten (sie tragen den Cache), verlieren aber die `chatId` — so,
 * wie D8 sie heute anlegt. Chats mit Systemtitel, die echte Fragen tragen
 * (App-Chat vor D1), bekommen den Titel, den D1 ihnen gegeben haette: den
 * Kurztitel der ersten Frage, sonst ihre ersten 60 Zeichen.
 *
 * Sicherheit (Muster backfill-chunk-pages.ts):
 * - DEFAULT = ANALYSE (read-only). Schreiben nur mit `--apply`.
 * - `--db=<name>` ist PFLICHT. Vorher `mongodump` von `chats` und `queries`
 *   (Playbook Regel 5).
 * - Idempotent: ein zweiter Lauf findet nichts mehr.
 *
 * @usage
 *   pnpm tsx scripts/cleanup-toc-chats.ts --db=<name>          # Analyse
 *   pnpm tsx scripts/cleanup-toc-chats.ts --db=<name> --apply  # Loeschen
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { MongoClient, type Document } from 'mongodb'
import { istThemenuebersichtTitel } from '@/lib/chat/common/sitzungstitel'

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

interface ChatZeile {
  chatId: string
  libraryId: string
  title: string
  createdAt?: Date
  updatedAt?: Date
}

/** Hoechstlaenge, auf die `createChat` Titel kuerzt (wie `SITZUNGSTITEL_MAX`). */
const TITEL_MAX = 60

/** Titel, den D1 der Sitzung aus ihrer ersten Frage gegeben haette. */
function titelAusErsterFrage(q: Document): string | null {
  const kurz = typeof q.shortTitle === 'string' ? q.shortTitle.trim() : ''
  if (kurz) return kurz
  const frage = typeof q.question === 'string' ? q.question.trim() : ''
  return frage ? frage.slice(0, TITEL_MAX) : null
}

/** Query-Log ist eine Frage der Person — alles ausser `toc` (alte Logs ohne Typ zaehlen als Frage). */
function istFrageDerPerson(q: Document): boolean {
  const typ = (q.cacheParams as { queryType?: unknown } | undefined)?.queryType ?? q.queryType
  return typ !== 'toc'
}

async function main(): Promise<void> {
  const dbName = getArg('db')
  const apply = process.argv.includes('--apply')
  if (!dbName) throw new Error('Pflicht: --db=<name>')
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI fehlt')

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db(dbName)
    const chats = db.collection<ChatZeile>('chats')
    const queries = db.collection<Document>('queries')

    const alle = await chats.find({}, { projection: { _id: 0, chatId: 1, libraryId: 1, title: 1, createdAt: 1 } }).toArray()
    const kandidaten = alle.filter((c) => typeof c.title === 'string' && istThemenuebersichtTitel(c.title))
    console.log(`[cleanup-toc-chats] ${dbName}: ${alle.length} Chats, davon ${kandidaten.length} mit Systemtitel der Themenuebersicht`)

    const loeschen: ChatZeile[] = []
    const umbenennen: Array<ChatZeile & { fragen: number; neuerTitel: string }> = []
    const unklar: Array<ChatZeile & { fragen: number }> = []
    for (const chat of kandidaten) {
      const logs = await queries
        .find({ chatId: chat.chatId }, { projection: { _id: 0, queryType: 1, cacheParams: 1, question: 1, shortTitle: 1, createdAt: 1 } })
        .sort({ createdAt: 1 })
        .toArray()
      const fragen = logs.filter(istFrageDerPerson)
      if (fragen.length === 0) {
        loeschen.push(chat)
        continue
      }
      const neuerTitel = titelAusErsterFrage(fragen[0])
      if (neuerTitel) umbenennen.push({ ...chat, fragen: fragen.length, neuerTitel })
      else unklar.push({ ...chat, fragen: fragen.length })
    }

    const jeLibrary = new Map<string, number>()
    for (const c of loeschen) jeLibrary.set(c.libraryId, (jeLibrary.get(c.libraryId) ?? 0) + 1)
    console.log(`[cleanup-toc-chats] zu loeschen: ${loeschen.length} Chats ohne Frage einer Person`)
    for (const [lib, n] of jeLibrary) console.log(`  ${lib}: ${n}`)
    if (umbenennen.length > 0) {
      console.log(`[cleanup-toc-chats] umzubenennen (Systemtitel, aber Fragen vorhanden): ${umbenennen.length}`)
      for (const c of umbenennen) console.log(`  ${c.libraryId} ${c.chatId} fragen=${c.fragen} → "${c.neuerTitel}"`)
    }
    if (unklar.length > 0) {
      console.log(`[cleanup-toc-chats] NICHT angefasst (Fragen ohne Text): ${unklar.length}`)
      for (const c of unklar) console.log(`  ${c.libraryId} ${c.chatId} fragen=${c.fragen}`)
    }

    if (!apply) {
      console.log('[cleanup-toc-chats] Analyse-Modus — nichts geschrieben. Loeschen mit --apply (vorher mongodump chats + queries).')
      return
    }
    if (loeschen.length === 0 && umbenennen.length === 0) {
      console.log('[cleanup-toc-chats] nichts zu tun')
      return
    }
    if (loeschen.length > 0) {
      const ids = loeschen.map((c) => c.chatId)
      const gel = await chats.deleteMany({ chatId: { $in: ids } })
      const ent = await queries.updateMany({ chatId: { $in: ids } }, { $unset: { chatId: '' } })
      console.log(`[cleanup-toc-chats] geloescht: ${gel.deletedCount} Chats; ${ent.modifiedCount} Uebersichts-Logs von der Sitzung geloest`)
    }
    let umbenannt = 0
    for (const c of umbenennen) {
      const r = await chats.updateOne({ chatId: c.chatId, title: c.title }, { $set: { title: c.neuerTitel, updatedAt: new Date() } })
      umbenannt += r.modifiedCount
    }
    console.log(`[cleanup-toc-chats] umbenannt: ${umbenannt} Chats`)
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('[cleanup-toc-chats] Fehler:', e instanceof Error ? e.message : e)
  process.exit(1)
})
