/**
 * @fileoverview Bestand: Veroeffentlichungs-Status an die Chunks spiegeln (Befund 06.11.2026).
 *
 * @description
 * Chunks und Kapitel-Zusammenfassungen tragen seit 06.11.2026 das Feld
 * `publicationStatus` ('draft' | 'published') als Spiegel von
 * `docMetaJson.publication.status` des Meta-Dokuments; der Gast-Filter der
 * Vektorsuche prueft dieses Feld statt einer Liste aller Entwurfs-Ids.
 * Bestehende Chunks haben das Feld nicht. Dieses Skript zieht es je Library
 * nach — Entwuerfe als 'draft', alle anderen als 'published' (Regel wie am
 * Meta-Dokument: kein Status = sichtbar) — und bringt den Suchindex auf die
 * aktuelle Definition (Feld als Token), ohne den gibt es keinen Filter darauf.
 *
 * Sicherheit (Muster ensure-vector-indexes.ts, backfill-chunk-pages.ts):
 * - DEFAULT = ANALYSE (liest nur). Schreiben nur mit `--apply`.
 * - `--apply` braucht `--libraryId=<id>[,<id>]` oder `--alle`.
 * - Idempotent: ein zweiter Lauf aendert nichts mehr (updateMany setzt denselben Wert).
 * - `--ohneIndex` laesst den Suchindex unangetastet (nur Daten).
 *
 * Aufruf:
 *   pnpm tsx scripts/mirror-publication-status-to-chunks.ts                                 # Probelauf, alle Libraries
 *   pnpm tsx scripts/mirror-publication-status-to-chunks.ts --apply --libraryId=<id>[,<id>]  # schreiben, nur genannte
 *   pnpm tsx scripts/mirror-publication-status-to-chunks.ts --apply --alle                   # schreiben, alle
 *
 * Atlas baut den geaenderten Index im Hintergrund neu (Status PENDING → READY);
 * waehrenddessen antwortet die Suche mit dem alten Index. Auf einem knappen
 * Cluster grosse Libraries einzeln fahren.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import type { Document } from 'mongodb'
import type { Library } from '@/types/library'
import { getCollection } from '@/lib/mongodb-service'
import { buildVectorSearchIndexDefinitionForLibrary, VECTOR_SEARCH_INDEX_NAME } from '@/lib/chat/vector-search-index'
import { CHUNK_KINDS, chunkPublicationUpdate, publicationStatusAus } from '@/lib/repositories/chunk-publication-status'

function arg(key: string): string | undefined {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : undefined
}
const flag = (key: string): boolean => process.argv.slice(2).includes(`--${key}`)

interface UserDoc { email: string; libraries?: Library[] }
interface SuchIndex { name: string; status?: string; latestDefinition?: { mappings?: { fields?: Record<string, unknown> } }; definition?: { mappings?: { fields?: Record<string, unknown> } } }

/** Hat der bestehende Index das Feld schon? Ohne lesbare Definition: unbekannt (null). */
function indexKenntFeld(index: SuchIndex | undefined): boolean | null {
  const felder = index?.latestDefinition?.mappings?.fields ?? index?.definition?.mappings?.fields
  if (!felder) return null
  return 'publicationStatus' in felder
}

