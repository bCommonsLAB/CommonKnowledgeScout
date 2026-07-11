/**
 * @fileoverview Gemeinsamer LLM-Pass der Bericht-Phasen (Wirkungs- +
 * Enabler-Bericht): Vorlage aufloesen, Secretary /transformer/template
 * aufrufen, LLM-Felder validieren.
 *
 * @description
 * Die Vorlage bestimmt Schema (Frontmatter) und Prompt (Systemprompt); der
 * Aufrufer liefert Quelltext (deterministisch gerechnete Tabellen/Kennzahlen)
 * und strukturierten Kontext (JSON). Zurueck kommen die LLM-Felder plus der
 * Markdown-Body der Vorlage — den fuellt der Aufrufer anschliessend mit
 * renderTemplateBody (LLM-Felder + Code-Variablen) zum fertigen Bericht.
 *
 * Validierung (no-silent-fallbacks): `title` muss vorhanden sein und
 * mindestens ein weiteres Feld — sonst Fehler. Einzelne leere Felder werden
 * im Job-Trace ausgewiesen (Luecke bleibt im Bericht sichtbar).
 */

import { callTemplateTransform } from '@/lib/secretary/adapter'
import { getSecretaryConfig } from '@/lib/env'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { resolveReportTemplate } from './report-template-resolver'
import type { ReportTemplateKind } from '@/lib/templates/report-templates'
import type { ExternalJob } from '@/types/external-job'

export interface ReportTransformArgs {
  kind: ReportTemplateKind
  job: ExternalJob
  repo: ExternalJobsRepository
  /** Trace-Span (z.B. 'phase-overlap-report'). */
  spanId: string
  /** LLM-Modell (Parameter des Laufs, z.B. ein 1M-Kontext-Modell). */
  model: string
  /** Quelltext: deterministisch gerechnete Kennzahlen/Tabellen. */
  sourceText: string
  /** Rohdaten als strukturiertes JSON (context-Parameter des Secretary). */
  contextJson: Record<string, unknown>
  /** Explizite Vorlage; sonst Library-Override / Builtin (Resolver). */
  reportTemplateId?: string
}

export interface ReportTransformResult {
  /** LLM-Felder der Vorlage (getrimmt; fehlende Felder = ''). */
  llmFields: Record<string, string>
  /** Markdown-Body der Vorlage (Layout mit {{variablen}}). */
  markdownBody: string
}

export async function runReportTransform(args: ReportTransformArgs): Promise<ReportTransformResult> {
  const { baseUrl, apiKey } = getSecretaryConfig()
  if (!baseUrl) throw new Error(`${args.spanId}: SECRETARY_SERVICE_URL nicht konfiguriert`)

  const template = await resolveReportTemplate(
    args.kind, args.job.libraryId, args.job.userEmail, args.reportTemplateId,
  )
  await args.repo.traceAddEvent(args.job.jobId, {
    spanId: args.spanId, name: 'report_template_resolved', level: 'info',
    attributes: { kind: args.kind, source: template.source, templateId: template.templateId },
  }).catch(() => {})

  const resp = await callTemplateTransform({
    url: `${baseUrl}/transformer/template`,
    text: args.sourceText,
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
    throw new Error(`${args.spanId}: Template-Transform lieferte kein structured_data`)
  }
  const s = structured as Record<string, unknown>

  const llmFields: Record<string, string> = {}
  const emptyKeys: string[] = []
  for (const key of template.fieldKeys) {
    const value = typeof s[key] === 'string' ? (s[key] as string).trim() : ''
    llmFields[key] = value
    if (!value) emptyKeys.push(key)
  }
  if (!llmFields.title || emptyKeys.length >= template.fieldKeys.length - 1) {
    throw new Error(
      `${args.spanId}: Bericht-Vorlage lieferte keine verwertbaren Felder ` +
      `(leer: ${emptyKeys.join(', ') || 'keine'}) — Vorlage/Systemprompt pruefen.`,
    )
  }
  if (emptyKeys.length > 0) {
    await args.repo.traceAddEvent(args.job.jobId, {
      spanId: args.spanId, name: 'report_fields_empty', level: 'warn',
      message: `Leere LLM-Felder: ${emptyKeys.join(', ')} — Luecke bleibt im Bericht sichtbar`,
    }).catch(() => {})
  }
  return { llmFields, markdownBody: template.markdownBody }
}
