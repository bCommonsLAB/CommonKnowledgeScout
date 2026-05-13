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
import type { Collection, Document } from 'mongodb';
import type {
  FavoriteVoter,
  SourceUserState,
  SourceUserStateValue,
} from '@/types/source-user-state';
import { normalizeEmail } from '@/lib/auth/user-email';

const COLLECTION_NAME = 'source_user_states';

/** Externer Name der `source_user_states`-Collection fuer $lookup-Stages. */
export const SOURCE_USER_STATES_COLLECTION = COLLECTION_NAME;

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
 * Optionen beim Setzen eines States. `userDisplayName` wird zur
 * Schreibzeit eingefroren und beim Read-Pfad als Voter-Name verwendet.
 * Zusaetzlich aktualisiert ein Lazy-Backfill alle bestehenden Eintraege
 * desselben Users in derselben Library, sodass aktuelle Namensaenderungen
 * naturgemaess durchpropagieren.
 */
export interface SetStateOptions {
  /** Bevorzugter Anzeigename des Users (siehe `getPreferredUserDisplayName`). */
  userDisplayName?: string;
}

/**
 * Setzt oder loescht den State fuer (libraryId, fileId, userEmail).
 *
 * - `state = 'favorite' | 'not_important'`: upsert (mit optionalem
 *   `userDisplayName`-Set).
 * - `state = null`: bestehenden Eintrag loeschen.
 *
 * Wenn `userDisplayName` mitgegeben wird, fuehrt setState zusaetzlich
 * einen `updateMany` aus, der alle bestehenden Eintraege des Users in
 * dieser Library mit dem neuen Namen aktualisiert (Lazy-Backfill).
 * Damit aktualisiert sich der Tooltip ohne dedizierten Migration-Job.
 *
 * Returnt den finalen State (nach der Operation), damit der Aufrufer
 * eine Server-of-truth-Antwort hat.
 */
export async function setState(
  libraryId: string,
  fileId: string,
  userEmail: string,
  state: SourceUserStateValue | null,
  options: SetStateOptions = {},
): Promise<{ state: SourceUserStateValue | null }> {
  if (!libraryId || !fileId) {
    throw new Error('setState: libraryId und fileId sind erforderlich');
  }
  if (!userEmail) {
    throw new Error('setState: userEmail ist erforderlich');
  }
  const normalized = normalizeEmail(userEmail);
  const col = await getStatesCollection();
  const displayName = typeof options.userDisplayName === 'string'
    ? options.userDisplayName.trim()
    : '';

  if (state === null) {
    await col.deleteOne({ libraryId, fileId, userEmail: normalized });
    // Auch beim Loeschen den Backfill nutzen, falls noch andere
    // Eintraege des Users existieren - so bleibt ihr Name aktuell.
    if (displayName) {
      await col.updateMany(
        { libraryId, userEmail: normalized },
        { $set: { userDisplayName: displayName } },
      );
    }
    return { state: null };
  }

  const now = new Date();
  const setFields: Partial<SourceUserState> = { state, updatedAt: now };
  if (displayName) setFields.userDisplayName = displayName;

  await col.updateOne(
    { libraryId, fileId, userEmail: normalized },
    {
      $set: setFields,
      $setOnInsert: { libraryId, fileId, userEmail: normalized, createdAt: now },
    },
    { upsert: true },
  );

  // Lazy-Backfill: alle anderen Eintraege desselben Users in dieser
  // Library auf den aktuellen Namen ziehen. Idempotent, kostet einen
  // Index-Scan auf `library_user_state`.
  if (displayName) {
    await col.updateMany(
      { libraryId, userEmail: normalized },
      { $set: { userDisplayName: displayName } },
    );
  }

  return { state };
}

/**
 * E-Mail-Prefix als Fallback-Display-Name fuer alte Eintraege ohne
 * persistierten `userDisplayName` (Migration B / Lazy-Backfill).
 */
function emailPrefix(email: string): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return email.slice(0, at);
}

