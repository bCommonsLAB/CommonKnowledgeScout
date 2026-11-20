/**
 * @fileoverview Schreibzugriff auf die globale Modell-Liste (`llm_models`).
 *
 * @description
 * Nur fuer die Admin-Routen unter `/api/admin/llm-models/**`. Liest auch
 * inaktive Eintraege und die Verwaltungsfelder (`probe`, `updatedBy`), die
 * `llm-models-repo.ts` fuer die oeffentliche Liste ausblendet. Geloescht wird
 * nie: abgeschaltete Modelle bleiben als Eintrag, damit Libraries, die sie
 * eingestellt haben, nicht still ins Leere zeigen.
 *
 * @module chat
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { ModellProbe, SprachmodellAenderung } from '@/types/sprachmodell'
import { LLM_MODELS_COLLECTION, type LlmModel } from './llm-models-repo'

export interface LlmModelAdmin extends LlmModel {
  probe?: ModellProbe
  /** E-Mail der letzten Aenderung (nur intern sichtbar). */
  updatedBy?: string
}

async function sammlung(): Promise<Collection<LlmModelAdmin>> {
  return getCollection<LlmModelAdmin>(LLM_MODELS_COLLECTION)
}

/** Alle Eintraege, aktive und abgeschaltete, in fester Reihenfolge. */
export async function listeAlleModelle(): Promise<LlmModelAdmin[]> {
  return (await sammlung()).find({}).sort({ order: 1, _id: 1 }).toArray()
}

export async function findeModell(modelId: string): Promise<LlmModelAdmin | null> {
  return (await sammlung()).findOne({ _id: modelId })
}

/** Legt einen Eintrag an; wirft, wenn es ihn schon gibt. */
export async function legeModellAn(eintrag: LlmModelAdmin): Promise<void> {
  const ergebnis = await (await sammlung()).updateOne(
    { _id: eintrag._id },
    { $setOnInsert: eintrag },
    { upsert: true },
  )
  if (ergebnis.upsertedCount !== 1) throw new Error(`"${eintrag._id}" steht schon in der Liste`)
}

/** Aendert Name, Staerken oder Schalter; wirft, wenn der Eintrag fehlt. */
export async function aendereModell(modelId: string, felder: SprachmodellAenderung, von: string): Promise<void> {
  const ergebnis = await (await sammlung()).updateOne(
    { _id: modelId },
    { $set: { ...felder, updatedAt: new Date().toISOString(), updatedBy: von } },
  )
  if (ergebnis.matchedCount !== 1) throw new Error(`"${modelId}" steht nicht in der Liste`)
}

/** Schreibt die neuen Positionen in einem Zug. */
export async function setzeReihenfolge(positionen: ReadonlyMap<string, number>, von: string): Promise<void> {
  const jetzt = new Date().toISOString()
  const schritte = [...positionen].map(([id, order]) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order, updatedAt: jetzt, updatedBy: von } } },
  }))
  if (schritte.length === 0) return
  const ergebnis = await (await sammlung()).bulkWrite(schritte, { ordered: true })
  if (ergebnis.matchedCount !== schritte.length) {
    throw new Error(`Reihenfolge nur teilweise gespeichert (${ergebnis.matchedCount}/${schritte.length})`)
  }
}

export async function speichereProbe(modelId: string, probe: ModellProbe, von: string): Promise<void> {
  const ergebnis = await (await sammlung()).updateOne(
    { _id: modelId },
    { $set: { probe, updatedAt: new Date().toISOString(), updatedBy: von } },
  )
  if (ergebnis.matchedCount !== 1) throw new Error(`"${modelId}" steht nicht in der Liste`)
}
