/**
 * @fileoverview Flache Felder eines Meta-Dokuments (Galerie-Eintrag) setzen.
 *
 * @description
 * Ein Meta-Dokument traegt seine Felder zweimal: vollstaendig in `docMetaJson`
 * und fuer einige Facetten gespiegelt auf oberster Ebene
 * (`meta-document-builder.ts`). Wer ein Feld aendert, muss beide Ablagen
 * treffen, sonst filtert die Galerie anders, als die Detailansicht zeigt.
 * Das ist der guenstige Weg fuer Feld-Patches; der volle Ingest bleibt der
 * Weg fuer Textaenderungen.
 *
 * @module repositories
 */

import type { Document } from 'mongodb'
import { getCollectionOnly } from './vector-repo'

/** Felder, die `buildMetaDocument` zusaetzlich auf oberster Ebene ablegt. */
export const TOP_LEVEL_SPIEGEL: ReadonlySet<string> = new Set([
  'year', 'authors', 'region', 'docType', 'source', 'tags', 'topics',
  'title', 'shortTitle', 'slug', 'summary', 'teaser',
])

/**
 * Setzt Felder am Meta-Dokument `<fileId>-meta`. `false` = kein Meta-Dokument,
 * die Quelle ist nicht publiziert (der Aufrufer sagt das dem Menschen).
 */
export async function patchMetaDokumentFelder(
  libraryKey: string,
  fileId: string,
  felder: Record<string, unknown>,
): Promise<boolean> {
  const keys = Object.keys(felder)
  if (keys.length === 0) return true
  const set: Record<string, unknown> = { upsertedAt: new Date().toISOString() }
  for (const key of keys) {
    set[`docMetaJson.${key}`] = felder[key]
    if (TOP_LEVEL_SPIEGEL.has(key)) set[key] = felder[key]
  }
  const col = await getCollectionOnly(libraryKey)
  const ergebnis = await col.updateOne(
    { _id: `${fileId}-meta`, kind: 'meta' } as Partial<Document>,
    { $set: set },
  )
  return ergebnis.matchedCount > 0
}
