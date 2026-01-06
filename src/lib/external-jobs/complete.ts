/**
 * @fileoverview External Jobs Complete - Job Completion Handler
 * 
 * @description
 * Handles job completion by updating job status, storing final results, updating
 * step status, and draining buffered logs. Marks job as completed in repository
 * and returns completion result.
 * 
 * @module external-jobs
 * 
 * @exports
 * - setJobCompleted: Marks job as completed with results
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback completes job
 * - src/app/api/external/jobs/[jobId]/start/route.ts: Job start may complete job
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for status updates
 * - @/lib/external-jobs-log-buffer: Log buffer draining
 * - @/types/external-jobs: Completion types
 */

import type { CompleteArgs, JobResult } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { drainBufferedLogs } from '@/lib/external-jobs-log-buffer'
import { clearWatchdog } from '@/lib/external-jobs-watchdog'
import { buildProvider } from '@/lib/external-jobs/provider'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import path from 'path'

export async function setJobCompleted(args: CompleteArgs): Promise<JobResult> {
  const { ctx, result } = args
  const repo = new ExternalJobsRepository()
  const mergedResult = (() => {
    // WICHTIG: MongoDB entfernt `undefined` Felder. Wenn savedItemId undefined ist,
    // endet `result` als `{}` und der Client verliert die wichtigste Referenz.
    const base = (ctx.job && typeof ctx.job === 'object' ? (ctx.job as { result?: unknown }).result : undefined) as Record<string, unknown> | undefined
    const out: Record<string, unknown> = { ...(base || {}), ...(result as Record<string, unknown>) }
    return out
  })()

  const job = await repo.get(ctx.jobId)
  const phases = job && job.parameters && typeof job.parameters === 'object'
    ? (job.parameters as { phases?: { template?: boolean; ingest?: boolean } }).phases
    : undefined
  const policies = job && job.parameters && typeof job.parameters === 'object'
    ? (job.parameters as { policies?: { metadata?: string; ingest?: string } }).policies
    : undefined

  // Template-Step nur dann explizit abschließen, wenn die Template-Phase
  // in den Job-Parametern nicht deaktiviert wurde. Andernfalls würde eine
  // vorher gesetzte Skip-Begründung (z.B. reason: 'phase_disabled') wieder
  // überschrieben werden.
  const templateEnabled = phases ? phases.template !== false : true
  if (templateEnabled) {
    await repo.updateStep(ctx.jobId, 'transform_template', { status: 'completed', endedAt: new Date() })
  }

  // Ingest-Step als skipped markieren, wenn die Ingest-Phase deaktiviert ist
  // oder wenn die Policy auf 'ignore' gesetzt ist
  const ingestEnabled = phases ? phases.ingest !== false : true
  const ingestPolicy = policies?.ingest
  const shouldSkipIngest = !ingestEnabled || ingestPolicy === 'ignore'

  if (shouldSkipIngest) {
    // Prüfe, ob der Step bereits existiert und noch pending ist
    const existingStep = job?.steps?.find(s => s.name === 'ingest_rag')
    if (existingStep && existingStep.status === 'pending') {
      await repo.updateStep(ctx.jobId, 'ingest_rag', {
        status: 'completed',
        endedAt: new Date(),
        details: {
          skipped: true,
          reason: !ingestEnabled ? 'phase_disabled' : 'policy_skip'
        }
      })
    }
  }

  // --- Zentraler Contract (Variante A) ---
  // completed ⇒ result.savedItemId existiert UND ist vom erwarteten Artefakt-Typ.
  // - Template-Jobs ⇒ Transformation
  // - Extract-only ⇒ Transcript
  const sourceItemId = job?.correlation?.source?.itemId || ''
  const sourceName = job?.correlation?.source?.name || ''
  const sourceParentId = job?.correlation?.source?.parentId || ''
  const targetLanguage = (job?.correlation as { options?: { targetLanguage?: unknown } } | undefined)?.options?.targetLanguage
  const lang = typeof targetLanguage === 'string' && targetLanguage.trim().length > 0 ? targetLanguage.trim() : 'de'
  const templateNameRaw = (job?.parameters as { template?: unknown } | undefined)?.template
  const templateName = typeof templateNameRaw === 'string' && templateNameRaw.trim().length > 0 ? templateNameRaw.trim() : undefined

  const transformedIdRaw = (job as unknown as { shadowTwinState?: { transformed?: { id?: unknown } } })?.shadowTwinState?.transformed?.id
  const transformedId = typeof transformedIdRaw === 'string' && transformedIdRaw.trim().length > 0 ? transformedIdRaw.trim() : undefined

  const existingSavedItemIdRaw = mergedResult.savedItemId
  let savedItemId = typeof existingSavedItemIdRaw === 'string' && existingSavedItemIdRaw.trim().length > 0
    ? existingSavedItemIdRaw.trim()
    : undefined

  // Falls Template-Phase übersprungen wurde, existiert oft bereits die Transformation im Shadow-Twin.
  if (!savedItemId && transformedId) savedItemId = transformedId

  if (sourceItemId && sourceName && sourceParentId) {
    const provider = await buildProvider({ userEmail: job.userEmail, libraryId: job.libraryId, jobId: ctx.jobId, repo })
    const expectedKind = templateEnabled ? 'transformation' : 'transcript'
    const sourceBaseName = path.parse(sourceName).name

    async function isExpectedSavedItem(fileId: string): Promise<boolean> {
      try {
        const it = await provider.getItemById(fileId)
        const candidateName = String(it?.metadata?.name || '')
        const parsed = parseArtifactName(candidateName, sourceBaseName)
        if (parsed.kind !== expectedKind) return false
        if (expectedKind === 'transformation' && templateName) {
          const parsedTemplate = typeof parsed.templateName === 'string' ? parsed.templateName : ''
          if (!parsedTemplate) return false
          return parsedTemplate.toLowerCase() === templateName.toLowerCase()
        }
        return true
      } catch {
        return false
      }
    }

    // 1) Wenn savedItemId existiert: validieren, ob es zum erwarteten Artefakt-Typ passt.
    if (savedItemId) {
      try {
        const it = await provider.getItemById(savedItemId)
        const candidateName = String(it?.metadata?.name || '')
        const parsed = parseArtifactName(candidateName, sourceBaseName)

        const isExpectedKind = parsed.kind === expectedKind
        const isExpectedTemplate = expectedKind === 'transformation'
          ? (!templateName || (parsed.templateName && parsed.templateName.toLowerCase() === templateName.toLowerCase()))
          : true

        if (!isExpectedKind || !isExpectedTemplate) {
          // Zentral: Nicht akzeptieren → deterministisch neu auflösen.
          savedItemId = undefined
        }
      } catch {
        // Kann nicht validiert werden → deterministisch neu auflösen.
        savedItemId = undefined
      }
    }

    // 2) Deterministischer Resolver (v2-only)
    if (!savedItemId) {
      const preferredKind = expectedKind
      const resolved = await resolveArtifact(provider, {
        sourceItemId,
        sourceName,
        parentId: sourceParentId,
        targetLanguage: lang,
        templateName,
        preferredKind,
      })
      if (resolved?.fileId && (await isExpectedSavedItem(resolved.fileId))) savedItemId = resolved.fileId
    }

    // 3) Enforce: Template-Job darf nicht completed werden, wenn keine Transformation referenzierbar ist.
    if (templateEnabled && (!savedItemId || savedItemId.trim().length === 0)) {
      throw new Error(
        'Global Contract verletzt: Template-Job ist completed, aber result.savedItemId (Transformation) fehlt oder ist ungültig.'
      )
    }
  }

  if (!savedItemId) {
    throw new Error('Global Contract verletzt: Job ist completed, aber result.savedItemId fehlt oder ist ungültig.')
  }

  mergedResult.savedItemId = savedItemId

  await repo.setResult(ctx.jobId, ctx.job.payload || {}, mergedResult as unknown as typeof ctx.job.result)
  await repo.setStatus(ctx.jobId, 'completed')
  // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
  void drainBufferedLogs(ctx.jobId)
  // WICHTIG: Watchdog stoppen, damit der Job nicht nach Timeout fälschlicherweise als "failed" markiert wird
  try {
    clearWatchdog(ctx.jobId)
  } catch (error) {
    // Watchdog-Fehler nicht kritisch - Job ist bereits abgeschlossen
    console.warn('[setJobCompleted] Fehler beim Stoppen des Watchdogs', {
      jobId: ctx.jobId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return { status: 'ok', jobId: ctx.jobId }
}


