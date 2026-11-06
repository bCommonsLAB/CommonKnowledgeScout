/**
 * @fileoverview Publication-Filter fuer anonyme/eingeschraenkte Sichten
 *
 * @description
 * Zentraler Helper, der die Sichtbarkeitsregel des Doc-Translations Refactors
 * umsetzt:
 *
 * - Owner und Moderatoren sehen IMMER alle Dokumente einer Library, unabhaengig
 *   von `docMetaJson.publication.status`. Sie haben den Tabellen-Workflow zur
 *   Hand und brauchen die Drafts, um sie reviewen + publizieren zu koennen.
 * - Alle anderen (anonyme Besucher in einer `isPublic`-Library, eingeloggte
 *   Nicht-Mitglieder) sehen NUR Dokumente, die NICHT explizit als `'draft'`
 *   markiert sind. Bestandsdokumente OHNE das Feld `publication.status` gelten
 *   damit als sichtbar (lax/backwards-compatible Regel).
 *
 * Single Source of Truth fuer alle Lese-Endpunkte (`docs`, `facets`,
 * `by-fileids`, `ids`, `doc-meta`, `doc-by-slug`, `stream`/RAG). Meta-Dokumente
 * tragen `docMetaJson.publication.status`, Chunks den Spiegel
 * `publicationStatus` (chunk-publication-status.ts). Nicht in der
 * Owner-Pfad-Logik (`/docs/publish`, `/docs/delete`) verwenden – die haben
 * eigene Permission-Checks.
 *
 * @module chat/publication-filter
 */

import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'

/**
 * Liefert das MongoDB-Filter-Fragment, das Drafts ausschliesst.
 *
 * Mongo-Semantik: `{ $ne: 'draft' }` matcht sowohl Werte ungleich 'draft'
 * als auch Dokumente, in denen das Feld gar nicht existiert. Damit bleiben
 * alle Bestandsdokumente OHNE `publication.status` automatisch sichtbar.
 *
 * Beispiel-Resultat:
 * ```ts
 * { 'docMetaJson.publication.status': { $ne: 'draft' } }
 * ```
 *
 * Der Caller muss den Filter via `Object.assign` / `$and` mit seinem eigenen
 * Filter zusammenfuehren – wir liefern hier bewusst ein flaches Fragment.
 */
export function publicationVisibilityFilter(): Record<string, unknown> {
  return { 'docMetaJson.publication.status': { $ne: 'draft' } }
}

/**
 * Entscheidet, ob der aktuelle Caller Drafts sehen darf.
 *
 * Regeln:
 *  - Anonym (kein userEmail): NEIN.
 *  - Eingeloggt + Owner/Moderator: JA.
 *  - Eingeloggt aber kein Owner/Moderator: NEIN.
 *
 * Reine Convenience-Funktion: kapselt den `isModeratorOrOwner`-Call und das
 * Anonym-Sonderfall-Handling, damit die Lese-Routen konsistent dasselbe
 * Predikat nutzen.
 */
export async function canSeeDrafts(
  libraryId: string,
  userEmail: string | undefined | null,
): Promise<boolean> {
  if (!userEmail) return false
  return isModeratorOrOwner(libraryId, userEmail)
}

/**
 * Bequemer Wrapper: liefert entweder `null` (Caller darf alles sehen, kein
 * Filter) oder das Filter-Fragment (Caller darf nur publizierte sehen).
 *
 * Empfohlene Verwendung in Lese-Routen:
 * ```ts
 * const pubFilter = await maybePublicationFilter(libraryId, userEmail)
 * if (pubFilter) Object.assign(filter, pubFilter)
 * ```
 */
export async function maybePublicationFilter(
  libraryId: string,
  userEmail: string | undefined | null,
): Promise<Record<string, unknown> | null> {
  const allowed = await canSeeDrafts(libraryId, userEmail)
  return allowed ? null : publicationVisibilityFilter()
}

/**
 * Filter-Fragment fuer Chunks und Kapitel-Zusammenfassungen (Befund 06.11.2026).
 *
 * Chunks tragen den Status als Spiegel `publicationStatus` (gesetzt von
 * `setDocPublication`, vom Ingest und vom Bestandsskript
 * `scripts/mirror-publication-status-to-chunks.ts`). Vorher musste vor
 * jeder Gast-Frage die Liste ALLER Entwurfs-Ids abgefragt und als
 * `fileId: { $nin: [...] }` in den Vektorsuch-Filter gesteckt werden —
 * zwei Datenbankrunden je Frage und ein Filter, der mit der Zahl der
 * Entwuerfe waechst. Jetzt ist es EIN Feld, dieselbe laxe Regel wie am
 * Meta-Dokument: `$ne: 'draft'` laesst Chunks ohne Feld durch.
 * `publicationStatus` steht als Token im Suchindex (vector-search-index.ts).
 */
export function chunkPublicationVisibilityFilter(): Record<string, unknown> {
  return { publicationStatus: { $ne: 'draft' } }
}

/**
 * Wendet den Draft-Ausschluss auf einen Chunk-/Summary-Filter an.
 *
 * - Wenn `userEmail` Owner/Mod ist: macht nichts (Owner sehen alles).
 * - Sonst: setzt `publicationStatus: { $ne: 'draft' }` in den Filter.
 *   Traegt der Filter das Feld schon, ist das ein Verdrahtungsfehler und
 *   wirft — kein stilles Ueberschreiben (no-silent-fallbacks).
 *
 * Der Filter wird IN-PLACE veraendert und auch zurueckgegeben (fluent style).
 * `libraryKey` bleibt in der Signatur fuer die Aufrufer; gelesen wird nichts mehr.
 */
export async function applyDraftExclusionToChunkFilter(
  filter: Record<string, unknown>,
  libraryKey: string,
  libraryId: string,
  userEmail: string | undefined | null,
): Promise<Record<string, unknown>> {
  void libraryKey
  const allowed = await canSeeDrafts(libraryId, userEmail)
  if (allowed) return filter
  if (filter.publicationStatus !== undefined) {
    throw new Error(`applyDraftExclusionToChunkFilter: Filter traegt schon publicationStatus (${JSON.stringify(filter.publicationStatus)})`)
  }
  Object.assign(filter, chunkPublicationVisibilityFilter())
  return filter
}
