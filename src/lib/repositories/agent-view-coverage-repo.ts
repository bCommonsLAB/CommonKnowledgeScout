/**
 * @fileoverview Coverage-Report-Cache der Agentensicht (MongoDB, Welle 1).
 *
 * @description
 * EIN Dokument je Library — der juengste Scan. Der Report ist ABGELEITET und
 * WEGWERFBAR (Projektauftrag §2 Leitprinzip 2): Loeschen ist folgenlos, der
 * naechste Scan stellt ihn vollstaendig wieder her (Akzeptanzkriterium 6).
 * Deshalb gibt es hier bewusst KEINEN Verlauf und keine Historie — das waere
 * ein Wahrheitsanspruch, den die Sicht nicht erhebt.
 *
 * Muster nach `docs/architecture/mongodb-repository-pattern.md`
 * (Collection je Library, Collection-/Index-Cache im Modul-Scope).
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { CoverageReport } from '@/lib/agent-view/types'
import { computeCoverageDelta, type CoverageDelta } from '@/lib/agent-view/coverage-delta'

/**
 * Obergrenze gespeicherter Einzel-Befunde (16-MB-Dokumentgrenze von MongoDB).
 * Wird gekappt, sagt das Dokument es AUSDRUECKLICH (`gapsTruncated`) — kein
 * stilles Abschneiden (`no-silent-fallbacks.mdc`).
 */
export const MAX_STORED_GAPS = 5000

export interface CoverageReportDoc {
  _id?: string
  libraryId: string
  report: CoverageReport
  generatedAt: string
  /** true, wenn `report.gaps` beim Speichern gekappt wurde. */
  gapsTruncated: boolean
  /** Gesamtzahl der Befunde VOR dem Kappen. */
  totalGaps: number
  /** D1: erledigt/neu seit dem letzten Scan GLEICHEN Scopes; null = siehe deltaHinweis. */
  delta?: CoverageDelta | null
  /** Warum es kein Delta gibt (erster Scan, anderer Scope, gekappter Vorlauf). */
  deltaHinweis?: string | null
  createdAt: string
  updatedAt: string
}

const collectionCache = new Map<string, Collection<CoverageReportDoc>>()
const indexCache = new Set<string>()

export function getCoverageReportCollectionName(libraryId: string): string {
  return `agent_view_coverage__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<CoverageReportDoc>> {
  const name = getCoverageReportCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<CoverageReportDoc>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(libraryId: string): Promise<void> {
  const name = getCoverageReportCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await col.createIndex({ libraryId: 1 }, { unique: true })
  indexCache.add(name)
}

/** Speichert den juengsten Report (ersetzt den vorherigen vollstaendig). */
export async function saveCoverageReport(report: CoverageReport): Promise<CoverageReportDoc> {
  if (!report.libraryId) throw new Error('CoverageReport ohne libraryId')
  await ensureIndexes(report.libraryId)
  const col = await getCol(report.libraryId)
  const now = new Date().toISOString()
  // D1: Fortschritt seit dem letzten Scan festhalten, BEVOR er ueberschrieben wird.
  const previous = await col.findOne({ libraryId: report.libraryId })
  const { delta, hinweis: deltaHinweis } = computeCoverageDelta({
    previous: previous
      ? { report: previous.report, generatedAt: previous.generatedAt, gapsTruncated: previous.gapsTruncated }
      : null,
    next: report,
  })
  const totalGaps = report.gaps.length
  const gapsTruncated = totalGaps > MAX_STORED_GAPS
  const stored: CoverageReport = gapsTruncated ? { ...report, gaps: report.gaps.slice(0, MAX_STORED_GAPS) } : report

  const doc: Omit<CoverageReportDoc, '_id' | 'createdAt'> = {
    libraryId: report.libraryId,
    report: stored,
    generatedAt: report.generatedAt,
    gapsTruncated,
    totalGaps,
    delta,
    deltaHinweis,
    updatedAt: now,
  }
  await col.updateOne(
    { libraryId: report.libraryId },
    { $set: doc, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )
  return { ...doc, createdAt: now }
}

/** Juengster Report einer Library; null = noch nie gescannt. */
export async function getCoverageReport(libraryId: string): Promise<CoverageReportDoc | null> {
  const col = await getCol(libraryId)
  return col.findOne({ libraryId })
}

/** Verwirft den Report — folgenlos, der naechste Scan baut ihn neu auf. */
export async function deleteCoverageReport(libraryId: string): Promise<void> {
  const col = await getCol(libraryId)
  await col.deleteOne({ libraryId })
}
