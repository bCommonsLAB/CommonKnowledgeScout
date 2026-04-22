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
 * `by-fileids`, `ids`, `doc-meta`, `doc-by-slug`, `stream`/RAG). Nicht in der
 * Owner-Pfad-Logik (`/docs/publish`, `/docs/delete`) verwenden – die haben
 * eigene Permission-Checks.
 *
 * @module chat/publication-filter
 */

import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { getCollectionOnly } from '@/lib/repositories/vector-repo'
import type { Document } from 'mongodb'

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
 * Listet alle fileIds, die in der Library aktuell als `'draft'` markiert sind.
 *
 * Hintergrund: Chunks (`kind: 'chunk'`) und Chapter-Summaries (`kind: 'chapterSummary'`)
 * tragen KEIN `docMetaJson.publication.status`-Feld – das liegt nur auf den Meta-
 * Dokumenten (`kind: 'meta'`). Deshalb funktioniert das Filter-Fragment aus
 * `publicationVisibilityFilter()` fuer Chunk-/Summary-Queries NICHT direkt: ein
 * `$ne: 'draft'`-Test wuerde alle Chunks durchlassen, weil das Feld fehlt.
 *
 * Die korrekte Loesung fuer RAG/Chunk-Suchen ist, vorab die Liste der Draft-
 * fileIds zu ermitteln und sie via `fileId: { $nin: [...] }` aus dem Chunk-
 * Filter auszuschliessen. Dieser Helper kapselt das.
 */
export async function listDraftFileIds(
  libraryKey: string,
  libraryId: string,
): Promise<string[]> {
  const col = await getCollectionOnly(libraryKey)
  const rows = await col
    .find(
      {
        kind: 'meta',
        libraryId,
        'docMetaJson.publication.status': 'draft',
      } as Partial<Document>,
      { projection: { _id: 0, fileId: 1 } },
    )
    .toArray()
  return rows
    .map((r) => (r as { fileId?: unknown }).fileId)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/**
 * Wendet den Draft-Ausschluss auf einen Chunk-/Summary-Filter an.
 *
 * - Wenn `userEmail` Owner/Mod ist: macht nichts (Owner sehen alles).
 * - Sonst: laedt die Draft-fileIds und mergt `fileId: { $nin: [...] }` in den
 *   Filter. Falls bereits ein `fileId`-Filter besteht (z.B. aus einer
 *   Facetten-Auswahl), wird er kombiniert: `$in` bleibt erhalten und wir
 *   subtrahieren die Drafts aus der `$in`-Liste; ein leerer Schnitt bleibt
 *   leer und liefert konsequenterweise keine Ergebnisse.
 *
 * Der Filter wird IN-PLACE veraendert und auch zurueckgegeben (fluent style).
 */
export async function applyDraftExclusionToChunkFilter(
  filter: Record<string, unknown>,
  libraryKey: string,
  libraryId: string,
  userEmail: string | undefined | null,
): Promise<Record<string, unknown>> {
  const allowed = await canSeeDrafts(libraryId, userEmail)
  if (allowed) return filter

  const draftIds = await listDraftFileIds(libraryKey, libraryId)
  if (draftIds.length === 0) return filter

  const existing = filter.fileId as
    | { $in?: string[]; $nin?: string[]; $eq?: string }
    | string
    | undefined

  // Kein bestehender fileId-Filter → einfacher $nin.
  if (existing === undefined) {
    filter.fileId = { $nin: draftIds }
    return filter
  }

  // Bestehender konkreter fileId (string oder $eq) → wenn er ein Draft ist,
  // wird der Filter unmoeglich (Doc nicht sichtbar). Sonst unveraendert.
  if (typeof existing === 'string') {
    if (draftIds.includes(existing)) {
      filter.fileId = { $in: [] }
    }
    return filter
  }
  if (typeof existing === 'object' && existing !== null && '$eq' in existing && typeof existing.$eq === 'string') {
    if (draftIds.includes(existing.$eq)) {
      filter.fileId = { $in: [] }
    }
    return filter
  }

  // Bestehende Whitelist → aus der Liste entfernen.
  if (typeof existing === 'object' && existing !== null && Array.isArray(existing.$in)) {
    const draftSet = new Set(draftIds)
    const keep = existing.$in.filter((id) => !draftSet.has(id))
    filter.fileId = { ...existing, $in: keep }
    return filter
  }

  // Bestehende Blacklist → erweitern.
  if (typeof existing === 'object' && existing !== null && Array.isArray(existing.$nin)) {
    const merged = Array.from(new Set([...existing.$nin, ...draftIds]))
    filter.fileId = { ...existing, $nin: merged }
    return filter
  }

  // Unbekanntes Format → defensiv nichts machen, lieber zu offen als zu falsch.
  return filter
}

