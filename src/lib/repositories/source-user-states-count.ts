/**
 * @fileoverview Sterne-ZAHL ohne Namen (ADR 0012, Fokus aus Sternen)
 *
 * @description
 * `buildFavoriteLookupStages` (source-user-states-repo.ts) haengt Zahl,
 * Voter-Namen und `isFavorite` an und liefert fuer Nicht-Mitglieder bewusst
 * NICHTS. Mit dem Library-Schalter `publicPublishing.starCountsPublic` soll
 * die Zahl der Sterne oeffentlich werden, die Namen nicht. Dafuer gibt es
 * hier Stages, die nur `favoriteCount` berechnen, und die Auswahl, welche
 * Stages ein Aufruf bekommt. Dazu die fileId-Liste fuer `starred=<k>`.
 *
 * @module repositories
 */

import { getCollection } from '@/lib/mongodb-service'
import type { Document } from 'mongodb'
import type { SourceUserState } from '@/types/source-user-state'
import {
  SOURCE_USER_STATES_COLLECTION,
  buildFavoriteLookupStages,
} from './source-user-states-repo'

/**
 * Aggregation-Stages, die NUR `favoriteCount` an Meta-Dokumente haengen —
 * keine Voter-Liste, kein `isFavorite`. Fuer anonyme Leser bei aktivem
 * Schalter.
 */
export function buildFavoriteCountStages(libraryId: string): Document[] {
  if (!libraryId) {
    throw new Error('buildFavoriteCountStages: libraryId ist erforderlich')
  }
  return [
    {
      $lookup: {
        from: SOURCE_USER_STATES_COLLECTION,
        let: { fid: '$fileId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$libraryId', libraryId] },
                  { $eq: ['$fileId', '$$fid'] },
                  { $eq: ['$state', 'favorite'] },
                ],
              },
            },
          },
          { $count: 'n' },
        ],
        as: '__sterne',
      },
    },
    {
      $addFields: {
        favoriteCount: { $ifNull: [{ $arrayElemAt: ['$__sterne.n', 0] }, 0] },
      },
    },
    { $project: { __sterne: 0 } },
  ]
}

export interface SterneStagesAuswahl {
  libraryId: string
  /** E-Mail eines MITGLIEDS; leer oder undefined fuer alle anderen. */
  userEmail?: string | null
  /** `publicPublishing.starCountsPublic` der Library. */
  starCountsPublic?: boolean
}

/**
 * Welche Sterne-Stages ein Lese-Aufruf bekommt:
 * - Mitglied (userEmail gesetzt): Zahl, Namen und `isFavorite` wie bisher.
 * - Kein Mitglied, Schalter an: nur die Zahl.
 * - Sonst: keine Stages — die Karten tragen dann keine Sterne-Felder.
 */
export function waehleSterneStages(auswahl: SterneStagesAuswahl): Document[] {
  if (auswahl.userEmail) {
    return buildFavoriteLookupStages(auswahl.libraryId, auswahl.userEmail)
  }
  if (auswahl.starCountsPublic === true) {
    return buildFavoriteCountStages(auswahl.libraryId)
  }
  return []
}

/**
 * fileIds einer Library mit mindestens `k` Sternen (k >= 1). Grundlage fuer
 * den serverseitigen Filter `starred=<k>`; die Liste geht als
 * `fileId: { $in }` in den Basisfilter, damit Liste, `total` und
 * Facetten-Zahlen uebereinstimmen.
 */
export async function fileIdsMitMindestSternen(libraryId: string, k: number): Promise<string[]> {
  if (!libraryId) {
    throw new Error('fileIdsMitMindestSternen: libraryId ist erforderlich')
  }
  if (!Number.isInteger(k) || k < 1) {
    throw new Error(`fileIdsMitMindestSternen: k muss eine ganze Zahl >= 1 sein, bekommen: ${String(k)}`)
  }
  const col = await getCollection<SourceUserState>(SOURCE_USER_STATES_COLLECTION)
  const rows = await col
    .aggregate<{ _id: string; n: number }>([
      { $match: { libraryId, state: 'favorite' } },
      { $group: { _id: '$fileId', n: { $sum: 1 } } },
      { $match: { n: { $gte: k } } },
      { $project: { _id: 1 } },
    ])
    .toArray()
  return rows.map((r) => r._id).filter((id): id is string => typeof id === 'string' && id.length > 0)
}
