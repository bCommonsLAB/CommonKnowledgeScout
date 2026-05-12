/**
 * @fileoverview Source-Favorites Repository
 *
 * @description
 * MongoDB-Repository fuer geteilte Quell-Favoriten in der Explorer-Tabelle.
 * Ein Favorit ist ein Dokument in der Collection `source_favorites` und
 * markiert eine Quelle (`fileId`) als bevorzugt fuer die gesamte Library.
 *
 * Berechtigung:
 * - Sehen / Toggeln nur Owner + aktive Co-Creators (Pruefung in der API-Route).
 *
 * Identitaet einer Quelle: storage-agnostischer `fileId`-Schluessel.
 *
 * @module repositories
 *
 * @exports
 * - listFavoriteFileIds: Liefert die Set-Liste favorisierter fileIds einer Library
 * - isFavorite: Pruefe-Helper fuer Toggle-Aufrufer (selten direkt benoetigt)
 * - toggleFavorite: Add-or-Remove fuer einen (libraryId, fileId)
 *
 * @dependencies
 * - @/lib/mongodb-service: MongoDB Connection
 * - @/types/source-favorite: Persistenz-Typ
 * - @/lib/auth/user-email: E-Mail-Normalisierung (Audit `createdBy`)
 */

import { getCollection } from '@/lib/mongodb-service';
import type { Collection } from 'mongodb';
import type { SourceFavorite } from '@/types/source-favorite';
import { normalizeEmail } from '@/lib/auth/user-email';

const COLLECTION_NAME = 'source_favorites';

/** Liefert die Collection und sorgt einmalig fuer den Unique-Index */
async function getFavoritesCollection(): Promise<Collection<SourceFavorite>> {
  const col = await getCollection<SourceFavorite>(COLLECTION_NAME);
  try {
    await col.createIndex(
      { libraryId: 1, fileId: 1 },
      { unique: true, name: 'library_file_unique' },
    );
  } catch (err) {
    // Index existiert bereits - ist okay; alle anderen Fehler explizit loggen
    console.warn('[source-favorites-repo] Index-Setup uebersprungen:', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return col;
}

/**
 * Listet alle favorisierten Quell-IDs einer Library.
 *
 * @param libraryId Library-ID
 * @returns Array von `fileId`-Strings (ohne Duplikate dank Unique-Index)
 */
export async function listFavoriteFileIds(libraryId: string): Promise<string[]> {
  if (!libraryId) {
    throw new Error('listFavoriteFileIds: libraryId ist erforderlich');
  }
  const col = await getFavoritesCollection();
  const docs = await col.find({ libraryId }, { projection: { fileId: 1, _id: 0 } }).toArray();
  return docs.map((d) => d.fileId);
}

/**
 * Prueft, ob eine Quelle in einer Library favorisiert ist.
 *
 * @param libraryId Library-ID
 * @param fileId Quell-ID (Vector-Namespace)
 */
export async function isFavorite(libraryId: string, fileId: string): Promise<boolean> {
  if (!libraryId || !fileId) {
    throw new Error('isFavorite: libraryId und fileId sind erforderlich');
  }
  const col = await getFavoritesCollection();
  const doc = await col.findOne({ libraryId, fileId }, { projection: { _id: 1 } });
  return doc !== null;
}

/**
 * Toggelt den Favoriten-Status fuer (libraryId, fileId).
 *
 * Atomare Logik:
 * - Wenn ein Eintrag existiert: loeschen (return added=false).
 * - Sonst: einfuegen mit Audit-Feldern (return added=true).
 *
 * @param libraryId Library-ID
 * @param fileId Quell-ID (Vector-Namespace)
 * @param userEmail E-Mail des togglenden Users (Audit `createdBy`)
 */
export async function toggleFavorite(
  libraryId: string,
  fileId: string,
  userEmail: string,
): Promise<{ added: boolean }> {
  if (!libraryId || !fileId) {
    throw new Error('toggleFavorite: libraryId und fileId sind erforderlich');
  }
  if (!userEmail) {
    throw new Error('toggleFavorite: userEmail ist erforderlich (Audit-Feld createdBy)');
  }
  const col = await getFavoritesCollection();
  const normalized = normalizeEmail(userEmail);

  const removed = await col.deleteOne({ libraryId, fileId });
  if (removed.deletedCount > 0) {
    return { added: false };
  }

  await col.insertOne({
    libraryId,
    fileId,
    createdBy: normalized,
    createdAt: new Date(),
  });
  return { added: true };
}
