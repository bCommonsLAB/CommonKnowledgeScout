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
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { parseMongoShadowTwinId, isMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { getJobEventBus } from '@/lib/events/job-event-bus'
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

  if (sourceItemId && sourceName && sourceParentId && job) {
    const provider = await buildProvider({ userEmail: job.userEmail, libraryId: job.libraryId, jobId: ctx.jobId, repo })
    const expectedKind = templateEnabled ? 'transformation' : 'transcript'
    const sourceBaseName = path.parse(sourceName).name

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async function _isExpectedSavedItem(fileId: string): Promise<boolean> {
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
      // MongoDB-Shadow-Twin-IDs direkt akzeptieren (ohne Provider-Validierung)
      if (isMongoShadowTwinId(savedItemId)) {
        // MongoDB-ID direkt akzeptieren - Validierung erfolgt über ID-Struktur
        // Die ID enthält bereits kind, targetLanguage und templateName
        const parsed = parseMongoShadowTwinId(savedItemId)
        if (parsed) {
          const isExpectedKind = parsed.kind === expectedKind
          const isExpectedTemplate = expectedKind === 'transformation'
            ? (!templateName || !parsed.templateName || parsed.templateName.toLowerCase() === templateName.toLowerCase())
            : true
          
          if (!isExpectedKind || !isExpectedTemplate) {
            // MongoDB-ID passt nicht zum erwarteten Typ → deterministisch neu auflösen
            savedItemId = undefined
          }
          // Wenn Validierung erfolgreich, savedItemId beibehalten
        } else {
          // Ungültige MongoDB-ID-Struktur → deterministisch neu auflösen
          savedItemId = undefined
        }
      } else {
        // Filesystem-basierte ID: Validierung über Provider
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
    }

    // 2) Zentrale Shadow-Twin-Service-Auflösung (ersetzt Provider-Resolver + Mongo-Fallback)
    if (!savedItemId) {
      try {
        const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
        if (library) {
          const service = new ShadowTwinService({
            library,
            userEmail: job.userEmail,
            sourceId: sourceItemId,
            sourceName,
            parentId: sourceParentId,
            provider,
          })

          const resolvedId = await service.resolveSavedItemIdForContract({
            expectedKind,
            targetLanguage: lang,
            templateName,
          })

          if (resolvedId) {
            savedItemId = resolvedId
          }
        }
      } catch {
        // best effort – Contract wird ggf. unten enforced
      }
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
  
  // SSE-Event fuer Job-Abschluss senden (fuer UI-Aktualisierung)
  try {
    getJobEventBus().emitUpdate(job?.userEmail || ctx.job?.userEmail || '', {
      type: 'job_update',
      jobId: ctx.jobId,
      status: 'completed',
      progress: 100,
      updatedAt: new Date().toISOString(),
      message: 'completed',
      jobType: job?.job_type || ctx.job?.job_type,
      fileName: job?.correlation?.source?.name || ctx.job?.correlation?.source?.name,
      sourceItemId: sourceItemId || ctx.job?.correlation?.source?.itemId,
      result: { savedItemId },
    })
  } catch {
    // SSE-Fehler nicht kritisch - Job ist bereits abgeschlossen
  }
  
  return { status: 'ok', jobId: ctx.jobId }
}


