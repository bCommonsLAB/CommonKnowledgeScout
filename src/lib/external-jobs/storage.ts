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
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { loadTemplateFromMongoDB } from '@/lib/templates/template-service-mongodb'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

export async function saveMarkdown(args: SaveMarkdownArgs): Promise<SaveMarkdownResult> {
  const { ctx, parentId, fileName, markdown, artifactKey: explicitArtifactKey } = args
  const repo = new ExternalJobsRepository()
  const provider = await getServerProvider(ctx.job.userEmail, ctx.job.libraryId)

  // DETERMINISTISCHE ARCHITEKTUR: Verwende einfach parentId, das bereits korrekt gesetzt wurde
  // Der Kontext wurde beim Job-Start bestimmt und im Job-State gespeichert
  // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
  const targetParentId = parentId
  const shadowTwinFolderId: string | undefined = ctx.job.shadowTwinState?.shadowTwinFolderId
  
  // WICHTIG: Wenn parentId bereits das Shadow-Twin-Verzeichnis ist, sollte kein neues Verzeichnis erstellt werden
  // Wenn shadowTwinFolderId vorhanden ist, existiert das Verzeichnis bereits
  const isParentShadowTwinFolder = shadowTwinFolderId && parentId === shadowTwinFolderId
  
  bufferLog(ctx.jobId, {
    phase: 'markdown_save',
    message: `Speichere Markdown${isParentShadowTwinFolder ? ' im Shadow-Twin-Verzeichnis' : ''}`,
    parentId: targetParentId,
    shadowTwinFolderId: shadowTwinFolderId || null,
    isParentShadowTwinFolder
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

  // WICHTIG: Verwende expliziten ArtifactKey, falls übergeben (verhindert fehleranfälliges Parsing)
  // Falls nicht übergeben, parse aus fileName (Legacy-Fallback für Rückwärtskompatibilität)
  const sourceItemId = ctx.job.correlation?.source?.itemId || 'unknown'
  const sourceName = ctx.job.correlation?.source?.name || fileName
  
  let artifactKey: ArtifactKey
  if (explicitArtifactKey) {
    // Expliziter ArtifactKey wurde übergeben - verwende diesen direkt (bevorzugt)
    artifactKey = explicitArtifactKey
  } else {
    // Fallback: Parse fileName um ArtifactKey zu erstellen (Legacy-Verhalten)
    // Nutze jetzt zentrale parseArtifactName() Funktion statt manueller split-Logik
    try {
      const parsed = parseArtifactName(fileName, sourceName)
      
      if (parsed.kind && parsed.targetLanguage) {
        // Erfolgreich geparst: Verwende geparste Werte
        artifactKey = {
          sourceId: sourceItemId,
          kind: parsed.kind,
          targetLanguage: parsed.targetLanguage,
          templateName: parsed.templateName || undefined,
        }
      } else {
        // Parsing nicht erfolgreich: Fallback zu Default
        artifactKey = {
          sourceId: sourceItemId,
          kind: 'transcript',
          targetLanguage: 'de', // Default
        }
      }
    } catch (error) {
      // Fehler beim Parsing: Fallback zu Default
      bufferLog(ctx.jobId, {
        phase: 'markdown_save_parse_error',
        message: `Fehler beim Parsen des Dateinamens, verwende Default`,
        fileName,
        error: error instanceof Error ? error.message : String(error)
      })
      artifactKey = {
        sourceId: sourceItemId,
        kind: 'transcript',
        targetLanguage: 'de', // Default
      }
    }
  }

  // WICHTIG: Wenn parentId bereits das Shadow-Twin-Verzeichnis ist (isParentShadowTwinFolder),
  // oder wenn shadowTwinFolderId vorhanden ist (Verzeichnis existiert bereits),
  // dann sollte createFolder auf false gesetzt werden, um keine verschachtelten Ordner zu erstellen.
  // Wenn shadowTwinFolderId nicht vorhanden ist, prüfe ob ein Verzeichnis erstellt werden soll.
  const createFolderValue = (ctx.job.shadowTwinState as { createFolder?: boolean | string } | undefined)?.createFolder;
  const createFolder = !isParentShadowTwinFolder && !shadowTwinFolderId && (createFolderValue === true || createFolderValue === 'true')

  // 5. Füge detailViewType aus Template ins Frontmatter ein (falls Template vorhanden)
  let finalMarkdown = markdown
  if (artifactKey.templateName && artifactKey.kind === 'transformation') {
    try {
      // Lade Template aus MongoDB
      const template = await loadTemplateFromMongoDB(
        artifactKey.templateName,
        ctx.job.libraryId,
        ctx.job.userEmail,
        false
      )
      
      if (template?.metadata?.detailViewType) {
        // Parse Frontmatter
        const parsed = parseFrontmatter(markdown)
        const meta = parsed.meta || {}
        
        // Füge detailViewType hinzu (nur wenn noch nicht vorhanden)
        if (!meta.detailViewType) {
          meta.detailViewType = template.metadata.detailViewType as string | undefined
          
          // Serialisiere Frontmatter neu
          const frontmatterLines: string[] = []
          for (const [key, value] of Object.entries(meta)) {
            if (value === undefined) continue
            if (typeof value === 'string') {
              frontmatterLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
            } else if (typeof value === 'number' || typeof value === 'boolean') {
              frontmatterLines.push(`${key}: ${value}`)
            } else {
              frontmatterLines.push(`${key}: ${JSON.stringify(value)}`)
            }
          }
          
          const newFrontmatter = `---\n${frontmatterLines.join('\n')}\n---`
          finalMarkdown = `${newFrontmatter}\n\n${parsed.body}`
          
          bufferLog(ctx.jobId, {
            phase: 'markdown_save_detailviewtype',
            message: `detailViewType "${template.metadata.detailViewType}" aus Template ins Frontmatter eingefügt`,
            templateName: artifactKey.templateName,
            detailViewType: template.metadata.detailViewType,
          })
        }
      }
    } catch (error) {
      // Fehler beim Laden des Templates nicht kritisch - verwende Original-Markdown
      bufferLog(ctx.jobId, {
        phase: 'markdown_save_detailviewtype_error',
        message: `Fehler beim Laden des Templates für detailViewType`,
        templateName: artifactKey.templateName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Nutze zentrale writeArtifact() Logik
  const writeResult = await writeArtifact(provider, {
    key: artifactKey,
    sourceName,
    parentId: targetParentId,
    content: finalMarkdown,
    createFolder,
  })

  const saved = writeResult.file
  
  try {
    await repo.traceAddEvent(ctx.jobId, {
      spanId: 'postprocessing',
      name: 'postprocessing_save',
      attributes: {
        name: saved.metadata.name,
        parentId: targetParentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
        artifactKind: artifactKey.kind,
        targetLanguage: artifactKey.targetLanguage,
        templateName: artifactKey.templateName || null,
      },
    })
  } catch {}
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


