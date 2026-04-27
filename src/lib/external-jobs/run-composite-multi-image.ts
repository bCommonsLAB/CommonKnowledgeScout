/**
 * @fileoverview Worker-Helper: Composite-Multi-Image-Analyse-Pfad
 *
 * Aufgaben:
 * 1. Source-Markdown laden und auf `kind: composite-multi` pruefen.
 * 2. Per `resolveCompositeMulti` alle referenzierten Bild-Binaries laden.
 * 3. Multi-Image-Aufruf an Secretary-Image-Analyzer (`callImageAnalyzerTemplate({ files })`).
 * 4. Ergebnis als Shadow-Twin-Transformation am Composite-Markdown speichern.
 *
 * Wird aus `start/route.ts` aufgerufen, sobald die Source eine Markdown-Datei
 * mit `kind: composite-multi` ist (Detection siehe `isCompositeMultiSource`).
 *
 * @see src/lib/creation/composite-multi.ts
 * @see src/lib/secretary/image-analyzer.ts
 * @see docs/_secretary-service-docu/image-analyzer.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { FileLogger } from '@/lib/debug/logger'
import type { ExternalJob } from '@/types/external-job'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { StorageProvider } from '@/lib/storage/types'
import { LibraryService } from '@/lib/services/library-service'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import {
  resolveCompositeMulti,
  COMPOSITE_MULTI_MIN_IMAGES,
  COMPOSITE_MULTI_MAX_IMAGES,
} from '@/lib/creation/composite-multi'
import { callImageAnalyzerTemplate } from '@/lib/secretary/image-analyzer'

/**
 * Heuristische Vorab-Pruefung: ist die uebergebene Markdown-Quelle ein
 * composite-multi-Container?
 *
 * Wir parsen das Frontmatter und schauen NUR auf `kind` — alles andere
 * (Dateiendung, Validitaet von `_source_files`) ist Sache des Resolvers.
 */
export function isCompositeMultiMarkdown(markdown: string): boolean {
  try {
    const { meta } = parseFrontmatter(markdown)
    return meta.kind === 'composite-multi'
  } catch {
    return false
  }
}

/**
 * Laedt das Source-Markdown via Provider und prueft, ob es ein composite-multi
 * Container ist. Gibt das Markdown zurueck, wenn ja — sonst null.
 *
 * Wird vom Dispatcher in start/route.ts aufgerufen, BEVOR der Standard-
 * Text-Pfad startet, damit wir auf den Multi-Image-Pfad umleiten koennen.
 */
