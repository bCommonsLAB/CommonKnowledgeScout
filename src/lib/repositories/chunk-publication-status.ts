/**
 * Veroeffentlichungs-Status als Spiegel an den Chunks (Befund 06.11.2026).
 *
 * Der Status eines Dokuments (`docMetaJson.publication.status` am
 * Meta-Dokument) entscheidet, was Gaeste sehen. Fuer die Vektorsuche brauchte
 * der Gast-Filter bisher eine Liste aller Entwurfs-Ids (`fileId: { $nin }`),
 * vor jeder Frage neu abgefragt und mit der Zahl der Entwuerfe wachsend.
 * Stattdessen tragen Chunks und Kapitel-Zusammenfassungen jetzt
 * `publicationStatus` ('draft' | 'published') und der Filter prueft EIN Feld.
 *
 * Schreiber: `setDocPublication` (Publish-API), der Ingest (nach
 * `upsertVectorMeta`) und `scripts/mirror-publication-status-to-chunks.ts`
 * fuer den Bestand. Regel wie am Meta-Dokument: kein Status = sichtbar, also
 * 'published'.
 */

import type { Document } from 'mongodb'
import { getCollectionOnly } from './vector-repo'

export type PublicationStatus = 'draft' | 'published'

/** Vektor-Dokumente, die den Status als Spiegel tragen (nicht `meta`). */
export const CHUNK_KINDS: readonly string[] = ['chunk', 'chapterSummary']

/** Status aus `docMetaJson` lesen — nur 'draft' ist ein Entwurf, alles andere (auch fehlend) ist sichtbar. */
export function publicationStatusAus(docMetaJson: Record<string, unknown> | undefined | null): PublicationStatus {
  const pub = docMetaJson?.publication
  if (pub && typeof pub === 'object' && (pub as { status?: unknown }).status === 'draft') return 'draft'
  return 'published'
}

/** Filter und Update fuer `updateMany` — pure, damit Skript und Repo dieselbe Form schreiben. */
export function chunkPublicationUpdate(fileId: string, status: PublicationStatus): { filter: Document; update: Document } {
  return {
    filter: { fileId, kind: { $in: [...CHUNK_KINDS] } },
    update: { $set: { publicationStatus: status } },
  }
}

/** Setzt den Status an allen Chunks und Kapitel-Zusammenfassungen einer Quelle; liefert die Zahl der getroffenen Dokumente. */
export async function setChunkPublicationStatus(libraryKey: string, fileId: string, status: PublicationStatus): Promise<number> {
  const col = await getCollectionOnly(libraryKey)
  const { filter, update } = chunkPublicationUpdate(fileId, status)
  const res = await col.updateMany(filter, update)
  return res.matchedCount
}
