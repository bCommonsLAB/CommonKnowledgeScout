/**
 * Fragen eines Monats fuer die Verbrauchsseite (10.11.2026): nur die Felder,
 * aus denen Kosten und Energie gerechnet werden. Themenuebersichten (`toc`)
 * und unbeantwortete Eintraege bleiben draussen — die Seite zeigt Fragen.
 */

import { getQueriesCollection } from './queries-repo'
import type { VerbrauchZeile } from '@/lib/verbrauch/rechnen'

/** Obergrenze je Monat; wird sie erreicht, sagt die Antwort das (`abgeschnitten`). */
export const VERBRAUCH_MAX_ZEILEN = 20000

export async function listVerbrauchZeilen(args: { libraryId: string; von: Date; bis: Date }): Promise<{ zeilen: VerbrauchZeile[]; abgeschnitten: boolean }> {
  const col = await getQueriesCollection()
  const rows = (await col
    .find(
      {
        libraryId: args.libraryId,
        createdAt: { $gte: args.von, $lt: args.bis },
        status: 'ok',
        queryType: { $ne: 'toc' },
        'cacheParams.queryType': { $ne: 'toc' },
      },
      {
        projection: { _id: 0, createdAt: 1, userEmail: 1, sessionId: 1, 'tokenUsage.totalTokens': 1, 'tokenUsage.cost': 1, 'retrieval.cacheFound': 1 },
        sort: { createdAt: -1 },
        limit: VERBRAUCH_MAX_ZEILEN,
      },
    )
    .toArray()) as unknown as VerbrauchZeile[]
  return { zeilen: rows, abgeschnitten: rows.length >= VERBRAUCH_MAX_ZEILEN }
}
