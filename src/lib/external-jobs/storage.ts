/**
 * @fileoverview External Jobs Storage - Markdown File Storage
 * 
 * @description
 * Saves transformed markdown files (shadow twins) to storage. Uploads markdown content
 * as files to the specified parent folder, logs the operation, and emits job update events.
 * Returns the saved item ID for further processing.
 * 
 * @module external-jobs
 * 
 * @exports
 * - saveMarkdown: Saves markdown file to storage
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback saves markdown
 * 
 * @dependencies
 * - @/lib/storage/server-provider: Storage provider creation
 * - @/lib/external-jobs-repository: Job repository for logging
 * - @/lib/events/job-event-bus: Event bus for status updates
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/types/external-jobs: Storage types
 */

import type { SaveMarkdownArgs, SaveMarkdownResult } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getJobEventBus } from '@/lib/events/job-event-bus'

export async function saveMarkdown(args: SaveMarkdownArgs): Promise<SaveMarkdownResult> {
  const { ctx, parentId, fileName, markdown } = args
  const repo = new ExternalJobsRepository()
  const provider = await getServerProvider(ctx.job.userEmail, ctx.job.libraryId)

  // DETERMINISTISCHE ARCHITEKTUR: Verwende einfach parentId, das bereits korrekt gesetzt wurde
  // Der Kontext wurde beim Job-Start bestimmt und im Job-State gespeichert
  // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
  const targetParentId = parentId
  const shadowTwinFolderId: string | undefined = ctx.job.shadowTwinState?.shadowTwinFolderId
  
  bufferLog(ctx.jobId, {
    phase: 'markdown_save',
    message: `Speichere Markdown${shadowTwinFolderId && parentId === shadowTwinFolderId ? ' im Shadow-Twin-Verzeichnis' : ''}`,
    parentId: targetParentId,
    shadowTwinFolderId: shadowTwinFolderId || null
  })

  // Starte Postprocessing-Span für Markdown-Speicherung
  // Dieser Span ist unabhängig von Template-Phase und wird auch im Extract-Only-Modus verwendet
  try {
    await repo.traceStartSpan(ctx.jobId, {
      spanId: 'postprocessing',
      parentSpanId: 'job',
      name: 'postprocessing',
    })
  } catch {
    // Span könnte bereits existieren (nicht kritisch)
  }

  const file = new File([new Blob([markdown], { type: 'text/markdown' })], fileName, { type: 'text/markdown' })
  try {
    await repo.traceAddEvent(ctx.jobId, {
      spanId: 'postprocessing',
      name: 'postprocessing_save',
      attributes: {
        name: fileName,
        parentId: targetParentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
      },
    })
  } catch {}
  const saved = await provider.uploadFile(targetParentId, file)
  try {
    await repo.traceAddEvent(ctx.jobId, {
      spanId: 'postprocessing',
      name: 'stored_local',
      attributes: {
        savedItemId: saved.id,
        name: saved.metadata?.name,
        parentId: targetParentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
      },
    })
  } catch {}
  bufferLog(ctx.jobId, {
    phase: 'stored_local',
    message: `Shadow‑Twin gespeichert${shadowTwinFolderId ? ' im Shadow-Twin-Verzeichnis' : ''}`,
  })

  try {
    const p = await provider.getPathById(targetParentId)
    const uniqueName = (saved.metadata?.name as string | undefined) || fileName

    // WICHTIG: `appendLog()` mappt "stored_path" historisch auf den `template`-Span.
    // Da wir hier explizit im Postprocessing speichern (auch im Extract-Only-Modus),
    // schreiben wir das Event direkt in den `postprocessing`-Span.
    try {
      await repo.traceAddEvent(ctx.jobId, {
        spanId: 'postprocessing',
        name: 'stored_path',
        message: `${p}/${uniqueName}`,
        attributes: {
          path: `${p}/${uniqueName}`,
          parentId: targetParentId,
          shadowTwinFolderId: shadowTwinFolderId || null,
        },
      })
    } catch {}
    // WICHTIG: Refresh sowohl Parent als auch Shadow-Twin-Verzeichnis (falls vorhanden)
    // Dies stellt sicher, dass beide Ordner aktualisiert werden und die Shadow-Twin-Analyse neu läuft
    const refreshFolderIds = shadowTwinFolderId && shadowTwinFolderId !== parentId
      ? [parentId, shadowTwinFolderId]
      : [parentId]
    
    getJobEventBus().emitUpdate(ctx.job.userEmail, {
      type: 'job_update',
      jobId: ctx.jobId,
      status: 'running',
      progress: 98,
      updatedAt: new Date().toISOString(),
      message: 'stored_local',
      jobType: ctx.job.job_type,
      fileName: uniqueName,
      sourceItemId: ctx.job.correlation?.source?.itemId,
      refreshFolderId: parentId, // Primary refresh folder (für Rückwärtskompatibilität)
      refreshFolderIds, // Array mit allen zu refreshenden Ordnern (Parent + Shadow-Twin)
      shadowTwinFolderId: shadowTwinFolderId || null, // Shadow-Twin-Verzeichnis-ID für Client-Analyse
    } as unknown as import('@/lib/events/job-event-bus').JobUpdateEvent)
    
    // Beende Postprocessing-Span nach erfolgreichem Speichern
    try {
      await repo.traceEndSpan(ctx.jobId, 'postprocessing', 'completed', {})
    } catch {
      // Span-Fehler nicht kritisch
    }
  } catch {
    // Bei Fehlern: Postprocessing-Span als failed markieren
    try {
      await repo.traceEndSpan(ctx.jobId, 'postprocessing', 'failed', {})
    } catch {
      // Span-Fehler nicht kritisch
    }
  }
  return { savedItemId: saved.id }
}


