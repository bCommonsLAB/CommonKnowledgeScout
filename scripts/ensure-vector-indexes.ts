/**
 * @fileoverview Fehlende Vector-Search-Indizes nachziehen.
 *
 * @description
 * Befund 16.10.2026: Sechs Prod-Collections hatten Abschnitte, aber keinen
 * `vector_search_idx` (Ursache: Index-Setup hing am Lese-Cache, gefixt in
 * vector-repo.ts). Der Story-Modus fand dort nichts. Dieses Skript listet je
 * Library mit Suchindex-Collection, ob der Index fehlt, und legt ihn mit
 * `--apply` an — Definition aus dem App-Code
 * (`buildVectorSearchIndexDefinitionForLibrary`, Basisfelder + Facetten).
 * Aendert keine Dokumente.
 *
 * Aufruf:
 *   pnpm tsx scripts/ensure-vector-indexes.ts                                # Probelauf, alle Libraries
 *   pnpm tsx scripts/ensure-vector-indexes.ts --apply --libraryId=<id>[,<id>] # anlegen, nur genannte
 *   pnpm tsx scripts/ensure-vector-indexes.ts --apply --alle                  # anlegen, alle fehlenden
 *
 * Atlas baut den Index danach im Hintergrund (Status PENDING → READY).
 * Auf einem knappen Cluster (M10) grosse Libraries einzeln anlegen.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import type { Document } from 'mongodb'
import type { Library } from '@/types/library'
import { getCollection } from '@/lib/mongodb-service'
import { buildVectorSearchIndexDefinitionForLibrary, VECTOR_SEARCH_INDEX_NAME } from '@/lib/chat/vector-search-index'

function arg(key: string): string | undefined {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : undefined
}
const flag = (key: string): boolean => process.argv.slice(2).includes(`--${key}`)

interface UserDoc { email: string; libraries?: Library[] }

async function main(): Promise<void> {
  const apply = flag('apply')
  const nur = arg('libraryId')?.split(',').map((s) => s.trim()).filter(Boolean)
  if (apply && !nur && !flag('alle')) throw new Error('--apply braucht --libraryId=<id>[,<id>] oder --alle')

  const usersCol = await getCollection<Document>(process.env.MONGODB_COLLECTION_NAME || 'libraries')
  const users = (await usersCol.find({}).toArray()) as unknown as UserDoc[]
  let fehlend = 0

  for (const user of users) {
    for (const lib of user.libraries ?? []) {
      if (nur && !nur.includes(lib.id)) continue
      const name = lib.config?.chat?.vectorStore?.collectionName?.trim()
      if (!name) continue
      const col = await getCollection<Document>(name)
      const abschnitte = await col.countDocuments({ kind: 'chunk' })
      const indizes = (await col.listSearchIndexes().toArray()) as Array<{ name: string; status?: string }>
      const vorhanden = indizes.find((i) => i.name === VECTOR_SEARCH_INDEX_NAME)
      const zeile = `${lib.label} (${lib.id}, ${user.email}) — ${abschnitte} Abschnitte`
      if (vorhanden) {
        if (nur) console.log(`  ok      ${zeile}: ${vorhanden.status ?? '?'}`)
        continue
      }
      fehlend++
      if (!apply) {
        console.log(`  FEHLT   ${zeile}`)
        continue
      }
      const { name: indexName, definition } = buildVectorSearchIndexDefinitionForLibrary(lib)
      await col.createSearchIndex({ name: indexName, definition })
      console.log(`  ANGELEGT ${zeile}`)
    }
  }
  console.log(`\n${fehlend} Index(e) ${apply ? 'angelegt' : 'fehlen'}.${apply ? ' Atlas baut im Hintergrund (PENDING → READY).' : ' Anlegen mit --apply --libraryId=… oder --alle.'}`)
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`\nAbbruch: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
