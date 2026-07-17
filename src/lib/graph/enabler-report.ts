/**
 * @fileoverview Eigenstaendiger Enabler-Bericht (Plan summen-und-synergie-
 * aggregation, Stufe 4b — User-Wunsch 2026-07-09: "erklaerender Report,
 * welche Enabler wichtig sind", direkt bei den Computed Relations).
 *
 * @description
 * DETERMINISTISCH (kein LLM, kein external-job): laedt den vollen Bestand
 * lean aus Mongo (inkl. persistierter korrektur_faktor_co2 aus Stufe 3,
 * falls vorhanden), rechnet den Hebel-Pass (overlap-report-leverage) und
 * speichert den Bericht als `kind: 'enabler'` in `overlap_reports`.
 * Laufzeit ~1-2s — die Recompute-Route kann synchron antworten.
 *
 * @usedIn
 * - src/app/api/library/[libraryId]/enabler-report/recompute/route.ts
 */

import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { runLeveragePass, DEFAULT_LEVERAGE_BETA, type LeverageDocInput } from '@/lib/external-jobs/overlap-report-leverage'
import { insertOverlapReport, type OverlapReportStats } from '@/lib/repositories/overlap-report-repo'
import type { Document } from 'mongodb'
import type { Library } from '@/types/library'

const DEFAULT_GROUP_FIELD = 'dominant_perspektive'
const CATALOG_LIMIT = 2000

export interface EnablerReportResult {
  markdown: string
  enablers: number
  persisted: number
  measures: number
}

/** Zahl aus number ODER string lesen (Mongo-Bestand ist gemischt). */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return undefined
}

/** Rechnet den Enabler-Bericht und persistiert ihn (kind 'enabler'). */
export async function computeAndStoreEnablerReport(library: Library): Promise<EnablerReportResult> {
  const libraryId = library.id
  const libraryKey = getCollectionNameForLibrary(library)
  const groupField = library.config?.chat?.gallery?.graph?.colorField || DEFAULT_GROUP_FIELD

  // Lean-Query statt findDocs: nur die Felder des Hebel-Passes (kein Embedding,
  // keine Lookups). korrektur_faktor_co2 kommt aus dem letzten Stufe-3-Lauf.
  const col = await getCollectionOnly(libraryKey)
  const rows = await col
    .find({ kind: 'meta', libraryId } as unknown as Document, {
      projection: {
        _id: 0, fileId: 1, title: 1, shortTitle: 1, fileName: 1,
        [`docMetaJson.co2_einsparung_kt`]: 1, [`docMetaJson.massnahme_nr`]: 1,
        [`docMetaJson.korrektur_faktor_co2`]: 1, [`docMetaJson.${groupField}`]: 1,
      },
    })
    .limit(CATALOG_LIMIT)
    .toArray()

  const items: LeverageDocInput[] = []
  const factorCo2ByFileId = new Map<string, number>()
  let withCo2 = 0
  for (const r of rows) {
    const fileId = typeof r.fileId === 'string' ? r.fileId : undefined
    if (!fileId) continue
    const meta = (r.docMetaJson ?? {}) as Record<string, unknown>
    const co2 = toNumber(meta.co2_einsparung_kt)
    if (co2 !== undefined) withCo2 += 1
    const factor = toNumber(meta.korrektur_faktor_co2)
    if (factor !== undefined) factorCo2ByFileId.set(fileId, factor)
    items.push({
      fileId,
      title: typeof r.title === 'string' ? r.title : undefined,
      shortTitle: typeof r.shortTitle === 'string' ? r.shortTitle : undefined,
      fileName: typeof r.fileName === 'string' ? r.fileName : undefined,
      co2_einsparung_kt: co2,
      massnahme_nr: typeof meta.massnahme_nr === 'string' || typeof meta.massnahme_nr === 'number' ? (meta.massnahme_nr as string | number) : undefined,
      [groupField]: meta[groupField],
    })
  }
  if (items.length === 0) throw new Error('Enabler-Bericht: keine Massnahmen im Bestand')

  const createdAt = new Date()
  const stand = createdAt.toISOString()
  const leverage = await runLeveragePass({
    libraryId, libraryKey, items, factorCo2ByFileId, groupField, stand,
  })

  const markdown =
    `# Enabler-Bericht: Hebel-Massnahmen\n\n` +
    `*Stand: ${stand.slice(0, 10)} · deterministisch aus den berechneten Beziehungen ` +
    `(kein LLM-Rechnen) · Stufe-3-Korrekturfaktoren ${factorCo2ByFileId.size > 0 ? 'einbezogen' : 'noch nicht vorhanden (naive CO2-Werte)'}*\n` +
    `${leverage.markdownSection}`

  // stats-Vertrag der Collection: fuer den Enabler-Bericht sind nur die
  // Mengen-Felder aussagekraeftig; Summen bleiben 0 (kein Summen-Bericht).
  const stats: OverlapReportStats = {
    measures: items.length, missingCo2: items.length - withCo2, dropped: 0,
    withoutFactor: withCo2 - factorCo2ByFileId.size,
    naiveCo2: 0, adjustedCo2: 0, naiveKosten: 0, adjustedKosten: 0,
  }
  await insertOverlapReport({
    libraryId, createdAt, model: 'deterministic', markdown, stats, kind: 'enabler',
  })
  return { markdown, enablers: leverage.enablers, persisted: leverage.persisted, measures: items.length }
}

export { DEFAULT_LEVERAGE_BETA }
