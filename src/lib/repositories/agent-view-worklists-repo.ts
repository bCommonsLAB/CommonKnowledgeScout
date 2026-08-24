/**
 * @fileoverview Arbeitslisten der Werkbank (F7, Welle W6) — Buch 3 „persoenlich".
 *
 * @description
 * Benannte, von Hand kuratierte Vorhaben-Mengen je User+Library — bewusst
 * UNABHAENGIG vom wegwerfbaren Coverage-Report (Kreuztest der Buecher,
 * Akzeptanzkriterium 2). Schluessel der Mitgliedschaft ist die folderId
 * (Provider-Ids sind move-stabil); `pathSnapshot` dient NUR der Anzeige
 * toter Eintraege. Muster: `docs/architecture/mongodb-repository-pattern.md`.
 * Benannte Domaenenfehler statt stiller Fallbacks: Namensduplikate werfen
 * {@link WorklistNameVergebenError} (race-sicher ueber den Unique-Index),
 * unbekannte Listen liefern `null`, idempotentes Hinzufuegen/Entfernen sagt
 * `unchanged: true`.
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { randomUUID } from 'crypto'
import { getCollection } from '@/lib/mongodb-service'

export interface WorklistFolderEntry {
  folderId: string
  /** Library-relativer Pfad zum Zeitpunkt des Hinzufuegens (Anzeige toter Eintraege). */
  pathSnapshot: string
  name: string
  addedAt: string
}

export interface WorklistDoc {
  _id?: string
  libraryId: string
  userEmail: string
  listId: string
  name: string
  /** Reihenfolge der Listen des Users (append-only vergeben). */
  position: number
  folders: WorklistFolderEntry[]
  createdAt: string
  updatedAt: string
}

/** Name bereits vergeben (Unique `(userEmail, name)`) — Route: 409 `name_vergeben`. */
export class WorklistNameVergebenError extends Error {
  readonly code = 'name_vergeben' as const
}

const collectionCache = new Map<string, Collection<WorklistDoc>>()
const indexCache = new Set<string>()

export function getWorklistsCollectionName(libraryId: string): string {
  return `agent_view_worklists__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<WorklistDoc>> {
  const name = getWorklistsCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<WorklistDoc>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(libraryId: string): Promise<void> {
  const name = getWorklistsCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await col.createIndex({ userEmail: 1, listId: 1 }, { unique: true })
  await col.createIndex({ userEmail: 1, name: 1 }, { unique: true })
  indexCache.add(name)
}

function istDuplikatFehler(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
}

/** Listen des Users, sortiert nach `position`. */
export async function listWorklists(libraryId: string, userEmail: string): Promise<WorklistDoc[]> {
  const col = await getCol(libraryId)
  return col.find({ userEmail }).sort({ position: 1 }).toArray()
}

export async function getWorklist(
  libraryId: string,
  userEmail: string,
  listId: string,
): Promise<WorklistDoc | null> {
  const col = await getCol(libraryId)
  return col.findOne({ userEmail, listId })
}

/** Legt eine Liste an; `folders` ist die optionale Start-Kopie (Seeding, F7). */
export async function createWorklist(
  libraryId: string,
  userEmail: string,
  name: string,
  folders: WorklistFolderEntry[],
): Promise<WorklistDoc> {
  await ensureIndexes(libraryId)
  const col = await getCol(libraryId)
  const letzte = await col.find({ userEmail }).sort({ position: -1 }).limit(1).toArray()
  const now = new Date().toISOString()
  const doc: WorklistDoc = {
    libraryId,
    userEmail,
    listId: randomUUID(),
    name,
    position: (letzte[0]?.position ?? -1) + 1,
    folders,
    createdAt: now,
    updatedAt: now,
  }
  try {
    await col.insertOne(doc)
  } catch (error) {
    if (istDuplikatFehler(error)) throw new WorklistNameVergebenError(`Listenname bereits vergeben: ${name}`)
    throw error
  }
  return doc
}

/** Benennt um; `null` = unbekannte Liste (Route: 404). Duplikat wirft benannt. */
export async function renameWorklist(
  libraryId: string,
  userEmail: string,
  listId: string,
  name: string,
): Promise<WorklistDoc | null> {
  await ensureIndexes(libraryId)
  const col = await getCol(libraryId)
  try {
    const result = await col.findOneAndUpdate(
      { userEmail, listId },
      { $set: { name, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' },
    )
    return result
  } catch (error) {
    if (istDuplikatFehler(error)) throw new WorklistNameVergebenError(`Listenname bereits vergeben: ${name}`)
    throw error
  }
}

/**
 * Fuegt ein Vorhaben hinzu. Idempotent und AUSGEWIESEN (F7):
 * `unchanged: true`, wenn die folderId schon Mitglied war; `null` = Liste
 * unbekannt (Route: 404).
 */
export async function addFolderToWorklist(
  libraryId: string,
  userEmail: string,
  listId: string,
  eintrag: Omit<WorklistFolderEntry, 'addedAt'>,
): Promise<{ list: WorklistDoc; unchanged: boolean } | null> {
  const col = await getCol(libraryId)
  const result = await col.updateOne(
    { userEmail, listId, 'folders.folderId': { $ne: eintrag.folderId } },
    {
      $push: { folders: { ...eintrag, addedAt: new Date().toISOString() } },
      $set: { updatedAt: new Date().toISOString() },
    },
  )
  const list = await getWorklist(libraryId, userEmail, listId)
  if (list === null) return null
  return { list, unchanged: result.matchedCount === 0 }
}

/** Entfernt ein Vorhaben (auch tote Eintraege); `unchanged` = war kein Mitglied. */
export async function removeFolderFromWorklist(
  libraryId: string,
  userEmail: string,
  listId: string,
  folderId: string,
): Promise<{ list: WorklistDoc; unchanged: boolean } | null> {
  const col = await getCol(libraryId)
  // Mitgliedschaft gehoert in den Query (Bauart wie addFolderToWorklist):
  // modifiedCount taugt nicht als unchanged-Signal, weil das $set auf
  // updatedAt sonst JEDEN Aufruf als Aenderung zaehlt — und ein Entfernen
  // ohne Treffer darf auch kein neues updatedAt stempeln.
  const result = await col.updateOne(
    { userEmail, listId, 'folders.folderId': folderId },
    { $pull: { folders: { folderId } }, $set: { updatedAt: new Date().toISOString() } },
  )
  const list = await getWorklist(libraryId, userEmail, listId)
  if (list === null) return null
  return { list, unchanged: result.matchedCount === 0 }
}

/** Loescht die Liste; false = unbekannt (Route: 404). Report und Archiv bleiben unberuehrt. */
export async function deleteWorklist(
  libraryId: string,
  userEmail: string,
  listId: string,
): Promise<boolean> {
  const col = await getCol(libraryId)
  const result = await col.deleteOne({ userEmail, listId })
  return result.deletedCount === 1
}
