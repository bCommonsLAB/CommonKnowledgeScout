/**
 * @fileoverview Twin-Dokumente und Transkript-Segmente auf neue Storage-Ids umschreiben.
 *
 * @description
 * Felder je Twin (Inventur 14.10.2026): `sourceId`, `parentId`,
 * `compositeSources[]`, `binaryFragments[].fileId`. `filesystemSync.
 * shadowTwinFolderId` ist nur ein Such-Hinweis und wird auf null gesetzt
 * (der Spiegelordner wird dann frisch gesucht), `checkStand` ist ein Cache
 * und wird entfernt. Ein Twin, dessen Quelle im neuen Speicher fehlt, bleibt
 * unveraendert und wird gemeldet.
 *
 * @module storage-remap
 */

import { getCollection } from '@/lib/mongodb-service'
import { getShadowTwinCollectionName, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { rekeyTranscriptSegments } from '@/lib/repositories/transcript-segments-repo'

export interface TwinFelder {
  sourceId: string
  parentId: string
  compositeSources?: string[]
  binaryFragments?: Array<Record<string, unknown>>
}

/** Rein: neue Feldwerte eines Twins oder null, wenn die Quelle keinen Partner hat. */
export function remapTwinFelder(doc: TwinFelder, idMap: Map<string, string>): TwinFelder | null {
  const neueSourceId = idMap.get(doc.sourceId)
  if (!neueSourceId) return null
  const m = (id: string): string => idMap.get(id) ?? id
  return {
    sourceId: neueSourceId,
    parentId: m(doc.parentId),
    ...(doc.compositeSources ? { compositeSources: doc.compositeSources.map(m) } : {}),
    ...(doc.binaryFragments
      ? {
          binaryFragments: doc.binaryFragments.map((f) =>
            typeof f.fileId === 'string' ? { ...f, fileId: m(f.fileId) } : f,
          ),
        }
      : {}),
  }
}

export interface TwinErgebnis {
  twins: number
  umgeschrieben: number
  segmente: number
  ohnePartner: Array<{ sourceId: string; sourceName: string }>
  konflikte: Array<{ sourceName: string; grund: string }>
}

export async function remapShadowTwins(
  libraryId: string,
  idMap: Map<string, string>,
  probelauf: boolean,
): Promise<TwinErgebnis> {
  const col = await getCollection<ShadowTwinDocument>(getShadowTwinCollectionName(libraryId))
  const docs = await col.find({ libraryId }).toArray()
  const vorhandene = new Set(docs.map((d) => d.sourceId))
  const ergebnis: TwinErgebnis = { twins: docs.length, umgeschrieben: 0, segmente: 0, ohnePartner: [], konflikte: [] }

  for (const doc of docs) {
    const neu = remapTwinFelder(doc, idMap)
    if (!neu) {
      // Schon umgeschrieben (Wiederholung) oder Quelle ohne Partner.
      if (!isNeueId(doc.sourceId, idMap)) ergebnis.ohnePartner.push({ sourceId: doc.sourceId, sourceName: doc.sourceName })
      continue
    }
    if (vorhandene.has(neu.sourceId)) {
      ergebnis.konflikte.push({ sourceName: doc.sourceName, grund: `unter der neuen Id liegt schon ein Twin (${neu.sourceId})` })
      continue
    }
    ergebnis.umgeschrieben++
    if (probelauf) continue

    const res = await col.updateOne(
      { libraryId, sourceId: doc.sourceId },
      {
        $set: {
          ...neu,
          ...(doc.filesystemSync ? { 'filesystemSync.shadowTwinFolderId': null } : {}),
          updatedAt: new Date().toISOString(),
        },
        $unset: { checkStand: '' },
      },
    )
    if (res.matchedCount !== 1) throw new Error(`Twin ${doc.sourceName} nicht gefunden beim Umschreiben`)
    vorhandene.add(neu.sourceId)
    ergebnis.segmente += await rekeyTranscriptSegments(libraryId, doc.sourceId, neu.sourceId)
  }
  return ergebnis
}

let neueIdsCache: { map: Map<string, string>; werte: Set<string> } | null = null
function isNeueId(id: string, idMap: Map<string, string>): boolean {
  if (neueIdsCache?.map !== idMap) neueIdsCache = { map: idMap, werte: new Set(idMap.values()) }
  return neueIdsCache.werte.has(id)
}
