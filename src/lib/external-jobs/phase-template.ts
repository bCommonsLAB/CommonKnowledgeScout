/**
 * @fileoverview Template-Phase-Modul für Phasen-Orchestrierung
 *
 * @description
 * Konsolidiert die gesamte Template-Phase-Logik aus Callback-Route und Start-Route.
 * Führt Template-Transformation, Kapitel-Analyse, Markdown-Speicherung und Bild-Verarbeitung durch.
 *
 * @module external-jobs
 */

import type { RequestContext, PhasePolicies } from '@/types/external-jobs'
import type { ExternalJob } from '@/types/external-job'
import type { StorageProvider } from '@/lib/storage/types'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { preprocessorTransformTemplate } from '@/lib/external-jobs/preprocessor-transform-template'
import { decideTemplateRun } from '@/lib/external-jobs/template-decision'
import { runTemplateTransform } from '@/lib/external-jobs/template-run'
import { analyzeAndMergeChapters } from '@/lib/external-jobs/chapters'
import { saveMarkdown } from '@/lib/external-jobs/storage'
import { processAllImageSources } from '@/lib/external-jobs/images'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { handleJobError } from '@/lib/external-jobs/error-handler'
import { FileLogger } from '@/lib/debug/logger'
import type { LibraryChatConfig } from '@/types/library'

export interface TemplatePhaseArgs {
  ctx: RequestContext
  provider: StorageProvider
  repo: ExternalJobsRepository
  extractedText: string
  bodyMetadata?: Record<string, unknown>
  policies: { metadata: 'force' | 'skip' | 'auto' | 'ignore' | 'do'; ingest?: 'force' | 'skip' | 'auto' | 'ignore' | 'do' }
  autoSkip: boolean
  imagesPhaseEnabled: boolean
  pagesArchiveData?: string
  pagesArchiveUrl?: string
  pagesArchiveFilename?: string
  imagesArchiveData?: string
  imagesArchiveFilename?: string
  imagesArchiveUrl?: string
  mistralOcrRaw?: unknown
  hasMistralOcrImages?: boolean
  mistralOcrImagesUrl?: string
  targetParentId: string
  libraryConfig?: LibraryChatConfig
}

export interface TemplatePhaseResult {
  metadata: Record<string, unknown>
  savedItemId?: string
  status: 'completed' | 'failed' | 'skipped'
  skipped: boolean
  errorMessage?: string
}

/**
 * Führt die Template-Phase aus: Transformation, Kapitel-Analyse, Speicherung, Bild-Verarbeitung.
 *
 * @param args Template-Phase-Argumente
 * @returns Template-Phase-Ergebnis
 */
