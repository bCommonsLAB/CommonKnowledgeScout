/**
 * @fileoverview Sitzungs-Register der Agentensicht (Plan sitzungen-register, Welle R1).
 *
 * @description
 * Ein Dokument je Arbeitssitzung und Library, fuer alle mit Zugriff auf die
 * Library (Owner-Entscheid E1 — kein userEmail-Schluessel). Muster:
 * `docs/architecture/mongodb-repository-pattern.md`. Was geschrieben wird,
 * entscheiden die reinen Planer unter `src/lib/agent-view/sitzungen-register/`;
 * hier stehen nur die Mongo-Zugriffe. Eine Kennung, die schon eine andere
 * Zeile traegt, wirft {@link SitzungsKennungVergebenError} (race-sicher ueber
 * die Unique-Indizes auf `registerId` und `sitzungId`).
 *
 * @module repositories
 */

import type { AnyBulkWriteOperation, Collection } from 'mongodb'
import type { AbgleichPlan } from '@/lib/agent-view/sitzungen-register/abgleich'
import type { SitzungsRegisterDoc } from '@/lib/agent-view/sitzungen-register/types'
import { getCollection } from '@/lib/mongodb-service'

/** Kennung oder Register-Schluessel schon vergeben — Werkzeug: Fehler je Zeile, Route: 409. */
export class SitzungsKennungVergebenError extends Error {
  readonly code = 'kennung_vergeben' as const
}

const collectionCache = new Map<string, Collection<SitzungsRegisterDoc>>()
const indexCache = new Set<string>()