async function main(): Promise<void> {
  const apply = flag('apply')
  const ohneIndex = flag('ohneIndex')
  const nur = arg('libraryId')?.split(',').map((s) => s.trim()).filter(Boolean)
  if (apply && !nur && !flag('alle')) throw new Error('--apply braucht --libraryId=<id>[,<id>] oder --alle')

  const usersCol = await getCollection<Document>(process.env.MONGODB_COLLECTION_NAME || 'libraries')
  const users = (await usersCol.find({}).toArray()) as unknown as UserDoc[]
  let libraries = 0
  let offen = 0

  for (const user of users) {
    for (const lib of user.libraries ?? []) {
      if (nur && !nur.includes(lib.id)) continue
      const name = lib.config?.chat?.vectorStore?.collectionName?.trim()
      if (!name) continue
      libraries++
      const col = await getCollection<Document>(name)
      const zeile = `${lib.label} (${lib.id}, ${user.email})`

      // Daten: Entwuerfe aus den Meta-Dokumenten, Rest der Chunks ohne Feld.
      const entwuerfe = (await col
        .find({ kind: 'meta', 'docMetaJson.publication.status': 'draft' }, { projection: { _id: 0, fileId: 1 } })
        .toArray()) as Array<{ fileId?: unknown }>
      const entwurfIds = entwuerfe.map((e) => e.fileId).filter((v): v is string => typeof v === 'string' && v.length > 0)
      const ohneFeld = await col.countDocuments({ kind: { $in: [...CHUNK_KINDS] }, publicationStatus: { $exists: false } })
      const falschAlsEntwurf = entwurfIds.length === 0 ? 0 : await col.countDocuments({ kind: { $in: [...CHUNK_KINDS] }, publicationStatus: 'draft', fileId: { $nin: entwurfIds } })

      // Index: Feld als Token vorhanden?
      let indexStand = 'ohne Suchindex'
      let indexZuAendern = false
      try {
        const indizes = (await col.listSearchIndexes().toArray()) as unknown as SuchIndex[]
        const vorhanden = indizes.find((i) => i.name === VECTOR_SEARCH_INDEX_NAME)
        if (vorhanden) {
          const kennt = indexKenntFeld(vorhanden)
          indexStand = kennt === null ? `Index ${vorhanden.status ?? '?'}, Definition nicht lesbar` : kennt ? `Index kennt publicationStatus` : `Index OHNE publicationStatus`
          indexZuAendern = kennt !== true
        }
      } catch (error) {
        indexStand = `Suchindex nicht lesbar (${error instanceof Error ? error.message : String(error)})`
      }

      const zuTun = ohneFeld > 0 || falschAlsEntwurf > 0 || (indexZuAendern && !ohneIndex)
      if (zuTun) offen++
      console.log(`${zuTun ? 'OFFEN ' : 'ok    '} ${zeile}: ${entwurfIds.length} Entwuerfe, ${ohneFeld} Chunks ohne Feld, ${falschAlsEntwurf} Chunks faelschlich draft; ${indexStand}`)
      if (!apply || !zuTun) continue

      // Schreiben: erst alle Chunks ohne Feld oder mit falschem Wert auf 'published',
      // dann die Entwuerfe auf 'draft' — so ist das Ergebnis unabhaengig vom Ausgangsstand.
      const veroeffentlicht = await col.updateMany(
        { kind: { $in: [...CHUNK_KINDS] }, ...(entwurfIds.length > 0 ? { fileId: { $nin: entwurfIds } } : {}), publicationStatus: { $ne: 'published' } },
        { $set: { publicationStatus: 'published' } },
      )
      let entwurfChunks = 0
      for (const fileId of entwurfIds) {
        const { filter, update } = chunkPublicationUpdate(fileId, publicationStatusAus({ publication: { status: 'draft' } }))
        entwurfChunks += (await col.updateMany(filter, update)).matchedCount
      }
      console.log(`       geschrieben: ${veroeffentlicht.modifiedCount} Chunks published, ${entwurfChunks} Chunks draft`)

      if (indexZuAendern && !ohneIndex) {
        const { name: indexName, definition } = buildVectorSearchIndexDefinitionForLibrary(lib)
        await col.updateSearchIndex(indexName, definition as Document)
        console.log(`       Suchindex ${indexName} aktualisiert (Atlas baut im Hintergrund)`)
      }
    }
  }
  console.log(`\n${libraries} Libraries geprueft, ${offen} mit Handlungsbedarf.${apply ? '' : ' Schreiben mit --apply --libraryId=… oder --alle.'}`)
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`\nAbbruch: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
