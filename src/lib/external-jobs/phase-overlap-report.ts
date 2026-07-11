/**
 * @fileoverview External-Job Phase: phase-overlap-report (Plan summen-und-
 * synergie-aggregation, Stufe 3).
 *
 * @description
 * Long-Context-LLM-Lauf ueber den Secretary Service (ADR 0001, Domaene
 * external-jobs, analog phase-doc-relations): laedt den (gefilterten)
 * Massnahmen-Bestand aus Mongo, sortiert absteigend nach CO2-Einsparung,
 * gibt die Tabelle samt Aehnlichkeits-Hinweisen in den Kontext und laesst
 * das LLM pro Massnahme ZWEI Korrekturfaktoren vergeben (CO2-Doppelzaehlung,
 * Kosten-Synergie; greedy relativ zu bereits gezaehlten). Summen und
 * Ergebnis-Tabelle rechnet DIESER Code deterministisch; ein zweiter LLM-Pass
 * schreibt nur die Prosa (Themenfelder, Groessenordnungen, Empfehlungen).
 * Persistenz: Bericht in `overlap_reports`, Faktoren read-only in
 * `docMetaJson.korrektur_*` (idempotent ueberschreibbar, korrektur_stand).
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LibraryService } from '@/lib/services/library-service'
import { getCollectionNameForLibrary, findDocs, findDocSummaries } from '@/lib/repositories/vector-repo'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { callLlmJson } from '@/lib/chat/common/llm'
import { callTemplateTransform } from '@/lib/secretary/adapter'
import { getSecretaryConfig } from '@/lib/env'
import { buildNeighborsPayload, MAX_NODES } from '@/lib/graph/doc-neighbors-service'
import { resolveOverlapReportTemplate, OVERLAP_REPORT_FIELDS } from './overlap-report-template'
import {
  insertOverlapReport,
  setDocOverlapFactors,
  type OverlapReportStats,
} from '@/lib/repositories/overlap-report-repo'
import {
  selectOverlapMeasures,
  buildOverlapCatalogTable,
  buildOverlapFactorsMessages,
  OverlapFactorsSchema,
  overlapFactorsSchemaJson,
  type OverlapCatalogEntry,
} from './overlap-report-prompt'
import {
  computeOverlapTotals,
  buildOverlapResultTable,
  buildOverlapStatsText,
  assembleOverlapReport,
  type AppliedFactors,
  type ReportProseSections,
} from './overlap-report-build'
import type { ExternalJob } from '@/types/external-job'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { Library } from '@/types/library'

const DEFAULT_MODEL = 'gpt-4.1-mini'
/** Default/Hard-Cap der analysierten Massnahmen (Output-Token-Schutz). */
const DEFAULT_MAX_MEASURES = 150
const HARD_MAX_MEASURES = 300
/** Faktoren je LLM-Pass (Output-Chunking; Input ist immer der volle Katalog). */
const FACTORS_SLICE_SIZE = 50
/** Nachbarn je Massnahme fuer die Aehnlichkeits-Hinweise. */
const HINTS_TOP_K = 4

interface OverlapReportOptions {
  phase?: string
  /** LLM-Modell fuer beide Paesse — hier laesst sich ein 1M-Kontext-Modell setzen. */
  model?: string
  filters?: Record<string, string[]>
  maxMeasures?: number
  /** Bericht-Vorlage aus der Vorlagenverwaltung; fehlt sie -> eingebauter Default. */
  reportTemplateId?: string
}

export interface OverlapReportPhaseResult {
  measures: number
  missingCo2: number
  withoutFactor: number
  reportChars: number
}