export async function runTemplatePhase(args: TemplatePhaseArgs): Promise<TemplatePhaseResult> {
  const {
    ctx,
    provider,
    repo,
    extractedText,
    bodyMetadata,
    policies,
    autoSkip,
    imagesPhaseEnabled,
    pagesArchiveData,
    pagesArchiveUrl,
    pagesArchiveFilename,
    imagesArchiveData,
    imagesArchiveFilename,
    imagesArchiveUrl,
    mistralOcrRaw,
    hasMistralOcrImages,
    mistralOcrImagesUrl,
    targetParentId,
    // libraryConfig wird derzeit nicht verwendet
  } = args

  const { jobId, job } = ctx
  
  // Erweitere policies um ingest, falls nicht vorhanden
  const fullPolicies: PhasePolicies = {
    metadata: policies.metadata as string,
    ingest: (policies.ingest || 'auto') as string
  }
  let templateStatus: 'completed' | 'failed' | 'skipped' = 'completed'
  let templateSkipped = false
  let templateCompletedMarked = false

  /**
   * TEMPLATE-PHASE ENTSCHEIDUNGSLOGIK:
   * 
   * Die Template-Phase wird nur ausgeführt, wenn chapters fehlen.
   * Pages werden IMMER aus dem Markdown-Body rekonstruiert (nicht durch Template-Analyse berechnet).
   * 
   * Entscheidungsbaum:
   * 1. Wenn chapters vorhanden sind (aus bestehender Datei oder bodyMetadata):
   *    → Template-Phase überspringen
   *    → Pages aus Markdown-Body rekonstruieren (falls pages fehlt)
   * 
   * 2. Wenn chapters fehlt:
   *    → Template-Phase ausführen (erstellt chapters)
   *    → Kapitel-Analyse ausführen (falls chapters immer noch fehlt)
   *    → Pages aus Markdown-Body rekonstruieren (falls pages fehlt)
   * 
   * WICHTIG: Pages werden NICHT durch Template-Transformation berechnet, sondern immer
   * durch Extraktion der höchsten Seitennummer aus den "--- Seite N ---" Markern im Body.
   */

  // Gate für Transform-Template (Phase 2)
  let templateGateExists = false
  // Frontmatter-Vollständigkeit aus Callback/Body als primäres Gate verwenden
  // WICHTIG: Wir prüfen nur auf chapters, NICHT auf pages (pages wird immer aus Body rekonstruiert)
  const fmFromBody = bodyMetadata || null
  const hasChaptersInBody = Array.isArray((fmFromBody as { chapters?: unknown })?.chapters) && ((fmFromBody as { chapters: unknown[] }).chapters as unknown[]).length > 0
  const pagesRawInBody = (fmFromBody as { pages?: unknown })?.pages as unknown
  const pagesNumInBody = typeof pagesRawInBody === 'number' ? pagesRawInBody : (typeof pagesRawInBody === 'string' ? Number(pagesRawInBody) : NaN)
  // Vollständiges Frontmatter = chapters UND pages vorhanden (für Gate-Prüfung)
  const isFrontmatterCompleteFromBody = !!fmFromBody && hasChaptersInBody && Number.isFinite(pagesNumInBody) && (pagesNumInBody as number) > 0
  // WICHTIG: Für Template-Entscheidung prüfen wir nur chapters (pages wird immer rekonstruiert)
  const hasChaptersOnlyInBody = !!fmFromBody && hasChaptersInBody
  const bodyPhaseStr = typeof (ctx.body as { phase?: unknown })?.phase === 'string' ? String((ctx.body as { phase?: unknown }).phase) : ''
  const isTemplateCompletedCallback = bodyPhaseStr === 'template_completed'
  if (isFrontmatterCompleteFromBody && policies.metadata !== 'force' && !isTemplateCompletedCallback) {
    templateGateExists = true
    bufferLog(jobId, { phase: 'transform_gate_skip', message: 'frontmatter_complete_body' })
  }

  // Entscheidung modular treffen (inkl. Gate/Repair-Probe/Logging)
  const preTemplate = await preprocessorTransformTemplate(ctx)
  
  /**
   * Prüfe VOR der Template-Entscheidung, ob chapters bereits vorhanden sind.
   * 
   * Wenn chapters vorhanden sind:
   * - Template-Phase kann übersprungen werden (außer bei 'force' Policy)
   * - Pages wird später aus Markdown-Body rekonstruiert (falls pages fehlt)
   * 
   * Wenn chapters fehlt:
   * - Template-Phase muss ausgeführt werden, um chapters zu erstellen
   * - Anschließend wird pages aus Markdown-Body rekonstruiert
   */
  let hasChaptersBeforeDecision = false
  if (policies.metadata !== 'force') {
    try {
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const uniqueName = `${baseName}.${lang}.md`
      
      bufferLog(jobId, {
        phase: 'template_check_chapters_before',
        message: `Prüfe auf vorhandene chapters vor Template-Entscheidung`,
        targetParentId,
        uniqueName,
        hasChaptersInBody
      })
      
      const siblings = await provider.listItemsById(targetParentId)
      const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string } | undefined
      if (existing) {
        const bin = await provider.getBinary(existing.id)
        const text = await bin.blob.text()
        const parsed = parseSecretaryMarkdownStrict(text)
        const existingMetaCheck = parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta) ? parsed.meta as Record<string, unknown> : null
        const existingChaptersCheck = Array.isArray(existingMetaCheck?.chapters) && (existingMetaCheck.chapters as Array<unknown>).length > 0
        // Prüfe alle Quellen: bestehende Datei, bodyMetadata, oder fmFromBody
        hasChaptersBeforeDecision = existingChaptersCheck || hasChaptersOnlyInBody || Array.isArray((fmFromBody as { chapters?: unknown })?.chapters)
        
        bufferLog(jobId, {
          phase: 'template_check_chapters_result',
          message: `Chapters-Prüfung abgeschlossen`,
          existingChaptersCheck,
          hasChaptersInBody,
          hasChaptersBeforeDecision,
          fileId: existing.id,
          fileName: uniqueName
        })
        
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_check_chapters_before',
            attributes: {
              targetParentId,
              uniqueName,
              existingChaptersCheck,
              hasChaptersInBody,
              hasChaptersBeforeDecision,
              fileId: existing.id
            }
          })
        } catch {}
      } else {
        bufferLog(jobId, {
          phase: 'template_check_chapters_result',
          message: `Keine bestehende Datei gefunden`,
          uniqueName,
          targetParentId,
          siblingsCount: siblings.length
        })
      }
    } catch (error) {
      FileLogger.warn('phase-template', 'Fehler beim Prüfen auf vorhandene chapters', {
        jobId,
        targetParentId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Fehler beim Laden nicht kritisch - Entscheidung basiert auf anderen Faktoren
    }
  }
  
  const decision = await decideTemplateRun({
    ctx,
    policies: fullPolicies,
    isFrontmatterCompleteFromBody,
    templateGateExists,
    autoSkip,
    isTemplateCompletedCallback,
    // @ts-expect-error - zusätzliche Info, interne Nutzung
    preNeedTemplate: ((): boolean => {
      if (fullPolicies.metadata === 'force') return true
      if (fullPolicies.metadata === 'skip') return false
      // Wenn chapters bereits vorhanden sind, brauchen wir Template nicht (nur pages wird rekonstruiert)
      if (hasChaptersBeforeDecision && fullPolicies.metadata !== 'force') return false
      if (typeof preTemplate.frontmatterValid === 'boolean') return !preTemplate.frontmatterValid
      return !isFrontmatterCompleteFromBody
    })(),
  })
  
  /**
   * OVERRIDE: Wenn chapters bereits vorhanden sind, Template überspringen (auch bei 'do' Policy).
   * 
   * WICHTIG: Diese Prüfung muss NACH decideTemplateRun erfolgen, da decideTemplateRun
   * bei 'do' Policy immer 'run' zurückgibt, ohne chapters zu prüfen.
   * 
   * Wenn chapters vorhanden sind:
   * - Template wird übersprungen (auch bei 'do' Policy)
   * - Pages wird aus Markdown-Body rekonstruiert
   */
  let shouldRunTemplate = decision.shouldRun
  if (shouldRunTemplate && hasChaptersBeforeDecision && policies.metadata !== 'force') {
    bufferLog(jobId, {
      phase: 'template_override_skip',
      message: 'Template übersprungen: chapters bereits vorhanden (override für do-Policy)',
      originalDecision: decision.reason
    })
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'template',
        name: 'template_override_skip',
        attributes: {
          reason: 'chapters_already_exist',
          originalDecision: decision.reason,
          policy: policies.metadata
        }
      })
    } catch {}
    shouldRunTemplate = false
  }

  /**
   * TEMPLATE ÜBERSPRUNGEN:
   * 
   * Wenn Template übersprungen wird (chapters bereits vorhanden):
   * - Frontmatter aus bodyMetadata übernehmen
   * - Pages aus Markdown-Body rekonstruieren (falls pages fehlt)
   * - Keine Template-Transformation, keine Kapitel-Analyse
   */
  if (!shouldRunTemplate) {
    bufferLog(jobId, { phase: 'transform_meta_skipped', message: 'Template-Transformation übersprungen (chapters vorhanden)' })
    // Sichtbares Step-/Trace-Update für UI/Monitoring – nur wenn noch KEIN Template-Span existiert
    let hasTemplateSpan = false
    try {
      const latest = await repo.get(jobId)
      const spans = (latest as unknown as { trace?: { spans?: Array<{ spanId?: string }> } })?.trace?.spans || []
      hasTemplateSpan = Array.isArray(spans) && spans.some(s => (s?.spanId || '') === 'template')
    } catch {}
    if (!hasTemplateSpan) {
      const callbackReceivedAt = new Date()
      try { await repo.traceStartSpan(jobId, { spanId: 'template', parentSpanId: 'job', name: 'transform_template', startedAt: callbackReceivedAt }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'transform_gate_skip', attributes: { message: 'chapters_already_exist' } }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'transform_meta_skipped', attributes: { reason: 'chapters_already_exist' } }) } catch {}
      try { await repo.traceEndSpan(jobId, 'template', 'skipped', { reason: 'chapters_already_exist' }) } catch {}
      // Step-Markierung nur im reinen Skip-Fall
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'chapters_already_exist' } }) } catch {}
    }
    // SSOT: bereits geliefertes Frontmatter direkt übernehmen
    let skippedMeta = fmFromBody || {}
    try {
      if (fmFromBody) {
        await repo.appendMeta(jobId, { ...fmFromBody } as Record<string, unknown>, 'template_transform')
      }
    } catch {}
    
    /**
     * PAGES-REKONSTRUKTION (wenn Template übersprungen):
     * 
     * Wenn chapters vorhanden sind, aber pages fehlt:
     * - Lade Markdown-Body (aus extractedText oder bestehender Datei)
     * - Extrahiere höchste Seitennummer aus "--- Seite N ---" Markern
     * - Setze pages = maxPage
     * 
     * WICHTIG: Pages wird NICHT durch Template-Analyse berechnet, sondern immer aus Body rekonstruiert.
     */
    const hasChaptersInSkippedMeta = Array.isArray((skippedMeta as { chapters?: unknown })?.chapters) && ((skippedMeta as { chapters: unknown[] }).chapters as unknown[]).length > 0
    const pagesRawInSkippedMeta = (skippedMeta as { pages?: unknown })?.pages as unknown
    const hasPagesInSkippedMeta = typeof pagesRawInSkippedMeta === 'number' && pagesRawInSkippedMeta > 0
    
    if (hasChaptersInSkippedMeta && !hasPagesInSkippedMeta) {
      // Lade textSource für Pages-Rekonstruktion
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const uniqueName = `${baseName}.${lang}.md`
      let textSourceForRepair: string = extractedText || ''
      if (!textSourceForRepair) {
        try {
          const siblings = await provider.listItemsById(targetParentId)
          const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string } | undefined
          if (existing) {
            const bin = await provider.getBinary(existing.id)
            textSourceForRepair = await bin.blob.text()
          }
        } catch {}
      }
      
      if (textSourceForRepair) {
        try {
          const pageMarkerRegex = /^---\s*Seite\s*(\d+)\s*---\s*$/gm
          const pageNumbers: number[] = []
          let match: RegExpExecArray | null
          while ((match = pageMarkerRegex.exec(textSourceForRepair))) {
            const pageNo = Number(match[1])
            if (Number.isFinite(pageNo) && pageNo > 0) {
              pageNumbers.push(pageNo)
            }
          }
          
          if (pageNumbers.length > 0) {
            const maxPage = Math.max(...pageNumbers)
            skippedMeta = { ...skippedMeta, pages: maxPage }
            bufferLog(jobId, {
              phase: 'frontmatter_repair_skipped',
              message: `Seitenzahl rekonstruiert (Template übersprungen): ${maxPage}`,
              reconstructedPages: maxPage,
              foundMarkers: pageNumbers.length
            })
            try {
              await repo.traceAddEvent(jobId, {
                spanId: 'template',
                name: 'frontmatter_pages_reconstructed_skipped',
                attributes: {
                  reconstructedPages: maxPage,
                  foundMarkers: pageNumbers.length,
                  reason: 'template_skipped_but_pages_missing'
                }
              })
            } catch {}
            // Aktualisiere Meta im Job
            try {
              await repo.appendMeta(jobId, { pages: maxPage } as Record<string, unknown>, 'template_transform')
            } catch {}
          }
        } catch (error) {
          FileLogger.warn('phase-template', 'Fehler beim Rekonstruieren der Seitenzahl (Template übersprungen)', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
    
    templateSkipped = true
    templateStatus = 'skipped'
    return {
      metadata: skippedMeta,
      status: 'skipped',
      skipped: true,
    }
  }

  // Idempotenz: Bereits abgeschlossenen Step nicht erneut ausführen (außer 'force')
  let templateAlreadyCompleted = false
  try {
    const latest = await repo.get(jobId)
    const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'transform_template') : undefined
    templateAlreadyCompleted = !!st && st.status === 'completed'
  } catch {}
  if (templateAlreadyCompleted && policies.metadata !== 'force') {
    bufferLog(jobId, { phase: 'transform_gate_skip', message: 'already_completed' })
    templateStatus = 'skipped'
    return {
      metadata: fmFromBody || {},
      status: 'skipped',
      skipped: true,
    }
  }

  try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_step_start' }) } catch {}
  await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() })

  let metadataFromTemplate: Record<string, unknown> | null = null
  let picked: { templateContent: string; templateName: string; isPreferred: boolean } | null = null
  // Preferred Template aus Library-Config: secretaryService.pdfDefaults.template
  // Deklariere außerhalb des try-Blocks, damit es im catch-Block verfügbar ist
  let preferredTemplate: string | undefined = undefined

  try {
    // Templates wählen via zentrale Template-Service Library
    const { pickTemplate } = await import('@/lib/external-jobs/template-files')
    
    // Priorität: 1. Job-Parameter, 2. Library-Config
    // Prüfe zuerst Job-Parameter (höchste Priorität)
    const templateFromJobParams = job.parameters?.template as string | undefined
    if (templateFromJobParams) {
      preferredTemplate = templateFromJobParams
      FileLogger.info('phase-template', 'Template aus Job-Parametern gefunden', {
        jobId,
        libraryId: job.libraryId,
        preferredTemplate,
      })
    } else {
      // Fallback: Versuche Template aus Library-Config zu lesen
      // libraryConfig ist vom Typ LibraryChatConfig, aber das Template ist in storageConfig.secretaryService.pdfDefaults.template
      // Daher müssen wir die Library direkt laden, um an storageConfig zu kommen
      try {
        const { LibraryService } = await import('@/lib/services/library-service')
        const libraryService = LibraryService.getInstance()
        const library = await libraryService.getLibrary(job.userEmail, job.libraryId)
        preferredTemplate = library?.config?.secretaryService?.pdfDefaults?.template
        
        if (preferredTemplate) {
          FileLogger.info('phase-template', 'Template aus Library-Config gefunden', {
            jobId,
            libraryId: job.libraryId,
            preferredTemplate,
          })
        } else {
          FileLogger.info('phase-template', 'Kein Template in Library-Config, versuche Template aus MongoDB zu finden', {
            jobId,
            libraryId: job.libraryId,
          })
        }
      } catch (error) {
        FileLogger.warn('phase-template', 'Fehler beim Laden der Library für Template-Auswahl', {
          jobId,
          libraryId: job.libraryId,
          error: error instanceof Error ? error.message : String(error),
        })
        // Nicht kritisch - pickTemplate kann auch ohne Preferred Template ein Template aus MongoDB verwenden
      }
    }
    
    // pickTemplate aufrufen - lädt Template aus MongoDB
    picked = await pickTemplate({ 
      repo, 
      jobId,
      libraryId: job.libraryId,
      userEmail: job.userEmail,
      preferredTemplateName: preferredTemplate 
    })
    
    // Template wurde erfolgreich geladen
    const templateContent = picked.templateContent
    await repo.appendMeta(jobId, { template_used: picked.templateName }, 'template_pick')
    
    // Warnung, wenn Preferred Template nicht gefunden wurde (sollte nicht passieren, da Fehler geworfen wird)
    if (!picked.isPreferred && preferredTemplate) {
      FileLogger.warn('phase-template', 'Preferred Template nicht gefunden, alternatives Template verwendet', {
        jobId,
        preferredTemplate,
        usedTemplate: picked.templateName
      })
      bufferLog(jobId, { 
        phase: 'transform_meta_warning', 
        message: `Preferred Template "${preferredTemplate}" nicht gefunden, verwende "${picked.templateName}"`
      })
    }

    const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
    const tr = await runTemplateTransform({ ctx, extractedText: extractedText || '', templateContent, targetLanguage: lang })
    metadataFromTemplate = tr.meta as unknown as Record<string, unknown> | null
    if (metadataFromTemplate) {
      bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' })
    } else {
      // runTemplateTransform sollte jetzt einen Fehler werfen, wenn kein gültiges Meta zurückgegeben wird
      // Falls es doch null zurückgibt, werfe explizit einen Fehler
      const errorMsg = 'Transformer lieferte kein gültiges structured_data'
      bufferLog(jobId, { phase: 'transform_meta_failed', message: errorMsg })
      throw new Error(errorMsg)
    }
    try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_step_after_transform', attributes: { hasMeta: !!metadataFromTemplate } }) } catch {}
  } catch (err) {
    // Prüfe ob es ein Template-Not-Found-Fehler ist
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (errorMessage.includes('nicht gefunden') || errorMessage.includes('not found')) {
      FileLogger.error('phase-template', 'Template nicht gefunden', {
        jobId,
        preferredTemplate,
        error: errorMessage
      })
      bufferLog(jobId, { 
        phase: 'transform_meta_error', 
        message: errorMessage
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'step_failed',
          attributes: {
            step: 'transform_template',
            error: errorMessage,
            reason: 'template_not_found',
            preferredTemplate: preferredTemplate || '(nicht gesetzt)'
          }
        })
      } catch {}
      templateStatus = 'failed'
      throw err // Fehler weiterwerfen
    }
    
    // Andere Fehler (z.B. HTTP-Fehler beim Template-Transform)
    // Extrahiere strukturierte Fehlerinformationen aus Error-Objekt
    // errorMessage wurde bereits oben deklariert, hier wiederverwenden
    const errorWithDetails = err as Error & {
      status?: number
      statusText?: string
      contentLength?: number
      maxContentLength?: string
      extractedTextLen?: number
      templateContentLen?: number
      is413Error?: boolean
      errorType?: string
      url?: string
      responseData?: unknown
    }
    
    const isPayloadTooLarge = errorWithDetails.is413Error || errorMessage.includes('413') || errorMessage.includes('REQUEST ENTITY TOO LARGE')
    const contentLength = errorWithDetails.contentLength || (extractedText?.length || 0) + (picked?.templateContent?.length || 0) + 200
    const extractedTextLen = errorWithDetails.extractedTextLen || extractedText?.length || 0
    const templateContentLen = errorWithDetails.templateContentLen || picked?.templateContent?.length || 0
    const maxContentLength = errorWithDetails.maxContentLength || 'unbekannt'
    
    FileLogger.error('phase-template', 'Fehler bei Template-Transformation', {
      jobId,
      error: errorMessage,
      isPayloadTooLarge,
      extractedTextLength: extractedTextLen,
      templateContentLength: templateContentLen,
      contentLength,
      maxContentLength,
      status: errorWithDetails.status,
      statusText: errorWithDetails.statusText,
    })
    
    // Formatierte Fehlermeldung für bufferLog
    let formattedErrorMessage: string
    if (isPayloadTooLarge) {
      formattedErrorMessage = `Template-Transformation fehlgeschlagen: Request zu groß (HTTP 413). Content-Length: ${contentLength} Bytes (Text: ${extractedTextLen}, Template: ${templateContentLen}), Max-Content-Length: ${maxContentLength}`
    } else {
      formattedErrorMessage = `Fehler bei Template-Transformation: ${errorMessage}`
    }
    
    bufferLog(jobId, { 
      phase: 'transform_meta_error', 
      message: formattedErrorMessage
    })
    
    // Trace-Event für Fehler (nur einmal hier)
    try {
      // Extrahiere Response-Daten für Debugging (falls vorhanden)
      const responseDataPreview = errorWithDetails.responseData 
        ? (typeof errorWithDetails.responseData === 'object' 
          ? JSON.stringify(errorWithDetails.responseData).substring(0, 500)
          : String(errorWithDetails.responseData).substring(0, 500))
        : undefined
      
      await repo.traceAddEvent(jobId, {
        spanId: 'template',
        name: 'step_failed',
        attributes: {
          step: 'transform_template',
          error: errorMessage,
          status: errorWithDetails.status,
          statusText: errorWithDetails.statusText,
          contentLength,
          maxContentLength,
          extractedTextLen,
          templateContentLen,
          is413Error: isPayloadTooLarge,
          errorType: errorWithDetails.errorType,
          url: errorWithDetails.url,
          responseDataPreview // Erste 500 Zeichen der Response für Debugging
        }
      })
    } catch {}
    
    templateStatus = 'failed'
  }

  // Fatal: Wenn Template-Transformation gestartet wurde, aber fehlgeschlagen ist, abbrechen
  if (templateStatus === 'failed') {
    await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date() })
    
    // Verwende die bereits formatierte Fehlermeldung aus dem catch-Block
    // Die Fehlermeldung wurde bereits in bufferLog geschrieben und im Trace-Event gespeichert
    // Hier extrahieren wir sie aus dem letzten Trace-Event für die finale Fehlermeldung
    let errorMessage = 'Template-Transformation fehlgeschlagen'
    try {
      const latest = await repo.get(jobId)
      const latestWithTrace = latest as ExternalJob & { trace?: { events?: Array<{ name?: string; attributes?: { error?: string; contentLength?: number; extractedTextLen?: number; templateContentLen?: number; maxContentLength?: string; is413Error?: boolean; status?: number; statusText?: string; errorType?: string; url?: string } }> } };
      // Suche nach dem letzten step_failed Event (kann mehrere geben)
      const failedEvents = latestWithTrace?.trace?.events?.filter((e: { name?: string }) => e.name === 'step_failed') || []
      const failedEvent = failedEvents[failedEvents.length - 1] // Nehm das letzte
      
      if (failedEvent?.attributes) {
        const attrs = failedEvent.attributes
        if (attrs.is413Error || attrs.error?.includes('413')) {
          const contentLength = attrs.contentLength || 0
          const extractedTextLen = attrs.extractedTextLen || 0
          const templateContentLen = attrs.templateContentLen || 0
          const maxContentLength = attrs.maxContentLength || 'unbekannt'
          errorMessage = `Template-Transformation fehlgeschlagen: Request zu groß (HTTP 413). Content-Length: ${contentLength} Bytes (Text: ${extractedTextLen}, Template: ${templateContentLen}), Max-Content-Length: ${maxContentLength}`
        } else {
          // Für andere Fehler: verwende die Error-Message aus dem Trace-Event
          // Füge HTTP-Status hinzu, falls vorhanden
          const statusInfo = attrs.status ? ` (HTTP ${attrs.status}${attrs.statusText ? `: ${attrs.statusText}` : ''})` : ''
          const errorTypeInfo = attrs.errorType ? ` [${attrs.errorType}]` : ''
          const urlInfo = attrs.url ? ` (${attrs.url})` : ''
          errorMessage = attrs.error 
            ? `Template-Transformation fehlgeschlagen: ${attrs.error}${statusInfo}${errorTypeInfo}${urlInfo}` 
            : `Template-Transformation fehlgeschlagen${statusInfo}${errorTypeInfo}${urlInfo}`
        }
      }
    } catch (traceError) {
      // Fehler beim Laden ignorieren, verwende Standard-Fehlermeldung
      FileLogger.warn('phase-template', 'Fehler beim Extrahieren der Fehlermeldung aus Trace', {
        jobId,
        error: traceError instanceof Error ? traceError.message : String(traceError)
      })
    }
    
    await handleJobError(
      new Error(errorMessage),
      {
        jobId,
        userEmail: job.userEmail,
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
        sourceItemId: job.correlation?.source?.itemId,
      },
      repo,
      'template_failed',
      'template'
    )
    return {
      metadata: {},
      status: 'failed',
      skipped: false,
      errorMessage,
    }
  }

  const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const uniqueName = `${baseName}.${lang}.md`

  // SSOT: Flache, UI-taugliche Metafelder ergänzen (nur auf stabilem Meilenstein)
  const baseMeta = bodyMetadata || {}
  const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta }
  const ssotFlat: Record<string, unknown> = {
    job_id: jobId,
    source_file: job.correlation.source?.name || baseName,
    extract_status: 'completed',
    template_status: templateStatus,
  }
  // Template-Name im Frontmatter speichern, damit wir beim nächsten Mal prüfen können, ob es geändert wurde
  // Verwende das tatsächlich verwendete Template (picked.templateName) oder das Preferred Template
  const usedTemplate = picked?.templateName || preferredTemplate || job.parameters?.template as string | undefined
  if (usedTemplate) {
    ssotFlat['template'] = usedTemplate
  }
  // optionale Summary-Werte aus bereits vorhandenen Metadaten übernehmen, wenn vorhanden
  if (typeof (finalMeta as Record<string, unknown>)['summary_pages'] === 'number') ssotFlat['summary_pages'] = (finalMeta as Record<string, unknown>)['summary_pages']
  if (typeof (finalMeta as Record<string, unknown>)['summary_chunks'] === 'number') ssotFlat['summary_chunks'] = (finalMeta as Record<string, unknown>)['summary_chunks']
  ssotFlat['summary_language'] = lang

  // Kapitel zentral normalisieren (Analyze-Endpoint), Ergebnis in Frontmatter mergen
  // Bestehendes Frontmatter laden (falls Datei existiert) und als Basis verwenden
  // WICHTIG: Wir laden die transformierte Datei mit Sprachkürzel (z.B. Livique_Sørensen.de.md),
  // NICHT die OCR-generierte Datei ohne Frontmatter (z.B. Livique_Sørensen.md)
  let existingMeta: Record<string, unknown> | null = null
  let existingFileId: string | undefined = undefined
  let existingFileName: string | undefined = undefined
  try {
    const siblings = await provider.listItemsById(targetParentId)
    const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string; metadata: { name: string } } | undefined
    if (existing) {
      existingFileId = existing.id
      existingFileName = existing.metadata.name
      const bin = await provider.getBinary(existing.id)
      const text = await bin.blob.text()
      const parsed = parseSecretaryMarkdownStrict(text)
      existingMeta = parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta) ? parsed.meta as Record<string, unknown> : null
      
      bufferLog(jobId, {
        phase: 'template_load_existing',
        message: `Bestehende transformierte Markdown-Datei geladen: ${existingFileName}`,
        fileId: existingFileId,
        fileName: existingFileName,
        hasFrontmatter: !!existingMeta,
        frontmatterKeys: existingMeta ? Object.keys(existingMeta).length : 0,
        hasChapters: Array.isArray(existingMeta?.chapters) && (existingMeta.chapters as Array<unknown>).length > 0
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'template_load_existing_file',
          attributes: {
            fileId: existingFileId,
            fileName: existingFileName,
            hasFrontmatter: !!existingMeta,
            frontmatterKeys: existingMeta ? Object.keys(existingMeta).length : 0,
            hasChapters: Array.isArray(existingMeta?.chapters) && (existingMeta.chapters as Array<unknown>).length > 0
          }
        })
      } catch {}
    } else {
      bufferLog(jobId, {
        phase: 'template_load_existing',
        message: `Keine bestehende transformierte Markdown-Datei gefunden: ${uniqueName}`,
        searchedFileName: uniqueName,
        targetParentId
      })
    }
  } catch (error) {
    FileLogger.warn('phase-template', 'Fehler beim Laden der bestehenden Markdown-Datei', {
      jobId,
      uniqueName,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  // Basis-Merge: bevorzugt Template-Felder, aber Kapitel stammen standardmäßig aus bestehendem Frontmatter
  const existingChaptersPref: unknown = existingMeta && typeof existingMeta === 'object' ? (existingMeta as Record<string, unknown>)['chapters'] : undefined
  const templateChaptersPref: unknown = finalMeta && typeof finalMeta === 'object' ? (finalMeta as Record<string, unknown>)['chapters'] : undefined
  const initialChapters: Array<Record<string, unknown>> | undefined = Array.isArray(existingChaptersPref)
    ? existingChaptersPref as Array<Record<string, unknown>>
    : (Array.isArray(templateChaptersPref) ? templateChaptersPref as Array<Record<string, unknown>> : undefined)
  let mergedMeta = { ...(existingMeta || {}), ...finalMeta, ...ssotFlat } as Record<string, unknown>
  if (initialChapters) (mergedMeta as { chapters: Array<Record<string, unknown>> }).chapters = initialChapters
  
  // Prüfe, ob chapters bereits vorhanden sind (aus existingMeta, finalMeta/metadataFromTemplate, oder bodyMetadata)
  // Diese Prüfung muss VOR dem Laden von textSource erfolgen, damit wir wissen, ob Analyse nötig ist
  const hasChaptersFromExisting = Array.isArray(existingChaptersPref) && (existingChaptersPref as Array<unknown>).length > 0
  const hasChaptersFromTemplate = Array.isArray(templateChaptersPref) && (templateChaptersPref as Array<unknown>).length > 0
  const hasChaptersFromBody = Array.isArray((bodyMetadata as { chapters?: unknown })?.chapters) && ((bodyMetadata as { chapters: unknown[] }).chapters as unknown[]).length > 0
  const hasExistingChapters = hasChaptersFromExisting || hasChaptersFromTemplate || hasChaptersFromBody
  
  // Quelle für die Kapitelanalyse: bevorzugt frisch geliefertes extractedText, sonst transformierte Markdown-Datei aus Storage
  // WICHTIG: Wir verwenden die transformierte Datei (z.B. Livique_Sørensen.de.md), NICHT die OCR-generierte Datei
  let textSource: string = extractedText || ''
  let textSourceFileId: string | undefined = undefined
  let textSourceFileName: string | undefined = undefined
  let textSourceOrigin: 'extractedText' | 'existingFile' | 'none' = extractedText ? 'extractedText' : 'none'
  if (!textSource) {
    try {
      const siblings = await provider.listItemsById(targetParentId)
      const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string; metadata: { name: string } } | undefined
      if (existing) {
        textSourceFileId = existing.id
        textSourceFileName = existing.metadata.name
        const bin = await provider.getBinary(existing.id)
        textSource = await bin.blob.text()
        textSourceOrigin = 'existingFile'
        
        bufferLog(jobId, {
          phase: 'template_load_text_source',
          message: `Text-Quelle geladen aus transformierter Markdown-Datei: ${textSourceFileName}`,
          fileId: textSourceFileId,
          fileName: textSourceFileName,
          textLength: textSource.length
        })
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_load_text_source',
            attributes: {
              origin: textSourceOrigin,
              fileId: textSourceFileId,
              fileName: textSourceFileName,
              textLength: textSource.length
            }
          })
        } catch {}
      } else {
        bufferLog(jobId, {
          phase: 'template_load_text_source',
          message: `Keine Text-Quelle gefunden: weder extractedText noch Datei ${uniqueName}`,
          searchedFileName: uniqueName
        })
      }
    } catch (error) {
      FileLogger.warn('phase-template', 'Fehler beim Laden der Text-Quelle', {
        jobId,
        uniqueName,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } else {
    bufferLog(jobId, {
      phase: 'template_load_text_source',
      message: 'Text-Quelle aus extractedText verwendet',
      origin: textSourceOrigin,
      textLength: textSource.length
    })
  }
  /**
   * KAPITEL-ANALYSE (wenn Template ausgeführt wurde):
   * 
   * Entscheidungslogik:
   * - Wenn chapters bereits vorhanden sind → Analyse überspringen, nur pages rekonstruieren
   * - Wenn chapters fehlt → Analyse AUSFÜHREN, um chapters zu erstellen
   * 
   * Nach der Analyse wird pages aus Markdown-Body rekonstruiert (falls pages fehlt).
   */
  if (!templateSkipped) {
    // Prüfe nochmal nach dem Merge, ob chapters vorhanden sind
    const existingChaptersUnknownForApi = (mergedMeta as { chapters?: unknown }).chapters
    const hasChaptersAfterMerge = Array.isArray(existingChaptersUnknownForApi) && (existingChaptersUnknownForApi as Array<unknown>).length > 0
    // Verwende die umfassendere Prüfung (vor Merge) ODER die Prüfung nach Merge
    const shouldSkipAnalysis = hasExistingChapters || hasChaptersAfterMerge
    
    /**
     * Kapitel-Analyse nur durchführen, wenn chapters fehlt.
     * 
     * Wenn chapters vorhanden sind:
     * - Analyse überspringen (chapters bereits vorhanden)
     * - Pages wird später aus Markdown-Body rekonstruiert (falls pages fehlt)
     * 
     * Wenn chapters fehlt:
     * - Analyse AUSFÜHREN (erstellt chapters)
     * - Pages wird anschließend aus Markdown-Body rekonstruiert (falls pages fehlt)
     */
    if (!shouldSkipAnalysis) {
      // Helper: Frontmatter entfernen
      const textForAnalysis = stripAllFrontmatter(textSource)
      const chaptersInForApi: Array<Record<string, unknown>> | undefined = Array.isArray(existingChaptersUnknownForApi) ? existingChaptersUnknownForApi as Array<Record<string, unknown>> : undefined
      const chaptersRes = await analyzeAndMergeChapters({ ctx, baseMeta: mergedMeta as unknown as import('@/types/external-jobs').Frontmatter, textForAnalysis, existingChapters: chaptersInForApi as unknown as import('@/types/external-jobs').ChapterMeta[] })
      mergedMeta = chaptersRes.mergedMeta as unknown as Record<string, unknown>
    } else {
      // Logge, dass Analyse übersprungen wurde, weil chapters bereits vorhanden sind
      const chaptersCount = hasChaptersAfterMerge ? (existingChaptersUnknownForApi as Array<unknown>).length : 0
      bufferLog(jobId, {
        phase: 'chapters_analyze_skipped',
        message: 'Kapitel-Analyse übersprungen: chapters bereits vorhanden, nur pages wird rekonstruiert',
        existingChaptersCount: chaptersCount,
        source: hasChaptersFromExisting ? 'existingMeta' : (hasChaptersFromTemplate ? 'metadataFromTemplate' : (hasChaptersFromBody ? 'bodyMetadata' : 'unknown'))
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'chapters_analyze_skipped',
          attributes: {
            reason: 'chapters_already_exist',
            existingChaptersCount: chaptersCount,
            source: hasChaptersFromExisting ? 'existingMeta' : (hasChaptersFromTemplate ? 'metadataFromTemplate' : (hasChaptersFromBody ? 'bodyMetadata' : 'unknown'))
          }
        })
      } catch {}
    }
  }
  
  /**
   * PAGES-REKONSTRUKTION:
   * 
   * Pages werden IMMER aus dem Markdown-Body rekonstruiert, NICHT durch Template-Analyse berechnet.
   * Die Seitennummern werden als "--- Seite N ---" Marker im Markdown eingefügt (aus OCR-Prozess).
   * 
   * Diese Reparatur läuft:
   * - NACH der Kapitel-Analyse (falls Template ausgeführt wurde)
   * - ODER wenn Template übersprungen wurde (siehe Skip-Pfad oben)
   * 
   * Voraussetzung: chapters muss vorhanden sein (sonst wäre Template ausgeführt worden)
   */
  const hasChapters = Array.isArray(mergedMeta.chapters) && (mergedMeta.chapters as Array<unknown>).length > 0
  const pagesRaw = mergedMeta.pages
  const hasPages = typeof pagesRaw === 'number' && pagesRaw > 0
  if (hasChapters && !hasPages && textSource) {
    try {
      // Extrahiere alle Seitennummern aus dem Markdown-Body (Format: "--- Seite N ---")
      const pageMarkerRegex = /^---\s*Seite\s*(\d+)\s*---\s*$/gm
      const pageNumbers: number[] = []
      let match: RegExpExecArray | null
      while ((match = pageMarkerRegex.exec(textSource))) {
        const pageNo = Number(match[1])
        if (Number.isFinite(pageNo) && pageNo > 0) {
          pageNumbers.push(pageNo)
        }
      }
      
      if (pageNumbers.length > 0) {
        const maxPage = Math.max(...pageNumbers)
        mergedMeta.pages = maxPage
        bufferLog(jobId, {
          phase: 'frontmatter_repair',
          message: `Seitenzahl aus Markdown-Body rekonstruiert: ${maxPage} (gefunden: ${pageNumbers.length} Seiten-Marker)`,
          reconstructedPages: maxPage,
          foundMarkers: pageNumbers.length
        })
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'frontmatter_pages_reconstructed',
            attributes: {
              reconstructedPages: maxPage,
              foundMarkers: pageNumbers.length,
              reason: 'pages_missing_but_chapters_exist'
            }
          })
        } catch {}
      }
    } catch (error) {
      FileLogger.warn('phase-template', 'Fehler beim Rekonstruieren der Seitenzahl aus Markdown-Body', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Fehler nicht kritisch - Frontmatter bleibt ohne pages
    }
  }

  // Zusätzliche Sicherung: interne Lücken im bestehenden Kapitel-Array auch dann schließen,
  // wenn die Analyse keine Kapitel geliefert hat (chap.length === 0)
  try {
    const exUnknown = (mergedMeta as { chapters?: unknown }).chapters
    const chs: Array<Record<string, unknown>> = Array.isArray(exUnknown) ? (exUnknown as Array<Record<string, unknown>>) : []
    if (chs.length >= 2) {
      // sortiere stabil nach order, fallback: ursprüngliche Reihenfolge
      const withIdx = chs.map((c, i) => ({ c, i }))
      withIdx.sort((a, b) => {
        const ao = typeof (a.c as { order?: unknown }).order === 'number' ? (a.c as { order: number }).order : Number.MAX_SAFE_INTEGER
        const bo = typeof (b.c as { order?: unknown }).order === 'number' ? (b.c as { order: number }).order : Number.MAX_SAFE_INTEGER
        return ao === bo ? a.i - b.i : ao - bo
      })
      for (let i = 0; i < withIdx.length - 1; i++) {
        const cur = withIdx[i].c as Record<string, unknown>
        const nxt = withIdx[i + 1].c as Record<string, unknown>
        const curEnd = typeof (cur as { endPage?: unknown }).endPage === 'number' ? (cur as { endPage: number }).endPage : undefined
        const nxtStart = typeof (nxt as { startPage?: unknown }).startPage === 'number' ? (nxt as { startPage: number }).startPage : undefined
        if (typeof curEnd === 'number' && typeof nxtStart === 'number' && curEnd < (nxtStart - 1)) {
          (cur as { endPage: number }).endPage = nxtStart - 1
        }
        // pageCount ergänzen, wenn beide Seiten vorhanden
        const curStart = typeof (cur as { startPage?: unknown }).startPage === 'number' ? (cur as { startPage: number }).startPage : undefined
        const hasCount = typeof (cur as { pageCount?: unknown }).pageCount === 'number'
        if (!hasCount && typeof curStart === 'number' && typeof (cur as { endPage?: unknown }).endPage === 'number') {
          (cur as { pageCount: number }).pageCount = Math.max(1, ((cur as { endPage: number }).endPage) - curStart + 1)
        }
      }
    }
  } catch { /* ignore */ }

  let savedItemId: string | undefined

  // Doppelte Frontmatter vermeiden: bestehenden Block am Anfang entfernen (auch mehrfach)
  if (!templateSkipped) {
    const bodyOnly = stripAllFrontmatter(textSource)
    const { createMarkdownWithFrontmatter } = await import('@/lib/markdown/compose')
    const markdown = createMarkdownWithFrontmatter(bodyOnly, mergedMeta)
    // Zielordner prüfen
    try {
      await provider.getPathById(targetParentId)
    } catch {
      bufferLog(jobId, { phase: 'store_folder_missing', message: 'Zielordner nicht gefunden' })
      await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: 'Zielordner nicht gefunden (store)' } })
      await handleJobError(
        new Error('Zielordner nicht gefunden'),
        {
          jobId,
          userEmail: job.userEmail,
          jobType: job.job_type,
          fileName: job.correlation?.source?.name,
          sourceItemId: job.correlation?.source?.itemId,
        },
        repo,
        'STORE_FOLDER_NOT_FOUND',
        'template'
      )
      return {
        metadata: mergedMeta,
        status: 'failed',
        skipped: false,
      }
    }
    // Speichern via Modul
    // WICHTIG: Wir speichern die transformierte Datei mit Sprachkürzel (z.B. Livique_Sørensen.de.md)
    // Diese Datei enthält Frontmatter und wird im Shadow-Twin-Verzeichnis gespeichert
    const saved = await saveMarkdown({ ctx, parentId: targetParentId, fileName: uniqueName, markdown })
    savedItemId = saved.savedItemId
    bufferLog(jobId, {
      phase: 'template_save',
      message: `Transformierte Markdown-Datei gespeichert: ${uniqueName}`,
      savedItemId,
      fileName: uniqueName,
      targetParentId,
      markdownLength: markdown.length,
      hasFrontmatter: markdown.trimStart().startsWith('---')
    })
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'template',
        name: 'postprocessing_saved',
        attributes: {
          savedItemId,
          fileName: uniqueName,
          targetParentId,
          markdownLength: markdown.length,
          hasFrontmatter: markdown.trimStart().startsWith('---')
        }
      })
    } catch {}
    await repo.appendMeta(jobId, mergedMeta, 'template_transform')
  }

  // Final: Template zuverlässig abschließen (keine Hänger)
  try {
    if (!templateSkipped) {
      await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { source: 'primary' } })
      templateCompletedMarked = true
    }
  } finally {
    // Falls der Step weder failed noch completed gesetzt wurde, hier abschließen
    try {
      const latest = await repo.get(jobId)
      const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'transform_template') : undefined
      if (!templateCompletedMarked && (!st || (st.status !== 'completed' && st.status !== 'failed'))) {
        await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { source: 'fallback' } })
      }
    } catch {}
    try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_step_completed' }) } catch {}
  }

  // Bilder-ZIP optional verarbeiten (modular)
  // Unterstützt alle Quellen: pages_archive_data, images_archive_data, mistral_ocr_raw, images_archive_url
  if (imagesPhaseEnabled) {
    try {
      // Verwende Shadow-Twin-State aus Job-Dokument (beim Job-Start berechnet)
      const shadowTwinFolderId = job.shadowTwinState?.shadowTwinFolderId

      await processAllImageSources(ctx, provider, {
        pagesArchiveData,
        pagesArchiveUrl,
        pagesArchiveFilename,
        imagesArchiveData,
        imagesArchiveFilename,
        imagesArchiveUrl,
        mistralOcrRaw,
        hasMistralOcrImages: hasMistralOcrImages ?? false,
        mistralOcrImagesUrl,
        extractedText,
        lang,
        targetParentId,
        imagesPhaseEnabled,
        shadowTwinFolderId, // Verwende State aus Job-Dokument
      })
    } catch (err) {
      FileLogger.error('phase-template', 'Fehler bei Bild-Verarbeitung', {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      })
      // Bild-Verarbeitung ist nicht kritisch, daher nicht fatal
    }
  }

  return {
    metadata: mergedMeta,
    savedItemId,
    status: templateStatus,
    skipped: templateSkipped,
  }
}




