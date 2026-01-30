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
import type { StorageItem } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { loadTemplateFromMongoDB } from '@/lib/templates/template-service-mongodb'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { persistShadowTwinToMongo } from '@/lib/shadow-twin/shadow-twin-mongo-writer'
import { buildMongoShadowTwinItem } from '@/lib/shadow-twin/mongo-shadow-twin-item'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'

export async function saveMarkdown(args: SaveMarkdownArgs): Promise<SaveMarkdownResult> {
  const { ctx, parentId, fileName, markdown, artifactKey: explicitArtifactKey, zipArchives, jobId } = args
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

  // Shadow-Twin-Konfiguration laden (Mongo oder Filesystem).
  const library = await LibraryService.getInstance().getLibrary(ctx.job.userEmail, ctx.job.libraryId)
  const shadowTwinConfig = getShadowTwinConfig(library)
  const persistToFilesystem = shadowTwinConfig.persistToFilesystem ?? true

  let mongoMarkdown = finalMarkdown
  let virtualItem: StorageItem | null = null
  
  // Verwende ShadowTwinService für zentrale Store-Entscheidung
  if (ctx.job.correlation?.source?.itemId) {
    try {
      const sourceItem = await provider.getItemById(ctx.job.correlation.source.itemId)
      
      // Prüfe über Service, ob Mongo verwendet wird
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _service = new ShadowTwinService({
        library,
        userEmail: ctx.job.userEmail,
        sourceId: sourceItem.id,
        sourceName: sourceItem.metadata.name,
        parentId: sourceItem.parentId,
        provider,
      })
      
      // persistShadowTwinToMongo verwendet intern bereits den Service
      const mongoResult = await persistShadowTwinToMongo({
        libraryId: ctx.job.libraryId,
        userEmail: ctx.job.userEmail,
        sourceItem,
        provider,
        artifactKey,
        markdown: finalMarkdown,
        shadowTwinFolderId: shadowTwinFolderId || undefined,
        zipArchives: zipArchives && zipArchives.length > 0 ? zipArchives : undefined,
        jobId: jobId || ctx.jobId,
      })
      mongoMarkdown = mongoResult.markdown
      
      // Erstelle virtuelles Item für Mongo (wenn primaryStore === 'mongo')
      if (shadowTwinConfig.primaryStore === 'mongo') {
        virtualItem = buildMongoShadowTwinItem({
          libraryId: ctx.job.libraryId,
          sourceId: sourceItem.id,
          sourceName: sourceItem.metadata.name,
          parentId: sourceItem.parentId,
          kind: artifactKey.kind,
          targetLanguage: artifactKey.targetLanguage,
          templateName: artifactKey.templateName,
          markdownLength: mongoMarkdown.length,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      bufferLog(ctx.jobId, {
        phase: 'markdown_save_mongo_error',
        message: `Mongo-Upsert fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      })
      if (!persistToFilesystem) {
        throw error
      }
    }
  }

  let writeResult: Awaited<ReturnType<typeof writeArtifact>> | null = null
  if (persistToFilesystem) {
    writeResult = await writeArtifact(provider, {
      key: artifactKey,
      sourceName,
      parentId: targetParentId,
      content: mongoMarkdown,
      createFolder,
    })
  }

  const saved = writeResult?.file || virtualItem
  if (!saved) {
    throw new Error('Shadow-Twin konnte nicht gespeichert werden')
  }
  
  // Bestimme den richtigen Span basierend auf Artifact-Kind
  // Transcript gehört zu extract, Transformation zu template
  // WICHTIG: Wir eliminieren "postprocessing" als separaten Span und schreiben die Speicher-Events
  // direkt in die entsprechenden Phasen-Spans, damit die Zeiten korrekt zugeordnet werden.
  const targetSpanId = artifactKey.kind === 'transcript' ? 'extract' : 'template'
  
  try {
    await repo.traceAddEvent(ctx.jobId, {
      spanId: targetSpanId,
      // Neutraler Event-Name: Speichern ist Teil der Phase (extract/template), kein eigener "postprocessing"-Block.
      name: 'artifact_saved',
      attributes: {
        name: saved.metadata.name,
        parentId: targetParentId,
        shadowTwinFolderId: shadowTwinFolderId || null,
        artifactKind: artifactKey.kind,
        targetLanguage: artifactKey.targetLanguage,
        templateName: artifactKey.templateName || null,
        markdownLength: mongoMarkdown.length,
        hasFrontmatter: mongoMarkdown.trimStart().startsWith('---'),
        storedInMongo: !!virtualItem,
        storedInFilesystem: !!writeResult,
      },
    })
  } catch {}
  try {
    await repo.traceAddEvent(ctx.jobId, {
      spanId: targetSpanId,
      name: 'artifact_stored',
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
    const uniqueName = (saved.metadata?.name as string | undefined) || fileName

    if (writeResult) {
      const p = await provider.getPathById(targetParentId)
      // Schreibe stored_path Event in den richtigen Span (extract für transcript, template für transformation)
      try {
        await repo.traceAddEvent(ctx.jobId, {
          spanId: targetSpanId,
          name: 'artifact_stored_path',
          message: `${p}/${uniqueName}`,
          attributes: {
            path: `${p}/${uniqueName}`,
            parentId: targetParentId,
            shadowTwinFolderId: shadowTwinFolderId || null,
          },
        })
      } catch {}
    }

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
      message: writeResult ? 'stored_local' : 'stored_mongo',
      jobType: ctx.job.job_type,
      fileName: uniqueName,
      sourceItemId: ctx.job.correlation?.source?.itemId,
      refreshFolderId: parentId, // Primary refresh folder (für Rückwärtskompatibilität)
      refreshFolderIds, // Array mit allen zu refreshenden Ordnern (Parent + Shadow-Twin)
      shadowTwinFolderId: shadowTwinFolderId || null, // Shadow-Twin-Verzeichnis-ID für Client-Analyse
    } as unknown as import('@/lib/events/job-event-bus').JobUpdateEvent)
  } catch {
    // Fehler beim Event-Emit nicht kritisch
  }
  return { savedItemId: saved.id }
}