/**
 * Aggregierte Sterne-Counts und Voter-Listen pro fileId.
 *
 * - Beruecksichtigt nur `state = 'favorite'`.
 * - `not_important` wird bewusst NICHT exportiert (rein privat).
 * - Voter-Eintraege enthalten die zur Schreibzeit eingefrorene E-Mail
 *   und den Display-Name; bei alten Datensaetzen ohne persistierten
 *   Namen wird der E-Mail-Prefix als Fallback verwendet.
 * - Voter-Listen sind alphabetisch nach Display-Name sortiert, damit
 *   das Tooltip-UI stabil ist.
 */
export async function getAggregatedFavorites(
  libraryId: string,
  fileIds: string[],
): Promise<{ counts: Record<string, number>; voters: Record<string, FavoriteVoter[]> }> {
  if (!libraryId) {
    throw new Error('getAggregatedFavorites: libraryId ist erforderlich');
  }
  const counts: Record<string, number> = {};
  const voters: Record<string, FavoriteVoter[]> = {};
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
      { projection: { fileId: 1, userEmail: 1, userDisplayName: 1, _id: 0 } },
    )
    .toArray();
  for (const d of docs) {
    counts[d.fileId] = (counts[d.fileId] || 0) + 1;
    if (!voters[d.fileId]) voters[d.fileId] = [];
    const persistedName = typeof d.userDisplayName === 'string' ? d.userDisplayName.trim() : '';
    voters[d.fileId].push({
      email: d.userEmail,
      name: persistedName || emailPrefix(d.userEmail),
    });
  }
  for (const id of Object.keys(voters)) {
    voters[id].sort((a, b) => a.name.localeCompare(b.name));
  }
  return { counts, voters };
}

/**
 * Liefert MongoDB-Aggregation-Stages, die `favoriteCount`,
 * `favoriteVoters` und `isFavorite` an Dokumente anhaengen. Wird von
 * `findDocs`/`findDocsGrouped` im `vector-repo` verwendet, damit
 * Galerie-Karten die Sternchen-Daten direkt aus dem gleichen
 * Round-Trip bekommen.
 *
 * Voraussetzung: Das eingehende Dokument hat ein `fileId`-Feld; wir
 * matchen `source_user_states.fileId === doc.fileId` plus die
 * gegebene `libraryId` und `state === 'favorite'`.
 *
 * `userEmail` wird auf `normalizeEmail` gebracht. Bei einem leeren
 * Wert (anonym oder Nicht-Member) liefert die Funktion bewusst leere
 * Stages zurueck - so verhindern wir, dass Voter-Listen ohne
 * Berechtigung mit der Antwort gehen (Datenschutz).
 */
export function buildFavoriteLookupStages(
  libraryId: string,
  userEmail: string | null | undefined,
): Document[] {
  if (!libraryId) {
    throw new Error('buildFavoriteLookupStages: libraryId ist erforderlich');
  }
  const normalized = userEmail ? normalizeEmail(userEmail) : '';
  if (!normalized) return [];
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
          { $project: { _id: 0, userEmail: 1, userDisplayName: 1 } },
        ],
        as: '__favorites',
      },
    },
    {
      $addFields: {
        favoriteCount: { $size: '$__favorites' },
        favoriteVoters: {
          $map: {
            input: '$__favorites',
            as: 'v',
            in: {
              email: '$$v.userEmail',
              // Fallback auf E-Mail-Prefix bei alten Eintraegen ohne Display-Name.
              name: {
                $let: {
                  vars: {
                    rawName: { $ifNull: ['$$v.userDisplayName', ''] },
                    email: '$$v.userEmail',
                  },
                  in: {
                    $cond: [
                      { $gt: [{ $strLenCP: '$$rawName' }, 0] },
                      '$$rawName',
                      {
                        $cond: [
                          { $gt: [{ $indexOfCP: ['$$email', '@'] }, 0] },
                          { $substrCP: ['$$email', 0, { $indexOfCP: ['$$email', '@'] }] },
                          '$$email',
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        isFavorite: { $in: [normalized, '$__favorites.userEmail'] },
      },
    },
    { $project: { __favorites: 0 } },
  ];
}
