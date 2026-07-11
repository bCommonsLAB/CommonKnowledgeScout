/**
 * @fileoverview External-Job Phase: phase-enabler-report (Stufe 4b,
 * template-getrieben seit 2026-07-11).
 *
 * @description
 * Enabler-Bericht als eigenstaendiger Lauf: die Hebel-Rechnung bleibt
 * DETERMINISTISCH (runLeveragePass: Kanten laden, anteilige Vererbung,
 * hebel_*-Persistenz); die Prosa (Titel, Cluster-Analyse in ganzen Saetzen,
 * Handlungsempfehlungen) kommt aus dem Secretary /transformer/template mit
 * der editierbaren Vorlage 'bericht-enabler' (Builtin oder Library-Kopie).
 * Der fertige Bericht = Template-Body, gefuellt mit LLM-Feldern + den
 * deterministischen Variablen (hebel_tabellen, kennzahlen, beta, ...).
 * Persistenz: `overlap_reports` mit kind 'enabler'.
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LibraryService } from '@/lib/services/library-service'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { runLeveragePass, type LeverageDocInput } from './overlap-report-leverage'
import { runReportTransform } from './report-transform'
import { renderTemplateBody } from './template-body-builder'
import { insertOverlapReport, type OverlapReportStats } from '@/lib/repositories/overlap-report-repo'
import type { Document } from 'mongodb'
import type { ExternalJob } from '@/types/external-job'

const DEFAULT_MODEL = 'gpt-4.1-mini'
const DEFAULT_GROUP_FIELD = 'dominant_perspektive'
const CATALOG_LIMIT = 2000

interface EnablerReportOptions {
  phase?: string
  /** LLM-Modell fuer den Prosa-Pass. */
  model?: string
  /** Bericht-Vorlage; sonst Library-Kopie 'bericht-enabler' bzw. Builtin. */
  reportTemplateId?: string
}

export interface EnablerReportPhaseResult {
  measures: number
  enablers: number
  persisted: number
  reportChars: number
}

/** Zahl aus number ODER string lesen (Mongo-Bestand ist gemischt). */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return undefined
}

export async function runEnablerReportPhase(job: ExternalJob): Promise<EnablerReportPhaseResult> {
  const repo = new ExternalJobsRepository()
  const opts = (job.correlation?.options || {}) as EnablerReportOptions
  const model = opts.model || DEFAULT_MODEL
  await repo.updateStep(job.jobId, 'phase-enabler-report', { status: 'running', startedAt: new Date() })

  const library = await LibraryService.getInstance().getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-enabler-report: Library nicht gefunden')
  const libraryKey = getCollectionNameForLibrary(library)
  const groupField = library.config?.chat?.gallery?.graph?.colorField || DEFAULT_GROUP_FIELD

  // ── 1) Lean-Query (nur Hebel-Felder; korrektur_faktor_co2 aus Stufe 3) ────
  const col = await getCollectionOnly(libraryKey)
  const rows = await col
    .find({ kind: 'meta', libraryId: job.libraryId } as unknown as Document, {
      projection: {
        _id: 0, fileId: 1, title: 1, shortTitle: 1, fileName: 1,
        ['docMetaJson.co2_einsparung_kt']: 1, ['docMetaJson.massnahme_nr']: 1,
        ['docMetaJson.korrektur_faktor_co2']: 1, [`docMetaJson.${groupField}`]: 1,
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
  if (items.length === 0) throw new Error('phase-enabler-report: keine Massnahmen im Bestand')

  // ── 2) Deterministische Hebel-Rechnung + hebel_*-Persistenz ──────────────
  const createdAt = new Date()
  const stand = createdAt.toISOString()
  const leverage = await runLeveragePass({
    libraryId: job.libraryId, libraryKey, items, factorCo2ByFileId, groupField, stand,
  })
  await repo.traceAddEvent(job.jobId, {
    spanId: 'phase-enabler-report', name: 'enabler_leverage_computed', level: 'info',
    attributes: { enablers: leverage.enablers, persisted: leverage.persisted, clusters: leverage.clusters.length },
  }).catch(() => {})

  const kennzahlen = [
    `- Massnahmen im Bestand: ${items.length} (davon ${withCo2} mit CO2-Angabe)`,
    `- Enabler mit Hebelwirkung (>= 1 Beziehungs-Kante): ${leverage.enablers}`,
    `- Daempfung beta: ${leverage.beta.toLocaleString('de-DE')}`,
    `- Stufe-3-Korrekturfaktoren: ${factorCo2ByFileId.size > 0 ? `${factorCo2ByFileId.size} einbezogen` : 'noch nicht vorhanden (naive CO2-Werte)'}`,
    `- Beziehungs-Stand: ${leverage.relationsStand ? leverage.relationsStand.slice(0, 10) : 'unbekannt'}`,
  ].join('\n')

  // ── 3) LLM-Prosa via editierbarem Template + Body-Rendering ──────────────
  const { llmFields, markdownBody } = await runReportTransform({
    kind: 'enabler', job, repo, spanId: 'phase-enabler-report', model,
    sourceText: `Kennzahlen:\n${kennzahlen}\n\nHebel-Tabellen je Cluster:\n\n${leverage.tablesMarkdown}`,
    reportTemplateId: opts.reportTemplateId,
    contextJson: { clusters: leverage.clusters, beta: leverage.beta, relationsStand: leverage.relationsStand },
  })
  const markdown = renderTemplateBody({
    body: markdownBody,
    values: {
      ...llmFields,
      kennzahlen,
      hebel_tabellen: leverage.tablesMarkdown,
      beta: leverage.beta.toLocaleString('de-DE'),
      beziehungs_stand: leverage.relationsStand ? leverage.relationsStand.slice(0, 10) : 'unbekannt',
      stand: stand.slice(0, 10),
      modell: model,
    },
  }).trim()

  // stats-Vertrag der Collection: fuer den Enabler-Bericht sind nur die
  // Mengen-Felder aussagekraeftig; Summen bleiben 0 (kein Summen-Bericht).
  const stats: OverlapReportStats = {
    measures: items.length, missingCo2: items.length - withCo2, dropped: 0,
    withoutFactor: withCo2 - factorCo2ByFileId.size,
    naiveCo2: 0, adjustedCo2: 0, naiveKosten: 0, adjustedKosten: 0,
  }
  await insertOverlapReport({ libraryId: job.libraryId, createdAt, model, markdown, stats, kind: 'enabler' })

  await repo.updateStep(job.jobId, 'phase-enabler-report', {
    status: 'completed', endedAt: new Date(),
    details: { measures: items.length, enablers: leverage.enablers, persisted: leverage.persisted },
  })
  await repo.setStatus(job.jobId, 'completed')
  return {
    measures: items.length, enablers: leverage.enablers,
    persisted: leverage.persisted, reportChars: markdown.length,
  }
}
