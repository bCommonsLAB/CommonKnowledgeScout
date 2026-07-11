/**
 * @fileoverview Repository fuer LLM-Overlap-Berichte (Plan summen-und-
 * synergie-aggregation, Stufe 3, Todos llm-overlap-persist + llm-report-output).
 *
 * @description
 * Zwei Persistenz-Pfade:
 * 1. Bericht-Dokumente (Markdown + Kennzahlen) in der Collection
 *    `overlap_reports` — ein Dokument pro Lauf, juengster gewinnt in der UI.
 * 2. Korrekturfaktoren pro Massnahme als READ-ONLY KI-Einschaetzung in
 *    `docMetaJson` (flache snake_case-Keys analog `bewertung_*`):
 *    korrektur_faktor_co2, korrektur_faktor_kosten, korrektur_ueberlappt_mit,
 *    korrektur_begruendung, korrektur_modell, korrektur_stand.
 *
 * Ein Lauf ist idempotent wiederholbar: der neue Stand ueberschreibt den
 * alten, `korrektur_stand` macht die Version sichtbar.
 */

import type { Collection, Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import { getCollectionOnly } from '@/lib/repositories/vector-repo'

const REPORTS_COLLECTION = 'overlap_reports'

/** Kennzahlen eines Laufs (deterministisch in Code gerechnet, nicht vom LLM). */
export interface OverlapReportStats {
  /** Analysierte Massnahmen (mit CO2-Wert, innerhalb des Caps). */
  measures: number
  /** Massnahmen ohne CO2-Angabe (nicht analysiert, explizit ausgewiesen). */
  missingCo2: number
  /** Wegen Cap nicht analysierte Massnahmen (0 = vollstaendig). */
  dropped: number
  /** Analysierte Massnahmen, fuer die das LLM KEINEN Faktor geliefert hat. */
  withoutFactor: number
  naiveCo2: number
  adjustedCo2: number
  naiveKosten: number
  adjustedKosten: number
}

/**
 * Berichts-Art in `overlap_reports`: 'overlap' = LLM-Wirkungsbericht
 * (Stufe 3, bis 2026-07-11 "Synergie-Bericht"), 'enabler' = deterministischer
 * Enabler-Hebel-Bericht (Stufe 4b). Beide sind EIGENSTAENDIG (Entscheid
 * revidiert 2026-07-11). Fehlendes Feld = 'overlap' (Bestand vor Stufe 4b).
 */
export type OverlapReportKind = 'overlap' | 'enabler'

export interface OverlapReportDoc {
  libraryId: string
  createdAt: Date
  /** LLM-Modell des Laufs (korrektur_modell); 'deterministic' beim Enabler-Bericht. */
  model: string
  /** Vollstaendiger Bericht als Markdown (Prosa + Ergebnis-Tabelle). */
  markdown: string
  stats: OverlapReportStats
  /** Galerie-Filter des Laufs (leer = ganze Library). */
  filters?: Record<string, string[]>
  kind?: OverlapReportKind
}

let reportsCol: Collection<OverlapReportDoc> | null = null
let indexEnsured = false

async function getReportsCol(): Promise<Collection<OverlapReportDoc>> {
  if (reportsCol) return reportsCol
  reportsCol = await getCollection<OverlapReportDoc>(REPORTS_COLLECTION)
  if (!indexEnsured) {
    await reportsCol.createIndex({ libraryId: 1, createdAt: -1 })
    indexEnsured = true
  }
  return reportsCol
}

export async function insertOverlapReport(doc: OverlapReportDoc): Promise<void> {
  const col = await getReportsCol()
  await col.insertOne(doc)
}

/**
 * Juengster Bericht einer Library je Art (null = noch nie gerechnet).
 * Bestand ohne `kind`-Feld zaehlt als 'overlap' (Rueckwaertskompatibilitaet).
 */
export async function getLatestOverlapReport(
  libraryId: string,
  kind: OverlapReportKind = 'overlap',
): Promise<OverlapReportDoc | null> {
  const col = await getReportsCol()
  const kindFilter =
    kind === 'overlap'
      ? { $or: [{ kind: 'overlap' as const }, { kind: { $exists: false } }] }
      : { kind }
  return col.findOne({ libraryId, ...kindFilter }, { sort: { createdAt: -1 }, projection: { _id: 0 } })
}

/** Korrekturfaktoren einer Massnahme (LLM-Urteil eines Laufs). */
export interface DocOverlapFactors {
  faktorCo2: number
  faktorKosten: number
  /** Massnahmen-Nrn/Titel-Kurzformen der ueberlappenden Massnahmen. */
  ueberlapptMit: string[]
  begruendung: string
  modell: string
  /** ISO-Zeitstempel des Laufs (Versionierung). */
  stand: string
}

/**
 * Schreibt die Faktoren als flache read-only Keys in `docMetaJson`
 * (dot-notation, ueberschreibt nur die korrektur_*-Felder).
 */
export async function setDocOverlapFactors(
  libraryKey: string,
  fileId: string,
  factors: DocOverlapFactors,
): Promise<boolean> {
  const col = await getCollectionOnly(libraryKey)
  const res = await col.updateOne(
    { _id: `${fileId}-meta`, kind: 'meta' } as Partial<Document>,
    {
      $set: {
        'docMetaJson.korrektur_faktor_co2': factors.faktorCo2,
        'docMetaJson.korrektur_faktor_kosten': factors.faktorKosten,
        'docMetaJson.korrektur_ueberlappt_mit': factors.ueberlapptMit,
        'docMetaJson.korrektur_begruendung': factors.begruendung,
        'docMetaJson.korrektur_modell': factors.modell,
        'docMetaJson.korrektur_stand': factors.stand,
      },
    },
  )
  return res.matchedCount > 0
}

/** Enabler-Hebel einer Massnahme (Stufe 4 — deterministisch aus den Kanten). */
export interface DocLeverage {
  /** Anteilig geerbte, bereinigte CO2-Wirkung (kt/Jahr, Schaetzung). */
  hebelCo2Kt: number
  /** Kurzlabels (Nr/Titel) der wichtigsten aktivierten Massnahmen. */
  aktiviert: string[]
  beta: number
  /** ISO-Zeitstempel des Hebel-Laufs (Versionierung, analog korrektur_stand). */
  stand: string
  /** ISO-Zeitstempel der zugrunde liegenden Relations-Berechnung (Staleness). */
  relationsStand: string | null
}

/**
 * Schreibt die Hebel-Kennzahl als flache read-only Keys in `docMetaJson`
 * (analog korrektur_*; NUR CO2 — Kosten-Vererbung bewusst nicht, Plan-Entscheid
 * 2026-07-09). Nur fuer Massnahmen mit >= 1 Enabler-Kante aufrufen.
 */
export async function setDocLeverage(
  libraryKey: string,
  fileId: string,
  leverage: DocLeverage,
): Promise<boolean> {
  const col = await getCollectionOnly(libraryKey)
  const res = await col.updateOne(
    { _id: `${fileId}-meta`, kind: 'meta' } as Partial<Document>,
    {
      $set: {
        'docMetaJson.hebel_co2_kt': leverage.hebelCo2Kt,
        'docMetaJson.hebel_aktiviert': leverage.aktiviert,
        'docMetaJson.hebel_beta': leverage.beta,
        'docMetaJson.hebel_stand': leverage.stand,
        'docMetaJson.hebel_relations_stand': leverage.relationsStand,
      },
    },
  )
  return res.matchedCount > 0
}
