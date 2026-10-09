/**
 * @fileoverview Satz-Segmente eines Audio-Transkripts (MongoDB).
 *
 * @description
 * Ein Dokument je Quelle — wie der Transkript-Datensatz im Shadow-Twin
 * (`artifacts.transcript`, ein Record ohne Sprach-Schluessel): die Segmente des letzten
 * Transkriptions-Laufs mit Zeitmarken und Verlaesslichkeitswerten. Bewusst NICHT
 * im Shadow-Twin-Dokument — bei 50 Minuten Audio sind das ~300–600 Eintraege,
 * die jede Twin-Abfrage mitschleppen wuerde. Jeder neue Lauf ersetzt das
 * Dokument (auch mit leerer Liste), damit nie Werte eines alten Laufs neben
 * einem neuen Transkript stehen.
 *
 * Key ist die `sourceId`. Auf pfadbasierten Providern aendert ein Umzug sie;
 * `rekeyTranscriptSegments` zieht nach (Aufruf in `move-family.ts`).
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { TranscriptSegment } from '@/lib/transkript-verlaesslichkeit/segmente'

export interface TranscriptSegmentsDocument {
  _id?: string
  libraryId: string
  sourceId: string
  /** Zielsprache des Laufs (nur Information; der Schluessel ist die Quelle). */
  targetLanguage: string
  jobId: string
  llmModel: string | null
  dataLanguage: string | null
  segments: TranscriptSegment[]
  createdAt: string
  updatedAt: string
}

const collectionCache = new Map<string, Collection<TranscriptSegmentsDocument>>()
const indexCache = new Set<string>()

export function getTranscriptSegmentsCollectionName(libraryId: string): string {
  return `transcript_segments__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<TranscriptSegmentsDocument>> {
  const name = getTranscriptSegmentsCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<TranscriptSegmentsDocument>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(libraryId: string): Promise<void> {
  const name = getTranscriptSegmentsCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await col.createIndex({ libraryId: 1, sourceId: 1 }, { unique: true })
  indexCache.add(name)
}

export interface SaveTranscriptSegmentsArgs {
  libraryId: string
  sourceId: string
  targetLanguage: string
  jobId: string
  llmModel: string | null
  dataLanguage: string | null
  segments: TranscriptSegment[]
}

/** Ersetzt die Segmente der Quelle (Upsert) — auch mit leerer Liste. */
export async function saveTranscriptSegments(args: SaveTranscriptSegmentsArgs): Promise<void> {
  if (!args.libraryId || !args.sourceId) throw new Error('saveTranscriptSegments: libraryId und sourceId erforderlich')
  await ensureIndexes(args.libraryId)
  const col = await getCol(args.libraryId)
  const jetzt = new Date().toISOString()
  const { libraryId, sourceId, ...rest } = args
  await col.updateOne(
    { libraryId, sourceId },
    { $set: { ...rest, updatedAt: jetzt }, $setOnInsert: { libraryId, sourceId, createdAt: jetzt } },
    { upsert: true },
  )
}

export async function getTranscriptSegments(args: {
  libraryId: string
  sourceId: string
}): Promise<TranscriptSegmentsDocument | null> {
  const col = await getCol(args.libraryId)
  return col.findOne({ libraryId: args.libraryId, sourceId: args.sourceId }, { projection: { _id: 0 } })
}

/** Nach einem Umzug mit Id-Wechsel: Segmente der Quelle auf die neue Id. */
export async function rekeyTranscriptSegments(libraryId: string, alteSourceId: string, neueSourceId: string): Promise<number> {
  if (alteSourceId === neueSourceId) return 0
  const col = await getCol(libraryId)
  const res = await col.updateMany(
    { libraryId, sourceId: alteSourceId },
    { $set: { sourceId: neueSourceId, updatedAt: new Date().toISOString() } },
  )
  return res.modifiedCount
}
