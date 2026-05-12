/**
 * @fileoverview Source-User-States Repository
 *
 * @description
 * MongoDB-Repository fuer per-User-Zustaende der Quellen (Sterne +
 * privater "nicht wichtig"-Marker). Loest das alte
 * `source-favorites-repo.ts` ab, das nur einen geteilten Stern pro
 * Library kannte.
 *
 * Berechtigung wird in den API-Routen geprueft (Owner + Co-Creator);
 * das Repo selbst macht keine Auth-Checks und vertraut dem Caller.
 *
 * Identitaet einer Quelle: storage-agnostischer `fileId`-Schluessel.
 *
 * @module repositories
 *
 * @exports
 * - getOwnStates: Liefert favorisierte und "nicht wichtig"-fileIds fuer einen User
 * - setState: Setzt oder loescht den State fuer (libraryId, fileId, userEmail)
 * - getAggregatedFavorites: Counts + Voter-Mails pro fileId fuer eine Liste
 * - listFavoriteFileIdsForUser: Set-Liste der eigenen Favoriten-fileIds
 *
 * @dependencies
 * - @/lib/mongodb-service: MongoDB Connection
 * - @/types/source-user-state: Persistenz-Typ
 * - @/lib/auth/user-email: E-Mail-Normalisierung
 */

import { getCollection } from '@/lib/mongodb-service';
import type { Collection } from 'mongodb';
import type {
  SourceUserState,
  SourceUserStateValue,
} from '@/types/source-user-state';
import { normalizeEmail } from '@/lib/auth/user-email';

const COLLECTION_NAME = 'source_user_states';

/** Liefert die Collection und sorgt einmalig fuer die Indizes. */
async function getStatesCollection(): Promise<Collection<SourceUserState>> {
  const col = await getCollection<SourceUserState>(COLLECTION_NAME);
  try {
    await Promise.all([
      col.createIndex(
        { libraryId: 1, fileId: 1, userEmail: 1 },
        { unique: true, name: 'library_file_user_unique' },
      ),
      col.createIndex(
        { libraryId: 1, fileId: 1, state: 1 },
        { name: 'library_file_state' },
      ),
      col.createIndex(
        { libraryId: 1, userEmail: 1, state: 1 },
        { name: 'library_user_state' },
      ),
    ]);
  } catch (err) {
    // Indizes existieren bereits ist okay - alles andere explizit loggen.
    console.warn('[source-user-states-repo] Index-Setup uebersprungen:', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return col;
}

/**
 * Liefert die fileIds, die ein bestimmter User in einer Library als
 * Favorit oder als "nicht wichtig" markiert hat.
 */
export async function getOwnStates(
  libraryId: string,
  userEmail: string,
): Promise<{ favorites: string[]; notImportant: string[] }> {
  if (!libraryId) {
    throw new Error('getOwnStates: libraryId ist erforderlich');
  }
  if (!userEmail) {
    throw new Error('getOwnStates: userEmail ist erforderlich');
  }
  const normalized = normalizeEmail(userEmail);
  const col = await getStatesCollection();
  const docs = await col
    .find(
      { libraryId, userEmail: normalized },
      { projection: { fileId: 1, state: 1, _id: 0 } },
    )
    .toArray();

  const favorites: string[] = [];
  const notImportant: string[] = [];
  for (const d of docs) {
    if (d.state === 'favorite') favorites.push(d.fileId);
    else if (d.state === 'not_important') notImportant.push(d.fileId);
  }
  return { favorites, notImportant };
}

/** Praktischer Helper fuer Sortier-/Filterlogik (z.B. nur eigene Favoriten). */
export async function listFavoriteFileIdsForUser(
  libraryId: string,
  userEmail: string,
): Promise<string[]> {
  const { favorites } = await getOwnStates(libraryId, userEmail);
  return favorites;
}

/**
 * Setzt oder loescht den State fuer (libraryId, fileId, userEmail).
 *
 * - `state = 'favorite' | 'not_important'`: upsert.
 * - `state = null`: bestehenden Eintrag loeschen.
 *
 * Returnt den finalen State (nach der Operation), damit der Aufrufer
 * eine Server-of-truth-Antwort hat.
 */
export async function setState(
  libraryId: string,
  fileId: string,
  userEmail: string,
  state: SourceUserStateValue | null,
): Promise<{ state: SourceUserStateValue | null }> {
  if (!libraryId || !fileId) {
    throw new Error('setState: libraryId und fileId sind erforderlich');
  }
  if (!userEmail) {
    throw new Error('setState: userEmail ist erforderlich');
  }
  const normalized = normalizeEmail(userEmail);
  const col = await getStatesCollection();

  if (state === null) {
    await col.deleteOne({ libraryId, fileId, userEmail: normalized });
    return { state: null };
  }

  const now = new Date();
  await col.updateOne(
    { libraryId, fileId, userEmail: normalized },
    {
      $set: { state, updatedAt: now },
      $setOnInsert: { libraryId, fileId, userEmail: normalized, createdAt: now },
    },
    { upsert: true },
  );
  return { state };
}

/**
 * Aggregierte Sterne-Counts und Voter-Mail-Listen pro fileId.
 *
 * - Beruecksichtigt nur `state = 'favorite'`.
 * - `not_important` wird bewusst NICHT exportiert (rein privat).
 * - Voter-Listen sind alphabetisch sortiert, damit das Tooltip-UI
 *   stabil ist.
 */
export async function getAggregatedFavorites(
  libraryId: string,
  fileIds: string[],
): Promise<{ counts: Record<string, number>; voters: Record<string, string[]> }> {
  if (!libraryId) {
    throw new Error('getAggregatedFavorites: libraryId ist erforderlich');
  }
  const counts: Record<string, number> = {};
  const voters: Record<string, string[]> = {};
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return { counts, voters };
  }
  const uniqueIds = Array.from(new Set(fileIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { counts, voters };
  }
  const col = await getStatesCollection();
  const docs = await col
    .find(
      { libraryId, fileId: { $in: uniqueIds }, state: 'favorite' },
      { projection: { fileId: 1, userEmail: 1, _id: 0 } },
    )
    .toArray();
  for (const d of docs) {
    counts[d.fileId] = (counts[d.fileId] || 0) + 1;
    if (!voters[d.fileId]) voters[d.fileId] = [];
    voters[d.fileId].push(d.userEmail);
  }
  for (const id of Object.keys(voters)) {
    voters[id].sort((a, b) => a.localeCompare(b));
  }
  return { counts, voters };
}
