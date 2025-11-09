/**
 * @fileoverview External Jobs Callback API Route - Main Job Processing Endpoint
 * 
 * @description
 * Main callback endpoint for external job processing. Orchestrates the complete job execution
 * pipeline including authorization, template decision, transformation, chapter analysis,
 * markdown storage, image processing, and RAG ingestion. Handles progress updates and
 * error recovery. This is the central orchestration point for all external job processing.
 * 
 * @module external-jobs
 * 
 * @exports
 * - GET: Retrieves job status and details
 * - POST: Processes job callback from external service (Secretary Service)
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/external/jobs/[jobId]
 * - Secretary Service: Calls this endpoint with job results
 * - src/lib/external-jobs-worker.ts: Worker triggers job execution
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository
 * - @/lib/external-jobs: All orchestration modules
 * - @/lib/storage/server-provider: Storage provider creation
 * - @/lib/services/library-service: Library service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
// import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
// import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
// import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateIngestRag } from '@/lib/processing/gates';
import { getServerProvider } from '@/lib/storage/server-provider';
// Modularisierte Orchestrator-Module
import { readContext } from '@/lib/external-jobs/context'
import { authorizeCallback } from '@/lib/external-jobs/auth'
import { readPhasesAndPolicies } from '@/lib/external-jobs/policies'
import { decideTemplateRun } from '@/lib/external-jobs/template-decision'
import { runTemplateTransform } from '@/lib/external-jobs/template-run'
import { analyzeAndMergeChapters } from '@/lib/external-jobs/chapters'
import { saveMarkdown } from '@/lib/external-jobs/storage'
import { maybeProcessImages } from '@/lib/external-jobs/images'
import { runIngestion } from '@/lib/external-jobs/ingest'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { handleProgressIfAny } from '@/lib/external-jobs/progress'
import { buildProvider } from '@/lib/external-jobs/provider'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import { preprocess } from '@/lib/external-jobs/preprocess'
// parseSecretaryMarkdownStrict ungenutzt entfernt

// OneDrive-Utilities entfernt: Provider übernimmt Token/Uploads.

// entfernt: normalizeStructuredData, toAsciiKebab, splitToArray

// OneDrive-spezifische Upload-/Token-Utilities wurden entfernt; StorageFactory-Provider übernimmt das Speichern.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Repo-Instanz erst bei Bedarf initialisieren (vorher ungenutzt)
    // Entfernt: lärmarme Callback-Header-Events – nur minimal notwendige Logs
    const workerId = request.headers.get('x-worker-id') || request.headers.get('X-Worker-Id') || undefined;
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    // Read validated context (params, headers, body, job)
    const ctx = await readContext({ request, jobId })
    const { job, body, internalBypass } = ctx
    const repo = new ExternalJobsRepository();

    // entfernt

    // Authorization and token guard
    await authorizeCallback(ctx)
    // entfernt

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    // entfernt: doppeltes callback_received-Event (wir loggen unten via appendLog ausreichend Details)
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);
    // Prozess‑Guard: Nur Events mit übereinstimmender processId akzeptieren (außer interner Bypass/Template-Callback)
    try {
      const incomingProcessId: string | undefined = (body?.process && typeof body.process.id === 'string') ? body.process.id : (typeof body?.data?.processId === 'string' ? body.data.processId : undefined);
      if (!internalBypass && job.processId && incomingProcessId && incomingProcessId !== job.processId) {
        try { await repo.traceAddEvent(jobId, { spanId: 'job', name: 'ignored_mismatched_process', level: 'warn', attributes: { incomingProcessId, jobProcessId: job.processId } }); } catch {}
        return NextResponse.json({ status: 'ignored', reason: 'mismatched_process' });
      }
    } catch {}

    // Progress-Handling (Short-Circuit)
    const short = await handleProgressIfAny(ctx, repo, workerId)
    // entfernt
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof (body?.data as { phase?: unknown })?.phase === 'string' && (body!.data as { phase: string }).phase) || undefined;
    const hasError = !!(body as { error?: unknown })?.error;
    const hasFinalPayload = !!((body?.data as { extracted_text?: unknown })?.extracted_text || (body?.data as { images_archive_url?: unknown })?.images_archive_url || (body as { status?: unknown })?.status === 'completed' || body?.phase === 'template_completed');
    // Diagnose: Eingang loggen (minimal, aber ausreichend zur Nachverfolgung)
    try {
      await repo.appendLog(jobId, { phase: 'callback_received', details: {
        internalBypass,
        hasToken: !!ctx.callbackToken,
        phaseInBody: body?.phase || body?.data?.phase || null,
        hasFinalPayload,
        keys: typeof body === 'object' && body ? Object.keys(body as Record<string, unknown>) : [],
      } } as unknown as Record<string, unknown>);
    } catch {}

    // Terminal: "failed"-Phase immer sofort abbrechen
    if (!hasFinalPayload && !hasError && phase === 'failed') {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', message: phase });
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), error: { message: phase || 'Worker meldete failed' } }); } catch {}
      // gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_failed_phase', message: phase || 'Worker meldete failed' } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: phase || 'failed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed_phase' });
    }

    if (short) return NextResponse.json(short.body, { status: short.status })

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: (body as { error?: unknown })?.error });
      // Bei Fehler: gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: ((body as { error?: unknown })?.error || {}) as Record<string, unknown> } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: (body as { error?: { message?: string } })?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = (body?.data as { extracted_text?: unknown })?.extracted_text as string | undefined;
    const imagesArchiveUrlFromWorker: string | undefined = (body?.data as { images_archive_url?: unknown })?.images_archive_url as string | undefined;

    if (!extractedText && !imagesArchiveUrlFromWorker && body?.phase !== 'template_completed') {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Phasen-Flags aus Parametern lesen (zur harten Deaktivierung von Teilphasen)
    const phasesParam = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { template?: boolean; ingest?: boolean } }).phases : undefined;
    const templatePhaseEnabled = phasesParam?.template !== false;
    const ingestPhaseEnabled = phasesParam?.ingest !== false;
    const imagesPhaseEnabled = (job.parameters && typeof job.parameters === 'object' && (job.parameters as { phases?: { images?: boolean } }).phases) ? ((job.parameters as { phases?: { images?: boolean } }).phases!.images !== false) : true

    // Kurzschluss: Extract‑Only (Template und Ingest deaktiviert)
    if (!templatePhaseEnabled && !ingestPhaseEnabled) {
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'phase_disabled' } }); } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'phase_disabled' } }); } catch {}

      // Falls möglich: Shadow‑Twin direkt speichern, damit Datei im Zielordner erscheint
      let savedItemId: string | undefined
      try {
        if (extractedText) {
          const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
          const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
          const uniqueName = `${baseName}.${lang}.md`
          const parentId = job.correlation?.source?.parentId || 'root'
          const { createMarkdownWithFrontmatter } = await import('@/lib/markdown/compose')
          const ssotFlat: Record<string, unknown> = {
            job_id: jobId,
            source_file: job.correlation.source?.name || baseName,
            extract_status: 'completed',
            template_status: 'skipped',
            summary_language: lang,
          }
          const markdown = createMarkdownWithFrontmatter(extractedText, ssotFlat)
          const saved = await saveMarkdown({ ctx, parentId, fileName: uniqueName, markdown })
          savedItemId = saved.savedItemId
        }
      } catch {}

      // Extract-Phase sauber abschließen
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date() }) } catch {}
      try { await repo.traceEndSpan(jobId, 'extract', 'completed', {}) } catch {}

      await repo.setStatus(jobId, 'completed');
      clearWatchdog(jobId);
      await repo.setResult(jobId, {
        extracted_text: extractedText,
        images_archive_url: imagesArchiveUrlFromWorker || undefined,
        metadata: (body?.data as { metadata?: unknown })?.metadata as Record<string, unknown> | undefined,
      }, { savedItemId, savedItems: savedItemId ? [savedItemId] : [] });
      await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract only: phases disabled)' } as unknown as Record<string, unknown>);
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'extract_only', savedItemId });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'callback_before_library' }) } catch {}

    let savedItemId: string | undefined;
    const savedItems: string[] = [];
    let docMetaForIngestion: Record<string, unknown> | undefined;

    // Schrittstatus extract_pdf auf completed setzen, sobald OCR-Ergebnis vorliegt
    // WICHTIG: nicht überschreiben, wenn bereits zuvor (z. B. im Retry-Gate) als completed markiert
    if (extractedText) {
      try {
        const latest = await repo.get(jobId)
        const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'extract_pdf') : undefined
        const alreadyCompleted = !!st && st.status === 'completed'
        if (!alreadyCompleted) await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date() })
      } catch {}
    }

    if (lib) {
      // NEU: PreProcessAnalyzer – bestimmt vorhandene Artefakte und FM-Qualität
      // PreProcess als eigener Span zur besseren Übersicht – nur wenn noch nicht gelaufen
      let pre: Awaited<ReturnType<typeof preprocess>> | null = null
      let hasPreSpan = false
      try {
        const latest = await repo.get(jobId)
        const spans = (latest as unknown as { trace?: { spans?: Array<{ spanId?: string }> } })?.trace?.spans || []
        hasPreSpan = Array.isArray(spans) && spans.some(s => (s?.spanId || '') === 'preprocess')
      } catch {}
      if (!hasPreSpan) {
        try { await repo.traceStartSpan(jobId, { spanId: 'preprocess', parentSpanId: 'job', name: 'preprocess' }) } catch {}
        pre = await preprocess(ctx)
        try { await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'preprocess_summary', attributes: { hasMarkdown: pre.hasMarkdown, hasFrontmatter: pre.hasFrontmatter, frontmatterValid: pre.frontmatterValid } }) } catch {}
        try { await repo.traceEndSpan(jobId, 'preprocess', 'completed', {}) } catch {}
      }
      const policies = readPhasesAndPolicies(ctx);
      const autoSkip = true;

      if (lib) {
        // Einheitliche Serverinitialisierung des Providers (DB-Config, Token enthalten)
        const provider = await buildProvider({ userEmail: job.userEmail, libraryId: job.libraryId, jobId, repo })

        const targetParentId = job.correlation?.source?.parentId || 'root';

        // Optionale Template-Verarbeitung (Phase 2)
        let metadataFromTemplate: Record<string, unknown> | null = null;
        let templateStatus: 'completed' | 'failed' | 'skipped' = 'completed';
        let templateSkipped = false;
        let templateCompletedMarked = false;
        // Gate für Transform-Template (Phase 2)
        let templateGateExists = false;
        // NEU: Frontmatter-Vollständigkeit aus Callback/Body als primäres Gate verwenden
        const fmFromBodyUnknown = (body?.data?.metadata as unknown) || null;
        const fmFromBody = (fmFromBodyUnknown && typeof fmFromBodyUnknown === 'object' && !Array.isArray(fmFromBodyUnknown)) ? (fmFromBodyUnknown as Record<string, unknown>) : null;
        const hasChaptersInBody = Array.isArray((fmFromBody as { chapters?: unknown })?.chapters) && ((fmFromBody as { chapters: unknown[] }).chapters as unknown[]).length > 0;
        const pagesRawInBody = (fmFromBody as { pages?: unknown })?.pages as unknown;
        const pagesNumInBody = typeof pagesRawInBody === 'number' ? pagesRawInBody : (typeof pagesRawInBody === 'string' ? Number(pagesRawInBody) : NaN);
        const isFrontmatterCompleteFromBody = !!fmFromBody && hasChaptersInBody && Number.isFinite(pagesNumInBody) && (pagesNumInBody as number) > 0;
        const bodyPhaseStr = typeof (body as { phase?: unknown })?.phase === 'string' ? String((body as { phase?: unknown }).phase) : ''
        const isTemplateCompletedCallback = bodyPhaseStr === 'template_completed'
        if (isFrontmatterCompleteFromBody && policies.metadata !== 'force' && !isTemplateCompletedCallback) {
          templateGateExists = true;
          bufferLog(jobId, { phase: 'transform_gate_skip', message: 'frontmatter_complete_body' });
        }

        // Reparatur-Erkennung erfolgt in decideTemplateRun; lokale Probe entfernt
        // Entscheidung modular treffen (inkl. Gate/Repair-Probe/Logging)
        const decision = await decideTemplateRun({
          ctx,
          policies,
              isFrontmatterCompleteFromBody,
          templateGateExists,
          autoSkip,
          isTemplateCompletedCallback,
          // Vereinfachung: Preprocess-Ergebnis als primärer Trigger
          // @ts-expect-error - zusätzliche Info, interne Nutzung
          preNeedTemplate: ((): boolean => {
            if (policies.metadata === 'force') return true
            if (policies.metadata === 'skip') return false
            if (pre && typeof pre.frontmatterValid === 'boolean') return !pre.frontmatterValid
            return !isFrontmatterCompleteFromBody
          })(),
        })
        const shouldRunTemplate = decision.shouldRun
        if (!shouldRunTemplate) {
          bufferLog(jobId, { phase: 'transform_meta_skipped', message: 'Template-Transformation übersprungen (Phase 1)' });
          // Sichtbares Step-/Trace-Update für UI/Monitoring – nur wenn noch KEIN Template-Span existiert
          let hasTemplateSpan = false;
          try {
            const latest = await repo.get(jobId)
            const spans = (latest as unknown as { trace?: { spans?: Array<{ spanId?: string }> } })?.trace?.spans || []
            hasTemplateSpan = Array.isArray(spans) && spans.some(s => (s?.spanId || '') === 'template')
          } catch {}
          if (!hasTemplateSpan) {
            const callbackReceivedAt = new Date();
            try { await repo.traceStartSpan(jobId, { spanId: 'template', parentSpanId: 'job', name: 'transform_template', startedAt: callbackReceivedAt }); } catch {}
            try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'transform_gate_skip', attributes: { message: 'frontmatter_complete_body' } }); } catch {}
            try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'transform_meta_skipped', attributes: { reason: 'frontmatter_complete_body' } }); } catch {}
            try { await repo.traceEndSpan(jobId, 'template', 'skipped', { reason: 'frontmatter_complete_body' }); } catch {}
            // Step-Markierung nur im reinen Skip-Fall
            try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'frontmatter_complete_body' } }); } catch {}
          }
          // SSOT: bereits geliefertes Frontmatter direkt übernehmen
          try {
            if (fmFromBody) {
              docMetaForIngestion = { ...fmFromBody } as Record<string, unknown>
              await repo.appendMeta(jobId, docMetaForIngestion, 'template_transform')
            }
          } catch {}
          templateSkipped = true;
        } else {
          // Idempotenz: Bereits abgeschlossenen Step nicht erneut ausführen (außer 'force')
          let templateAlreadyCompleted = false;
          try {
            const latest = await repo.get(jobId);
            const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'transform_template') : undefined;
            templateAlreadyCompleted = !!st && st.status === 'completed';
          } catch {}
          if (templateAlreadyCompleted && policies.metadata !== 'force') {
            // Kein Completed-Event mehr erzeugen; späterer Flow setzt completed nach Speichern
            bufferLog(jobId, { phase: 'transform_gate_skip', message: 'already_completed' });
            templateStatus = 'skipped';
          } else {
            try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_step_start' }) } catch {}
            await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
            try {
            // Templates wählen via Modul
            const { pickTemplate } = await import('@/lib/external-jobs/template-files')
              const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
            const picked = await pickTemplate({ provider, repo, jobId, preferredTemplateName: preferredTemplate })
            if (picked?.templateContent) {
              const templateContent = picked.templateContent
              await repo.appendMeta(jobId, { template_used: picked.templateName }, 'template_pick');

              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              const tr = await runTemplateTransform({ ctx, extractedText: extractedText || '', templateContent, targetLanguage: lang })
              metadataFromTemplate = tr.meta as unknown as Record<string, unknown> | null
              if (metadataFromTemplate) bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' })
              else { bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' }); templateStatus = 'failed' }
              try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_step_after_transform', attributes: { hasMeta: !!metadataFromTemplate } }) } catch {}
            }
          } catch(err) {
            console.error(err);
            bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler') });
            templateStatus = 'failed';
          }
          }
        }

        // Frontmatter bestimmen (bestehendes FM als Basis, nur Kapitel-Seiten reparieren)
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };
        if (!templateSkipped) {
          docMetaForIngestion = finalMeta;
          await repo.appendMeta(jobId, finalMeta, 'template_transform');
        }
        // WICHTIG: Completion erst NACH dem Speichern (siehe unten)
        if (templateStatus === 'failed') {
          await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date() });
        }

        // Fatal: Wenn Template-Transformation gestartet wurde, aber fehlgeschlagen ist, abbrechen
        if (templateStatus === 'failed') {
          clearWatchdog(jobId);
          bufferLog(jobId, { phase: 'failed', message: 'Template-Transformation fehlgeschlagen (fatal)' });
          // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
          void drainBufferedLogs(jobId);
          await repo.setStatus(jobId, 'failed', { error: { code: 'template_failed', message: 'Template-Transformation fehlgeschlagen' } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Template-Transformation fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'ok', jobId, kind: 'failed_template' });
        }

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        // SSOT: Flache, UI-taugliche Metafelder ergänzen (nur auf stabilem Meilenstein)
        const ssotFlat: Record<string, unknown> = {
          job_id: jobId,
          source_file: job.correlation.source?.name || baseName,
          extract_status: 'completed',
          template_status: templateStatus,
        };
        // optionale Summary-Werte aus bereits vorhandenen Metadaten übernehmen, wenn vorhanden
        if (typeof (finalMeta as Record<string, unknown>)['summary_pages'] === 'number') ssotFlat['summary_pages'] = (finalMeta as Record<string, unknown>)['summary_pages'];
        if (typeof (finalMeta as Record<string, unknown>)['summary_chunks'] === 'number') ssotFlat['summary_chunks'] = (finalMeta as Record<string, unknown>)['summary_chunks'];
        ssotFlat['summary_language'] = lang;

        // Kapitel zentral normalisieren (Analyze-Endpoint), Ergebnis in Frontmatter mergen
        // Bestehendes Frontmatter laden (falls Datei existiert) und als Basis verwenden
        let existingMeta: Record<string, unknown> | null = null;
        try {
          const siblings = await provider.listItemsById(targetParentId);
          const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string } | undefined;
          if (existing) {
            const bin = await provider.getBinary(existing.id);
            const text = await bin.blob.text();
            const parsed = parseSecretaryMarkdownStrict(text);
            existingMeta = parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta as Record<string, unknown> : null;
          }
        } catch {}
        // Basis-Merge: bevorzugt Template-Felder, aber Kapitel stammen standardmäßig aus bestehendem Frontmatter
        const existingChaptersPref: unknown = existingMeta && typeof existingMeta === 'object' ? (existingMeta as Record<string, unknown>)['chapters'] : undefined
        const templateChaptersPref: unknown = finalMeta && typeof finalMeta === 'object' ? (finalMeta as Record<string, unknown>)['chapters'] : undefined
        const initialChapters: Array<Record<string, unknown>> | undefined = Array.isArray(existingChaptersPref)
          ? existingChaptersPref as Array<Record<string, unknown>>
          : (Array.isArray(templateChaptersPref) ? templateChaptersPref as Array<Record<string, unknown>> : undefined)
        let mergedMeta = { ...(existingMeta || {}), ...finalMeta, ...ssotFlat } as Record<string, unknown>
        if (initialChapters) (mergedMeta as { chapters: Array<Record<string, unknown>> }).chapters = initialChapters
        // Quelle für die Kapitelanalyse: bevorzugt frisch geliefertes extractedText, sonst Shadow‑Twin aus Storage
        let textSource: string = extractedText || ''
        if (!textSource) {
          try {
            const siblings = await provider.listItemsById(targetParentId)
            const existing = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === uniqueName) as { id: string } | undefined
            if (existing) {
              const bin = await provider.getBinary(existing.id)
              textSource = await bin.blob.text()
            }
          } catch { /* ignore */ }
        }
        if (!templateSkipped) {
          // Helper: Frontmatter entfernen
            const textForAnalysis = stripAllFrontmatter(textSource)
            const existingChaptersUnknownForApi = (mergedMeta as { chapters?: unknown }).chapters
            const chaptersInForApi: Array<Record<string, unknown>> | undefined = Array.isArray(existingChaptersUnknownForApi) ? existingChaptersUnknownForApi as Array<Record<string, unknown>> : undefined
          const chaptersRes = await analyzeAndMergeChapters({ ctx, baseMeta: mergedMeta as unknown as import('@/types/external-jobs').Frontmatter, textForAnalysis, existingChapters: chaptersInForApi as unknown as import('@/types/external-jobs').ChapterMeta[] })
          mergedMeta = chaptersRes.mergedMeta as unknown as Record<string, unknown>
        }

        // WICHTIG: Ingestion muss mit den final normalisierten Metadaten arbeiten
        docMetaForIngestion = mergedMeta

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

        // Doppelte Frontmatter vermeiden: bestehenden Block am Anfang entfernen (auch mehrfach)
        if (!templateSkipped) {
          const bodyOnly = ((): string => {
            return stripAllFrontmatter(textSource)
          })()
          const { createMarkdownWithFrontmatter } = await import('@/lib/markdown/compose')
          const markdown = createMarkdownWithFrontmatter(bodyOnly, mergedMeta)
          // Zielordner prüfen
          try { await provider.getPathById(targetParentId) }
          catch {
            bufferLog(jobId, { phase: 'store_folder_missing', message: 'Zielordner nicht gefunden' })
            await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: 'Zielordner nicht gefunden (store)' } })
            await repo.setStatus(jobId, 'failed', { error: { code: 'STORE_FOLDER_NOT_FOUND', message: 'Zielordner nicht gefunden' } })
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'store_folder_missing', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
            return NextResponse.json({ status: 'error', jobId, kind: 'store_folder_missing' }, { status: 500 })
          }
          // Speichern via Modul
          const saved = await saveMarkdown({ ctx, parentId: targetParentId, fileName: uniqueName, markdown })
          savedItemId = saved.savedItemId
        try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'postprocessing_saved', attributes: { savedItemId } }) } catch {}
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

        // Entfernt: frühes Doc‑Meta‑Upsert. Doc‑Meta wird erst am Ende der Ingestion final geschrieben.

        // Bilder-ZIP optional verarbeiten (modular)
        if (imagesArchiveUrlFromWorker && imagesPhaseEnabled) {
          try {
            const imageRes = await maybeProcessImages({ ctx, parentId: targetParentId, imagesZipUrl: imagesArchiveUrlFromWorker, extractedText, lang })
            if (imageRes && Array.isArray(imageRes.savedItemIds)) savedItems.push(...imageRes.savedItemIds)
            try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'images_processed', attributes: { savedItems: savedItems.length } }) } catch {}
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' })
            clearWatchdog(jobId)
            void drainBufferedLogs(jobId)
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } })
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name })
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' })
          }
        }
      }

      // Schritt: ingest_rag (optional automatisiert)
      try {
        const phasesParam = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { ingest?: boolean } }).phases : undefined;
        const hardDisableIngest = phasesParam?.ingest === false;
        if (!hardDisableIngest) {
        // Gate für Ingestion (Phase 3)
        const autoSkip = true;
        let ingestGateExists = false;
        if (autoSkip) {
          const g = await gateIngestRag({
            repo,
            jobId,
            userEmail: job.userEmail,
            library: lib,
            source: job.correlation?.source,
            options: job.correlation?.options as { targetLanguage?: string } | undefined,
            ingestionCheck: async ({ userEmail, libraryId, fileId }: { userEmail: string; libraryId: string; fileId: string }) => {
              // Prüfe Doc‑Vektor existiert (kind:'doc' + fileId)
              try {
                const ctx = await (await import('@/lib/chat/loader')).loadLibraryChatContext(userEmail, libraryId)
                const apiKey = process.env.PINECONE_API_KEY
                if (!ctx || !apiKey) return false
                const idx = await (await import('@/lib/chat/pinecone')).describeIndex(ctx.vectorIndex, apiKey)
                if (!idx?.host) return false
                const list = await (await import('@/lib/chat/pinecone')).listVectors(idx.host, apiKey, { kind: 'doc', user: userEmail, libraryId, fileId })
                return Array.isArray(list) && list.length > 0
              } catch {
                return false
              }
            }
          })
          if (g.exists) {
            ingestGateExists = true;
            await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
                bufferLog(jobId, { phase: 'ingest_gate_skip', message: g.reason || 'artifact_exists' });
            // Wenn geskippt, keinen weiteren Ingestion-Versuch starten
            // dennoch Abschluss unten fortsetzen
          } else {
            await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
                bufferLog(jobId, { phase: 'ingest_gate_plan', message: 'Ingestion wird ausgeführt' });
          }
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
        }
        // fileId ist weiter unten definiert; hier noch nicht verfügbar
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }); } catch {}
        // Kompakte Progress-Events (SSE) für Ingestion
        try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 10, updatedAt: new Date().toISOString(), message: 'ingest_start', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
        const paramsObj = job.parameters && typeof job.parameters === 'object' ? job.parameters as Record<string, unknown> : undefined
        // Neue, einfache Policy: 'do' | 'force' | 'skip'
        const rawPolicy = (paramsObj?.['ingestPolicy'] as unknown)
        const legacyPolicies = paramsObj && typeof paramsObj['policies'] === 'object' ? paramsObj['policies'] as { ingest?: unknown } : undefined
        const legacyPhases = paramsObj && typeof paramsObj['phases'] === 'object' ? paramsObj['phases'] as { ingest?: unknown } : undefined
        const legacyFlag = paramsObj ? (paramsObj['doIngestRAG'] as unknown) : undefined
        const ingestPolicy: 'do' | 'force' | 'skip' = ((): 'do' | 'force' | 'skip' => {
          if (rawPolicy === 'force' || rawPolicy === 'skip' || rawPolicy === 'do') return rawPolicy
          if (legacyPhases?.ingest === false) return 'skip'
          if (legacyPolicies?.ingest === false) return 'skip'
          if (legacyPolicies?.ingest === true || legacyPhases?.ingest === true || (typeof legacyFlag === 'boolean' && legacyFlag)) return 'do'
          return 'do'
        })()
        const useIngestion = ingestPolicy !== 'skip'
        bufferLog(jobId, { phase: 'ingest_rag', message: `Ingestion decision: ${useIngestion ? 'do' : 'skip'}` })
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_decision', attributes: { useIngestion, doIngestRAG: typeof legacyFlag === 'boolean' ? legacyFlag : undefined, policiesIngest: legacyPolicies?.ingest, phasesIngest: legacyPhases?.ingest } }); } catch {}
        if (useIngestion && !ingestGateExists) {
          // Lade gespeicherten Markdown-Inhalt erneut (vereinfachend: extractedText)
          // Stabiler Schlüssel: Original-Quell-Item (PDF) bevorzugen, sonst Shadow‑Twin, sonst Fallback
          const fileId = (job.correlation.source?.itemId as string | undefined) || savedItemId || `${jobId}-md`;
          const fileName = `${(job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')}.${(job.correlation.options?.targetLanguage as string | undefined) || 'de'}.md`;
          // Fallback: Wenn kein extractedText, versuche Markdown aus Storage zu laden
          let markdownForIngestion = extractedText || ''
          if (!markdownForIngestion) {
            try {
              const provider = await getServerProvider(job.userEmail, job.libraryId)
              // Suche Datei im Parent anhand erwarteten Namens
              const parentId = job.correlation.source?.parentId || 'root'
              const siblings = await provider.listItemsById(parentId)
              const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === fileName) as { id: string } | undefined
              if (twin) {
                const bin = await provider.getBinary(twin.id)
                markdownForIngestion = await bin.blob.text()
              }
            } catch {}
          }
          let res
          try {
            res = await runIngestion({ ctx, savedItemId: fileId, fileName, markdown: markdownForIngestion, meta: docMetaForIngestion as unknown as Record<string, unknown> })
          } catch (err) {
            // Ingestion fehlgeschlagen → Step/Job als failed markieren
            const reason = (() => {
              if (err && typeof err === 'object') {
                const e = err as { message?: unknown }
                const msg = typeof e.message === 'string' ? e.message : undefined
                return msg || String(err)
              }
              return String(err)
            })()
            bufferLog(jobId, { phase: 'ingest_rag_failed', message: reason })
            FileLogger.error('external-jobs', 'Ingestion failed (fatal)', err)
            await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'RAG Ingestion fehlgeschlagen', details: { reason } } });
            await repo.setStatus(jobId, 'failed', { error: { code: 'ingestion_failed', message: reason } })
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'ingestion_failed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
            return NextResponse.json({ status: 'error', jobId, kind: 'failed_ingestion', reason }, { status: 500 })
          }
          // Nach Chunking (50-70%)
          try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 60, updatedAt: new Date().toISOString(), message: 'ingest_chunking_done', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
          await repo.setIngestion(jobId, { upsertAt: new Date(), vectorsUpserted: total, index: res.index });
          // Zusammenfassung loggen
          bufferLog(jobId, { phase: 'ingest_rag', message: `RAG-Ingestion: ${res.chunksUpserted} Chunks, ${res.docUpserted ? 1 : 0} Doc` });
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_pinecone_upserted', attributes: { chunks: res.chunksUpserted, doc: res.docUpserted, total, vectorFileId: fileId } }); } catch {}
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_doc_id', attributes: { vectorFileId: fileId, fileName } }); } catch {}
          try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 90, updatedAt: new Date().toISOString(), message: 'ingest_pinecone_upserted', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() });
          try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 95, updatedAt: new Date().toISOString(), message: 'ingest_rag_finished', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
        }
        } // end !hardDisableIngest
      } catch (err) {
        const reason = (() => {
          if (err && typeof err === 'object') {
            const e = err as { message?: unknown }
            const msg = typeof e.message === 'string' ? e.message : undefined
            return msg || String(err)
          }
          return String(err)
        })()
        bufferLog(jobId, { phase: 'ingest_rag_failed', message: reason })
        FileLogger.error('external-jobs', 'Ingestion failed', err)
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'RAG Ingestion fehlgeschlagen', details: { reason } } });
      }

      const completed = await setJobCompleted({ ctx, result: { savedItemId } })
      // @ts-expect-error custom field for UI refresh
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, refreshFolderId: (job.correlation?.source?.parentId || 'root') });
      return NextResponse.json({ status: 'ok', jobId: completed.jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
    }

    // Sollte nicht erreicht werden
    return NextResponse.json({ status: 'ok', jobId, kind: 'noop_final' });
  } catch (err) {
    // Differenzierte Fehlerzuordnung (401/404/409/400)
    const anyErr = err as { code?: unknown; status?: unknown; message?: unknown } | undefined;
    const codeRaw = (anyErr && typeof anyErr.code === 'string') ? anyErr.code : undefined;
    const statusFromErr = (anyErr && typeof anyErr.status === 'number') ? anyErr.status : undefined;
    const status = statusFromErr
      ?? (codeRaw === 'unauthorized' ? 401
      : codeRaw === 'not_found' ? 404
      : codeRaw === 'conflict' ? 409
      : 400);
    const message = (anyErr && typeof anyErr.message === 'string') ? anyErr.message : (status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Invalid payload');
    const code = codeRaw || (status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'invalid_payload');

    try {
      const { jobId } = await params;
      const repo = new ExternalJobsRepository();
      const job = await repo.get(jobId);
      if (job) {
        bufferLog(jobId, { phase: 'failed', message });
        await repo.appendLog(jobId, { phase: 'failed', message, details: { code, status } } as unknown as Record<string, unknown>);
        try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'callback_failed', attributes: { code, status, message } }) } catch {}
        await repo.setStatus(jobId, 'failed', { error: { code, message } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      }
    } catch {
      // ignore secondary failures
    }
    return NextResponse.json({ error: message, code }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Sicherheit: Laufende Jobs nicht löschen
    if (job.status === 'running') return NextResponse.json({ error: 'Job läuft noch' }, { status: 409 });

    const ok = await repo.delete(jobId);
    if (!ok) return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 });
    return NextResponse.json({ status: 'deleted', jobId });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


