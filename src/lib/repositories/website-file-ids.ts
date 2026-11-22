/**
 * Die `fileId`s aller erzeugten Webseiten einer Library (Meta-Dokumente mit
 * `detailViewType: website`). Reine Lese-Abfrage; der Typ steht am
 * Meta-Dokument oben oder in `docMetaJson` (wie `distinctViewTypes`).
 */

import type { Document } from 'mongodb'
import { getCollectionOnly } from '@/lib/repositories/vector-repo'

export const WEBSITE_VIEW_TYPE = 'website'

export async function findWebsiteFileIds(libraryKey: string, libraryId: string): Promise<string[]> {
  const col = await getCollectionOnly(libraryKey)
  const rows = await col
    .find<Document>(
      {
        kind: 'meta',
        libraryId,
        $or: [{ detailViewType: WEBSITE_VIEW_TYPE }, { 'docMetaJson.detailViewType': WEBSITE_VIEW_TYPE }],
      },
      { projection: { _id: 0, fileId: 1 } },
    )
    .toArray()
  const ids = new Set<string>()
  for (const row of rows) {
    const fileId: unknown = row.fileId
    if (typeof fileId === 'string' && fileId !== '') ids.add(fileId)
  }
  return [...ids]
}