export async function peekCompositeMultiSource(args: {
  provider: StorageProvider
  job: ExternalJob
}): Promise<string | null> {
  const { provider, job } = args
  const sourceItemId = job.correlation?.source?.itemId
  const sourceName = job.correlation?.source?.name || ''
  if (!sourceItemId) return null
  if (!sourceName.toLowerCase().endsWith('.md')) return null

  try {
    const binary = await provider.getBinary(sourceItemId)
    const text = await binary.blob.text()
    return isCompositeMultiMarkdown(text) ? text : null
  } catch (error) {
    FileLogger.warn('run-composite-multi-image', 'peek failed (nicht-kritisch)', {
      jobId: job.jobId,
      sourceItemId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Eingabe fuer den Composite-Multi-Image-Worker.
 */
export interface RunCompositeMultiImageArgs {
  request: NextRequest
  jobId: string
  job: ExternalJob
  repo: ExternalJobsRepository
  provider: StorageProvider
  /** Bereits gelesenes Source-Markdown (vom Dispatcher beim peek geliefert). */
  compositeMarkdown: string
  /** Aufgeloesster Library-API-URL/Key (optional, sonst aus env). */
  libraryConfig?: { apiUrl?: string; apiKey?: string } | null
  /** Step-Name fuer den Extract-Step im Job (passt zum job_type). */
  extractStepName: 'extract_pdf' | 'extract_audio' | 'extract_video' | 'extract_office' | 'extract_image'
}

/**
 * Fuehrt den kompletten Multi-Image-Analyse-Pfad fuer einen composite-multi
 * Source-Job aus.
 *
 * Aufrufkontext:
 * - Source ist eine Markdown-Datei (.md) mit `kind: composite-multi`
 * - `_source_files` zeigt auf 2..10 Bild-Geschwister im selben Verzeichnis
 *
 * Im Erfolgsfall wird:
 * - der Job auf `completed` gesetzt
 * - eine Shadow-Twin-Transformation am Composite-Markdown angelegt
 * - Step `transform_template` als completed markiert
 *
 * Im Fehlerfall wird der Job auf `failed` gesetzt und eine entsprechende
 * `NextResponse` zurueckgegeben.
 */
export async function runCompositeMultiImagePath(
  args: RunCompositeMultiImageArgs
): Promise<NextResponse> {
  const { request, jobId, job, repo, provider, compositeMarkdown, libraryConfig, extractStepName } = args

  FileLogger.info('run-composite-multi-image', 'Composite-Multi-Pfad gestartet', {
    jobId,
    sourceName: job.correlation?.source?.name,
    parentId: job.correlation?.source?.parentId,
  })

  // Extract-Step ueberspringen — Bilder brauchen keinen Extract.
  try {
    await repo.updateStep(jobId, extractStepName, {
      status: 'completed',
      endedAt: new Date(),
      details: { skipped: true, reason: 'composite_multi_no_extract' },
    })
  } catch {}

  try {
    await repo.setStatus(jobId, 'running')
  } catch {}

  // Composite aufloesen: alle Bild-Binaries laden.
  const parentId = job.correlation?.source?.parentId || 'root'
  let resolved
  try {
    resolved = await resolveCompositeMulti({
      libraryId: job.libraryId,
      compositeMarkdown,
      parentId,
      provider,
    })
  } catch (error) {
    const msg = `Composite-Multi-Resolution fehlgeschlagen: ${
      error instanceof Error ? error.message : String(error)
    }`
    FileLogger.error('run-composite-multi-image', msg, { jobId })
    await repo.setStatus(jobId, 'failed', { error: { code: 'composite_multi_resolve_error', message: msg } })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Hartes Validieren: Anzahl Bilder muss im Limit sein.
  if (resolved.imageBinaries.length < COMPOSITE_MULTI_MIN_IMAGES) {
    const msg = `Composite-Multi: nur ${resolved.imageBinaries.length} Bild(er) geladen (Mindestens ${COMPOSITE_MULTI_MIN_IMAGES} erforderlich; fehlend: ${resolved.unresolvedSources.join(', ') || '–'})`
    await repo.setStatus(jobId, 'failed', { error: { code: 'composite_multi_underfull', message: msg } })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  if (resolved.imageBinaries.length > COMPOSITE_MULTI_MAX_IMAGES) {
    const msg = `Composite-Multi: ${resolved.imageBinaries.length} Bilder uebersteigen das Secretary-Limit (${COMPOSITE_MULTI_MAX_IMAGES})`
    await repo.setStatus(jobId, 'failed', { error: { code: 'composite_multi_overfull', message: msg } })
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Wenn einzelne Quellen fehlen, harten Abbruch — der Anwender soll das sehen
  // und entscheiden (loeschen + neu erstellen). Kein silent fallback.
  if (resolved.unresolvedSources.length > 0) {
    const msg = `Composite-Multi unvollstaendig: ${resolved.unresolvedSources.join(', ')}`
    FileLogger.error('run-composite-multi-image', msg, { jobId })
    await repo.setStatus(jobId, 'failed', { error: { code: 'composite_multi_incomplete', message: msg } })
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Template laden — gleiche Logik wie der Single-Image-Pfad.
  const { pickTemplate } = await import('@/lib/external-jobs/template-files')
  const templateDoc = await pickTemplate({
    repo,
    jobId,
    libraryId: job.libraryId,
    userEmail: job.userEmail,
    job,
  })
  if (!templateDoc?.templateContent) {
    const msg = 'Kein Template gefunden fuer Composite-Multi-Image-Analyse'
    await repo.updateStep(jobId, 'transform_template', {
      status: 'failed',
      endedAt: new Date(),
      error: { message: msg },
    })
    await repo.setStatus(jobId, 'failed', { error: { code: 'no_template', message: msg } })
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Transform-Step starten.
  try {
    await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() })
  } catch {}

  // Secretary-Aufruf vorbereiten.
  const { getSecretaryConfig } = await import('@/lib/env')
  const secretaryConfig = getSecretaryConfig()
  const baseUrl = libraryConfig?.apiUrl || secretaryConfig.baseUrl
  const apiKey = libraryConfig?.apiKey || secretaryConfig.apiKey || ''
  const targetLanguage = (job.correlation?.options?.targetLanguage as string) || 'de'
  const llmModel = job.parameters?.llmModel as string | undefined

  // useCache analog zum Single-Image-Pfad: Default false, damit fehlerhafte
  // LLM-Outputs nicht stillschweigend wiederverwendet werden.
  const cacheOpt = job.correlation?.options?.useCache
  const useCache = typeof cacheOpt === 'boolean' ? cacheOpt : false

  // Kontext fuer den Secretary aufbauen.
  const sourceName = job.correlation?.source?.name || 'composite-multi.md'
  const imageContext: Record<string, unknown> = {
    fileName: sourceName,
    libraryId: job.libraryId,
    compositeKind: 'composite-multi',
    imageCount: resolved.imageBinaries.length,
    imageNames: resolved.imageBinaries.map(b => b.name),
  }

  let responseData: { text: string; structured_data?: Record<string, unknown> }
  try {
    FileLogger.info('run-composite-multi-image', 'Multi-Image Secretary-Aufruf', {
      jobId,
      imageCount: resolved.imageBinaries.length,
      useCache,
      model: llmModel,
    })

    const res = await callImageAnalyzerTemplate({
      baseUrl,
      apiKey,
      files: resolved.imageBinaries.map(b => ({
        file: b.buffer,
        fileName: b.name,
        mimeType: b.mimeType,
      })),
      templateContent: templateDoc.templateContent,
      targetLanguage,
      context: imageContext,
      model: llmModel,
      useCache,
      // Multi-Image-Calls koennen laenger dauern als Single-Image
      // (mehr Bilder = mehr Tokens = mehr LLM-Zeit).
      timeoutMs: 240_000,
    })

    const json = (await res.json()) as {
      status: string
      data?: { text: string; structured_data?: Record<string, unknown> }
      error?: unknown
    }
    if (json.status !== 'success' || !json.data?.text) {
      throw new Error(json.error ? JSON.stringify(json.error) : 'Image-Analyzer lieferte kein Ergebnis')
    }
    responseData = json.data
  } catch (error) {
    const msg = `Composite-Multi-Image-Analyzer-Fehler: ${error instanceof Error ? error.message : String(error)}`
    FileLogger.error('run-composite-multi-image', msg, { jobId })
    await repo.updateStep(jobId, 'transform_template', {
      status: 'failed',
      endedAt: new Date(),
      error: { message: msg },
    })
    await repo.setStatus(jobId, 'failed', { error: { code: 'image_analyzer_error', message: msg } })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Ergebnis als Shadow-Twin-Transformation am Composite-MD selbst speichern.
  // Anker = Sammeldatei (NICHT die Einzelbilder).
  const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
  if (!library) {
    const msg = 'Bibliothek nicht gefunden'
    await repo.updateStep(jobId, 'transform_template', {
      status: 'failed',
      endedAt: new Date(),
      error: { message: msg },
    })
    await repo.setStatus(jobId, 'failed', { error: { code: 'library_not_found', message: msg } })
    return NextResponse.json({ error: msg }, { status: 404 })
  }

  const sourceItemId = job.correlation!.source!.itemId!
  const templateFromParams =
    typeof job.parameters?.template === 'string' ? job.parameters.template.trim() : ''
  const templateName = templateDoc.templateName || templateFromParams || 'default'

  const { ShadowTwinService } = await import('@/lib/shadow-twin/store/shadow-twin-service')
  const shadowTwinService = new ShadowTwinService({
    library,
    userEmail: job.userEmail,
    sourceId: sourceItemId,
    sourceName,
    parentId,
    provider,
  })

  try {
    const savedResult = await shadowTwinService.upsertMarkdown({
      kind: 'transformation',
      targetLanguage,
      templateName,
      markdown: responseData.text,
      // shadowTwinFolderId wird vom Service ggf. selbst aufgeloest;
      // hier kein eigener Folder, da die Quelle bereits eine .md ist.
    })

    await repo.updateStep(jobId, 'transform_template', {
      status: 'completed',
      endedAt: new Date(),
      details: { templateName, targetLanguage, savedItemId: savedResult.id, imageCount: resolved.imageBinaries.length },
    })

    // Job als completed markieren.
    const { setJobCompleted } = await import('@/lib/external-jobs/complete')
    await setJobCompleted({
      ctx: { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true },
      result: { savedItemId: savedResult.id },
    })

    // SSE-Event: Job abgeschlossen, damit das UI sich automatisch aktualisiert.
    const { getJobEventBus } = await import('@/lib/events/job-event-bus')
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'completed',
      progress: 100,
      updatedAt: new Date().toISOString(),
      message: 'completed',
      jobType: job.job_type,
      fileName: sourceName,
      sourceItemId,
      libraryId: job.libraryId,
      result: { savedItemId: savedResult.id },
      refreshFolderId: parentId,
    })

    return NextResponse.json({ ok: true, jobId, kind: 'composite_multi_image' })
  } catch (error) {
    const msg = `Fehler beim Speichern der Composite-Multi-Analyse: ${
      error instanceof Error ? error.message : String(error)
    }`
    FileLogger.error('run-composite-multi-image', msg, { jobId })
    await repo.updateStep(jobId, 'transform_template', {
      status: 'failed',
      endedAt: new Date(),
      error: { message: msg },
    })
    await repo.setStatus(jobId, 'failed', { error: { code: 'save_error', message: msg } })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
