/**
 * @fileoverview External Jobs Template Decision - Template Execution Decision Logic
 * 
 * @description
 * Decides whether to run template transformation based on policies, existing artifacts,
 * and repair needs. Checks for existing shadow twins, evaluates gate conditions, and
 * determines if template execution is necessary. Handles repair scenarios for incomplete
 * existing documents.
 * 
 * @module external-jobs
 * 
 * @exports
 * - decideTemplateRun: Main function to decide template execution
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback uses template decision
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for logging
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/lib/processing/gates: Gate checking utilities
 * - @/lib/storage/server-provider: Storage provider for artifact checking
 * - @/types/external-jobs: Template decision types
 */

import type { TemplateDecisionArgs, TemplateDecisionResult } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { gateTransformTemplate } from '@/lib/processing/gates'

export async function decideTemplateRun(args: TemplateDecisionArgs): Promise<TemplateDecisionResult> {
  const { ctx, policies, isFrontmatterCompleteFromBody, autoSkip, isTemplateCompletedCallback } = args
  const repo = new ExternalJobsRepository()
  const jobId = ctx.jobId

  // Repair-Probe: vorhandener Shadow‑Twin unvollständig?
  let needsRepair = false
  try {
    const provider = await (await import('@/lib/storage/server-provider')).getServerProvider(ctx.job.userEmail, ctx.job.libraryId)
    const parentId = ctx.job.correlation?.source?.parentId || 'root'
    void (await provider.getPathById(parentId))
    const rawName = ctx.job.correlation?.source?.name || 'document.pdf'
    const lang = (ctx.job.correlation.options?.targetLanguage as string | undefined) || 'de'
    const sourceItemId = ctx.job.correlation?.source?.itemId || 'unknown'
    const uniqueName = buildArtifactName({ sourceId: sourceItemId, kind: 'transcript', targetLanguage: lang }, rawName)
    const siblings = await provider.listItemsById(parentId)
    const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string } | undefined
    if (existing) {
      const bin = await provider.getBinary(existing.id)
      const text = await bin.blob.text()
      const { parseSecretaryMarkdownStrict } = await import('@/lib/secretary/response-parser')
      const parsed = parseSecretaryMarkdownStrict(text)
      const em = parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta as Record<string, unknown> : {}
      const existingChapters = Array.isArray((em as { chapters?: unknown }).chapters) ? ((em as { chapters: unknown[] }).chapters as unknown[]).length : 0
      const existingPagesRaw = (em as { pages?: unknown }).pages as unknown
      const existingPages = typeof existingPagesRaw === 'number' ? existingPagesRaw : (typeof existingPagesRaw === 'string' ? Number(existingPagesRaw) : NaN)
      const existingHasPages = Number.isFinite(existingPages) && (existingPages as number) > 0
      needsRepair = !(existingHasPages && existingChapters > 0)
    }
  } catch { /* ignore */ }

  // Gate-Plan (nur wenn kein Template-Completed-Callback)
  let gateExists = !!args.templateGateExists
  let gateReason: string | undefined = args.templateGateExists ? 'frontmatter_complete_body' : undefined
  if (!isTemplateCompletedCallback && autoSkip) {
    try {
      const g = await gateTransformTemplate({
        repo,
        jobId,
        userEmail: ctx.job.userEmail,
        library: undefined,
        source: ctx.job.correlation?.source,
        options: ctx.job.correlation?.options as { targetLanguage?: string } | undefined,
      })
      if (g?.exists) {
        gateExists = true
        gateReason = gateReason || g.reason || 'artifact_exists'
        bufferLog(jobId, { phase: 'transform_gate_skip', message: gateReason })
      } else if (!gateExists) {
        bufferLog(jobId, { phase: 'transform_gate_plan', message: 'Template-Transformation wird ausgeführt' })
      }
    } catch { /* best effort */ }
  }

  // Override: Bei Reparaturfall Analyse erzwingen, selbst wenn Gate existiert
  if (isTemplateCompletedCallback && needsRepair) gateExists = false

  // Entscheidung inkl. Begründung
  const { shouldRun, reason } = (() => {
    // Callback-Sonderfall: Template wurde extern bereits ausgeführt.
    // Regel: Wenn Frontmatter im Callback vorhanden/komplett ist → niemals erneut laufen.
    // Nur wenn KEIN Frontmatter geliefert wurde und eine Reparatur wirklich nötig erscheint, erneut laufen.
    if (isTemplateCompletedCallback) {
      if (isFrontmatterCompleteFromBody) return { shouldRun: false, reason: 'template_completed_fm_ok' }
      return needsRepair
        ? { shouldRun: true, reason: 'template_completed_repair' }
        : { shouldRun: false, reason: 'template_completed_no_repair' }
    }
    if (policies.metadata === 'force') return { shouldRun: true, reason: 'policy_force' }
    if (policies.metadata === 'skip') return { shouldRun: false, reason: 'policy_skip' }
    if (policies.metadata === 'ignore') return { shouldRun: false, reason: 'policy_ignore' }
    if (policies.metadata === 'auto') {
      if (isFrontmatterCompleteFromBody) return { shouldRun: false, reason: 'frontmatter_complete_body' }
      if (gateExists) return { shouldRun: false, reason: gateReason || 'artifact_gate_exists' }
      return { shouldRun: true, reason: 'auto_no_gate' }
    }
    return { shouldRun: true, reason: 'policy_default' }
  })()

  try {
    await repo.appendLog(jobId, { phase: 'template_decision', message: shouldRun ? 'run' : 'skip', details: { policy: policies.metadata, bodyPhase: ctx.body?.phase || null, isFrontmatterCompleteFromBody, gateExists, gateReason, needsRepair, reason } } as unknown as Record<string, unknown>)
    await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_decision', attributes: { decision: shouldRun ? 'run' : 'skip', policy: policies.metadata, gate: gateExists, gateReason, bodyPhase: ctx.body?.phase || null, fmComplete: isFrontmatterCompleteFromBody, needsRepair, reason } })
  } catch {}

  return { shouldRun, gateExists, isCallback: isTemplateCompletedCallback, needsRepair, reason }
}