/** Deterministisch auf [0..1] begrenzen (dokumentiert, analog clampWeight). */
function clampFactor(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export async function runOverlapReportPhase(job: ExternalJob): Promise<OverlapReportPhaseResult> {
  const repo = new ExternalJobsRepository()
  const opts = (job.correlation?.options || {}) as OverlapReportOptions
  const model = opts.model || DEFAULT_MODEL
  await repo.updateStep(job.jobId, 'phase-overlap-report', { status: 'running', startedAt: new Date() })

  // ── 1) Bestand laden und Massnahmen auswaehlen ────────────────────────────
  const library = await LibraryService.getInstance().getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-overlap-report: Library nicht gefunden')
  const libraryKey = getCollectionNameForLibrary(library)
  const docFilter = facetsSelectedToMongoFilter(opts.filters)
  const { items } = await findDocs(libraryKey, job.libraryId, docFilter, { limit: 2000 })

  const summaryRows = await findDocSummaries(libraryKey, job.libraryId, docFilter, { limit: 2000 }, true)
  const summaryByFileId = new Map<string, string>()
  for (const r of summaryRows) {
    const s = r.summary || r.teaser || r.docSummary
    if (r.fileId && s) summaryByFileId.set(r.fileId, s)
  }

  const rawEntries = items.map((d: DocCardMeta) => ({
    fileId: d.fileId || d.id,
    massnahmeNr: d.massnahme_nr,
    title: d.shortTitle || d.title || d.fileName || 'Ohne Titel',
    summary: summaryByFileId.get(d.fileId || d.id),
    co2: typeof d.co2_einsparung_kt === 'number' ? d.co2_einsparung_kt : undefined,
    kosten: typeof d.kosten_eur === 'number' ? d.kosten_eur : undefined,
  }))
  const maxMeasures = Math.min(HARD_MAX_MEASURES, Math.max(1, opts.maxMeasures ?? DEFAULT_MAX_MEASURES))
  const { selected, missingCo2, dropped } = selectOverlapMeasures(rawEntries, maxMeasures)
  if (selected.length === 0) throw new Error('phase-overlap-report: keine Massnahme mit CO2-Wert im Bestand')
  // fileId wandert typsicher durch die Auswahl (generisches selectOverlapMeasures).
  const fileIdByRef = new Map<string, string>(selected.map((e) => [e.ref, e.fileId]))

  await repo.traceAddEvent(job.jobId, {
    spanId: 'phase-overlap-report', name: 'overlap_catalog_built', level: 'info',
    attributes: { loadedDocs: items.length, selected: selected.length, missingCo2: missingCo2.length, dropped, model },
  }).catch(() => {})

  // ── 2) Aehnlichkeits-Hinweise (optional, Ausfall wird ausgewiesen) ────────
  const similarityHints = await buildSimilarityHints(library, fileIdByRef)
    .catch(async (e: unknown) => {
      await repo.traceAddEvent(job.jobId, {
        spanId: 'phase-overlap-report', name: 'overlap_hints_failed', level: 'warn',
        message: e instanceof Error ? e.message : String(e),
      }).catch(() => {})
      return undefined
    })

  // ── 3) Faktoren-Paesse (Structured Output, Output-Chunking) ──────────────
  const catalogTable = buildOverlapCatalogTable(selected)
  const apiKey = library.config?.publicPublishing?.apiKey
  const factorsByRef = new Map<string, AppliedFactors>()
  for (let offset = 0; offset < selected.length; offset += FACTORS_SLICE_SIZE) {
    const slice = selected.slice(offset, offset + FACTORS_SLICE_SIZE)
    const { data } = await callLlmJson(
      {
        apiKey, model, temperature: 0.2, responseFormat: { type: 'json_object' },
        messages: buildOverlapFactorsMessages({
          catalogTable, sliceRefs: slice.map((e) => e.ref), similarityHints,
        }),
      },
      OverlapFactorsSchema,
      overlapFactorsSchemaJson,
    )
    for (const m of data.measures) {
      if (!fileIdByRef.has(m.ref)) continue // unbekannte ref -> unten als withoutFactor sichtbar
      factorsByRef.set(m.ref, {
        faktorCo2: clampFactor(m.faktor_co2),
        faktorKosten: clampFactor(m.faktor_kosten),
        ueberlapptMit: m.ueberlappt_mit.map((r) => refLabel(selected, r)),
        begruendung: m.begruendung,
      })
    }
  }

  // ── 4) Summen + Tabelle deterministisch, Prosa via Transform-by-Template ──
  // Der Secretary-Endpoint /transformer/template bekommt die Ergebnis-Tabelle
  // als Quelltext, die Rohdaten als strukturiertes JSON im context-Parameter
  // und das (frei waehlbare, z.B. 1M-Kontext-) Modell als Parameter. Das
  // Template (System-Prompt + Abschnitts-Prompts) ist editierbar
  // (reportTemplateId), sonst greift der eingebaute Default.
  const totals = computeOverlapTotals(selected, factorsByRef)
  const stats: OverlapReportStats = {
    measures: selected.length, missingCo2: missingCo2.length, dropped, ...totals,
  }
  const resultTable = buildOverlapResultTable(selected, factorsByRef)
  const sections = await runReportTemplateTransform({
    job, repo, model, resultTable, statsText: buildOverlapStatsText(stats),
    reportTemplateId: opts.reportTemplateId,
    contextJson: {
      stats,
      measures: selected.map((e) => ({
        ref: e.ref, nr: e.massnahmeNr, titel: e.title, co2: e.co2, kosten: e.kosten,
        ...(factorsByRef.get(e.ref) ?? {}),
      })),
    },
  })

  // ── 5) Persistieren (Bericht + Faktoren je Massnahme) ────────────────────
  // Entscheid REVIDIERT 2026-07-11: der Enabler-Hebel-Abschnitt wird NICHT
  // mehr angehaengt — der Enabler-Bericht ist ein eigenstaendiger Bericht
  // (kind 'enabler', enabler-report/recompute, deterministisch ohne LLM).
  const createdAt = new Date()
  const stand = createdAt.toISOString()
  const markdown = assembleOverlapReport({
    sections, resultTable, stats, model, createdAt,
    missingCo2Titles: missingCo2.map((e) => e.title),
  })
  await insertOverlapReport({ libraryId: job.libraryId, createdAt, model, markdown, stats, filters: opts.filters })
  for (const e of selected) {
    const f = factorsByRef.get(e.ref)
    if (!f) continue // ohne Faktor nichts schreiben (kein stilles 1.0)
    const fileId = fileIdByRef.get(e.ref)
    if (!fileId) continue
    await setDocOverlapFactors(libraryKey, fileId, { ...f, modell: model, stand })
  }

  await repo.updateStep(job.jobId, 'phase-overlap-report', {
    status: 'completed', endedAt: new Date(),
    details: {
      measures: selected.length, withoutFactor: stats.withoutFactor,
      missingCo2: stats.missingCo2,
    },
  })
  await repo.setStatus(job.jobId, 'completed')
  return {
    measures: selected.length, missingCo2: stats.missingCo2,
    withoutFactor: stats.withoutFactor, reportChars: markdown.length,
  }
}

/**
 * Prosa-Abschnitte via Secretary `/transformer/template` erzeugen.
 * Wirft, wenn Pflicht-Felder fehlen (kein stiller Leer-Bericht).
 */
async function runReportTemplateTransform(args: {
  job: ExternalJob
  repo: ExternalJobsRepository
  model: string
  resultTable: string
  statsText: string
  reportTemplateId?: string
  contextJson: Record<string, unknown>
}): Promise<ReportProseSections> {
  const { baseUrl, apiKey } = getSecretaryConfig()
  if (!baseUrl) throw new Error('phase-overlap-report: SECRETARY_SERVICE_URL nicht konfiguriert')
  const template = await resolveOverlapReportTemplate(args.job.libraryId, args.job.userEmail, args.reportTemplateId)
  await args.repo.traceAddEvent(args.job.jobId, {
    spanId: 'phase-overlap-report', name: 'overlap_report_template_resolved', level: 'info',
    attributes: { source: template.source, templateId: template.templateId },
  }).catch(() => {})

  const resp = await callTemplateTransform({
    url: `${baseUrl}/transformer/template`,
    text: `Kennzahlen:\n${args.statsText}\n\nErgebnis-Tabelle:\n\n${args.resultTable}`,
    targetLanguage: 'de',
    templateContent: template.templateContent,
    context: args.contextJson,
    useCache: false,
    apiKey,
    timeoutMs: Number(process.env.EXTERNAL_TEMPLATE_TIMEOUT_MS || process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 600000),
    model: args.model,
  })
  const data = (await resp.json()) as { data?: { structured_data?: unknown } }
  const structured = data?.data?.structured_data
  if (!structured || typeof structured !== 'object') {
    throw new Error('phase-overlap-report: Template-Transform lieferte kein structured_data')
  }
  const s = structured as Record<string, unknown>
  const missing = OVERLAP_REPORT_FIELDS.filter((k) => !(typeof s[k] === 'string' && (s[k] as string).trim().length > 0))
  if (missing.length > 0) {
    throw new Error(`phase-overlap-report: Bericht-Vorlage lieferte leere Felder: ${missing.join(', ')}`)
  }
  return {
    title: (s.title as string).trim(),
    themenfelder: (s.themenfelder as string).trim(),
    groessenordnungen: (s.groessenordnungen as string).trim(),
    handlungsempfehlungen: (s.handlungsempfehlungen as string).trim(),
  }
}

/** Anzeige-Label einer ref (Massnahmen-Nr falls vorhanden, sonst ref). */
function refLabel(selected: OverlapCatalogEntry[], ref: string): string {
  const entry = selected.find((e) => e.ref === ref)
  return entry?.massnahmeNr || (entry ? `#${entry.ref}` : ref)
}

/** Aehnlichkeits-Paare der ausgewaehlten Massnahmen als Prompt-Hinweise. */
async function buildSimilarityHints(
  library: Library,
  fileIdByRef: Map<string, string>,
): Promise<string | undefined> {
  const refByFileId = new Map<string, string>()
  for (const [ref, fileId] of fileIdByRef) if (fileId) refByFileId.set(fileId, ref)
  const fileIds = [...refByFileId.keys()]
  if (fileIds.length === 0) return undefined
  const pairWeight = new Map<string, number>()
  for (let offset = 0; offset < fileIds.length; offset += MAX_NODES) {
    const chunk = fileIds.slice(offset, offset + MAX_NODES)
    const payload = await buildNeighborsPayload(library, chunk, HINTS_TOP_K, fileIds)
    for (const edge of payload.edges) {
      const a = refByFileId.get(edge.source)
      const b = refByFileId.get(edge.target)
      if (!a || !b || a === b) continue
      const key = Number(a) < Number(b) ? `${a}|${b}` : `${b}|${a}`
      const prev = pairWeight.get(key)
      if (prev === undefined || edge.weight > prev) pairWeight.set(key, edge.weight)
    }
  }
  if (pairWeight.size === 0) return undefined
  return [...pairWeight.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 200)
    .map(([key, w]) => {
      const [a, b] = key.split('|')
      return `- ref ${a} <-> ref ${b} (Score ${w.toFixed(2)})`
    })
    .join('\n')
}