export function getSitzungenCollectionName(libraryId: string): string {
  return `agent_view_sitzungen__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<SitzungsRegisterDoc>> {
  const name = getSitzungenCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<SitzungsRegisterDoc>(name)
  collectionCache.set(name, col)
  return col
}

export async function ensureSitzungenIndexes(libraryId: string): Promise<void> {
  const name = getSitzungenCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await col.createIndex({ libraryId: 1, registerId: 1 }, { unique: true })
  // Partiell statt sparse: Zeilen ohne Kennung tragen das Feld nicht.
  await col.createIndex({ libraryId: 1, sitzungId: 1 }, { unique: true, partialFilterExpression: { sitzungId: { $type: 'string' } } })
  indexCache.add(name)
}

function istDuplikatFehler(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
}

function ohneId(doc: SitzungsRegisterDoc): SitzungsRegisterDoc {
  const { _id: _ignoriert, ...rest } = doc
  return rest
}

export async function listeRegister(libraryId: string): Promise<SitzungsRegisterDoc[]> {
  const col = await getCol(libraryId)
  return (await col.find({ libraryId }).toArray()).map(ohneId)
}

export async function holeZeile(libraryId: string, registerId: string): Promise<SitzungsRegisterDoc | null> {
  const col = await getCol(libraryId)
  const doc = await col.findOne({ libraryId, registerId })
  return doc === null ? null : ohneId(doc)
}

export async function holeNachKennung(libraryId: string, sitzungId: string): Promise<SitzungsRegisterDoc | null> {
  const col = await getCol(libraryId)
  const doc = await col.findOne({ libraryId, sitzungId })
  return doc === null ? null : ohneId(doc)
}

export async function legeZeileAn(libraryId: string, doc: SitzungsRegisterDoc): Promise<void> {
  await ensureSitzungenIndexes(libraryId)
  const col = await getCol(libraryId)
  try {
    await col.insertOne({ ...doc })
  } catch (error) {
    if (istDuplikatFehler(error)) throw new SitzungsKennungVergebenError(`Register-Zeile ${doc.registerId} gibt es schon`)
    throw error
  }
}

/** Aendert eine Zeile; null = unbekannt. Umschluesseln auf eine vergebene Kennung wirft benannt. */
export async function aendereZeile(
  libraryId: string,
  registerId: string,
  aenderung: { set: Partial<SitzungsRegisterDoc>; unset?: readonly string[]; neuePrs?: readonly string[] },
): Promise<SitzungsRegisterDoc | null> {
  await ensureSitzungenIndexes(libraryId)
  const col = await getCol(libraryId)
  const update: Record<string, unknown> = { $set: aenderung.set }
  if (aenderung.unset && aenderung.unset.length > 0) update.$unset = Object.fromEntries(aenderung.unset.map((f) => [f, '']))
  if (aenderung.neuePrs && aenderung.neuePrs.length > 0) update.$addToSet = { prs: { $each: [...aenderung.neuePrs] } }
  try {
    const doc = await col.findOneAndUpdate({ libraryId, registerId }, update, { returnDocument: 'after' })
    return doc === null ? null : ohneId(doc)
  } catch (error) {
    if (istDuplikatFehler(error)) {
      throw new SitzungsKennungVergebenError(`Kennung ${String(aenderung.set.sitzungId ?? registerId)} traegt schon eine andere Zeile`)
    }
    throw error
  }
}

export async function loescheZeile(libraryId: string, registerId: string): Promise<boolean> {
  const col = await getCol(libraryId)
  return (await col.deleteOne({ libraryId, registerId })).deletedCount === 1
}

export interface AbgleichSchreibErgebnis {
  /** null = Treiber hat im Fehlerfall keine Zahlen geliefert. */
  angelegt: number | null
  aktualisiert: number | null
  fehler: string[]
}

interface BulkFehler {
  writeErrors?: Array<{ errmsg?: string; index?: number }> | { errmsg?: string; index?: number }
  result?: { insertedCount?: number; modifiedCount?: number }
}

/** Schreibt den Plan eines Sichten-Laufs in einem ungeordneten Stapel; Fehler je Zeile, nie still. */
export async function schreibeAbgleich(libraryId: string, plan: AbgleichPlan): Promise<AbgleichSchreibErgebnis> {
  const ops: Array<AnyBulkWriteOperation<SitzungsRegisterDoc>> = [
    ...plan.neu.map((doc) => ({ insertOne: { document: { ...doc } } })),
    ...plan.aenderungen.map((a) => {
      const set: Record<string, unknown> = { geaendertAm: a.am }
      if (a.ablage) set.ablage = a.ablage
      if (a.stempel) set[`berichtet.${a.stempel.feld}`] = a.stempel.am
      const update: Record<string, unknown> = { $set: set }
      if (a.neueBelegSourceIds.length > 0) update.$addToSet = { belegSourceIds: { $each: a.neueBelegSourceIds } }
      return { updateOne: { filter: { libraryId, registerId: a.registerId }, update } }
    }),
  ]
  return fuehreStapelAus(libraryId, ops)
}

/** Schreibt den Plan des Listen-Imports (R2): neue Zeilen und `$set` je geaenderter Zeile. */
export async function schreibeImport(
  libraryId: string,
  plan: { neu: readonly SitzungsRegisterDoc[]; aenderungen: ReadonlyArray<{ registerId: string; set: Partial<SitzungsRegisterDoc> }> },
): Promise<AbgleichSchreibErgebnis> {
  return fuehreStapelAus(libraryId, [
    ...plan.neu.map((doc) => ({ insertOne: { document: { ...doc } } })),
    ...plan.aenderungen.map((a) => ({ updateOne: { filter: { libraryId, registerId: a.registerId }, update: { $set: a.set } } })),
  ])
}

async function fuehreStapelAus(
  libraryId: string,
  ops: Array<AnyBulkWriteOperation<SitzungsRegisterDoc>>,
): Promise<AbgleichSchreibErgebnis> {
  if (ops.length === 0) return { angelegt: 0, aktualisiert: 0, fehler: [] }
  await ensureSitzungenIndexes(libraryId)
  const col = await getCol(libraryId)
  try {
    const r = await col.bulkWrite(ops, { ordered: false })
    return { angelegt: r.insertedCount, aktualisiert: r.modifiedCount, fehler: [] }
  } catch (error) {
    const b = error as BulkFehler
    if (b.writeErrors === undefined) throw error
    const liste = Array.isArray(b.writeErrors) ? b.writeErrors : [b.writeErrors]
    return {
      angelegt: b.result?.insertedCount ?? null,
      aktualisiert: b.result?.modifiedCount ?? null,
      fehler: liste.map((w) => `Operation ${w.index ?? '?'}: ${w.errmsg ?? 'unbekannter Schreibfehler'}`),
    }
  }
}
