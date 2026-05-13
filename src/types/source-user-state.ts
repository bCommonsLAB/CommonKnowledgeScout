/**
 * @fileoverview Source-User-State Typen
 *
 * @description
 * Per-User-Zustand fuer Quell-Sterne und privaten "nicht wichtig"-Marker
 * im Tinder-Modus. Loest die alte `SourceFavorite`-Struktur ab, bei der
 * ein Stern Library-weit geteilt wurde.
 *
 * Datenmodell:
 * - Pro Tripel `(libraryId, fileId, userEmail)` existiert maximal ein
 *   State-Eintrag.
 * - `state = 'favorite'` zaehlt im aggregierten Counter.
 * - `state = 'not_important'` ist privat (nicht aggregiert, nicht
 *   sichtbar fuer andere User), nur fuer den eigenen Tinder-Filter.
 *
 * Berechtigung:
 * - Lesen (eigene + aggregiert) und Setzen ausschliesslich fuer Owner +
 *   aktive Co-Creators (Server-Pruefung in den API-Routen).
 * - Gaeste/Anonyme erhalten 401/403; UI rendert keine Sterne.
 *
 * Identitaet einer Quelle: storage-agnostischer `fileId`-Schluessel.
 *
 * @module types
 */

export type SourceUserStateValue = 'favorite' | 'not_important';

/** Persistenz-Form in der MongoDB-Collection `source_user_states`. */
export interface SourceUserState {
  libraryId: string;
  fileId: string;
  userEmail: string;
  /**
   * Zur Schreibzeit eingefrorener Anzeigename des Users.
   *
   * Wird beim Setzen eines States ueber `getPreferredUserDisplayName(currentUser())`
   * befuellt - Read-Pfade muessen damit keine Auth-API mehr fragen.
   * Bei alten Datensaetzen kann das Feld fehlen; UI faellt auf den
   * E-Mail-Prefix zurueck (Lazy-Backfill greift beim naechsten Toggle).
   */
  userDisplayName?: string;
  state: SourceUserStateValue;
  createdAt: Date;
  updatedAt: Date;
}

/** Voter-Eintrag fuer aggregierte Favoriten (E-Mail + persistierter Display-Name). */
export interface FavoriteVoter {
  email: string;
  /** Display-Name aus `source_user_states.userDisplayName`. Fallback E-Mail-Prefix. */
  name: string;
}

/** Antwort von `GET /api/library/[libraryId]/source-user-states`. */
export interface OwnUserStatesResponse {
  libraryId: string;
  favorites: string[];
  notImportant: string[];
}

/** Body von `POST /api/library/[libraryId]/source-user-states`. */
export interface SetUserStateInput {
  fileId: string;
  /** `null` loescht den Eintrag (zurueck zu undefined). */
  state: SourceUserStateValue | null;
}

/** Antwort von `POST /api/library/[libraryId]/source-user-states`. */
export interface SetUserStateResponse {
  libraryId: string;
  fileId: string;
  state: SourceUserStateValue | null;
}
