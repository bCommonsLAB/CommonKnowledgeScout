import { NextRequest, NextResponse } from 'next/server';
import type { RequestContext } from '@/types/external-jobs'
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateExtractPdf } from '@/lib/processing/gates';
import { getPolicies, shouldRunExtract } from '@/lib/processing/phase-policy';
import { LibraryService } from '@/lib/services/library-service';
import { getServerProvider } from '@/lib/storage/server-provider';
import { pickTemplate } from '@/lib/external-jobs/template-files'
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import { FileLogger } from '@/lib/debug/logger';
import { callPdfProcess } from '@/lib/secretary/adapter';
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Interner Bypass für Worker-Aufrufe
    const internalBypass = (() => {
      const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token');
      const envToken = process.env.INTERNAL_TEST_TOKEN || '';
      if (!!t && !!envToken && t === envToken) return true;
      const workerHdr = request.headers.get('x-worker') || request.headers.get('X-Worker');
      if (workerHdr === 'true') return true;
      return false;
    })();

    const { userId } = getAuth(request);
    const workerId = request.headers.get('x-worker-id') || request.headers.get('X-Worker-Id') || undefined;
    if (!internalBypass && !userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = internalBypass ? null : await currentUser();
    const requestedUserEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    const userEmail = internalBypass ? job.userEmail : requestedUserEmail;
    if (!internalBypass && job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status === 'running') {
      if (!internalBypass) {
        await repo.appendLog(jobId, { phase: 'requeue_blocked_already_active', message: `Status=${job.status}` } as unknown as Record<string, unknown>);
        return NextResponse.json({ error: 'Job bereits aktiv' }, { status: 409 });
      }
      try { await repo.traceAddEvent(jobId, { name: 'already_running_continue_internal', attributes: { workerId } }); } catch {}
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    try { await repo.traceAddEvent(jobId, { name: 'build_provider_start', attributes: { libraryId, userEmail, workerId } }); } catch {}
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });
    try { await repo.traceAddEvent(jobId, { name: 'build_formdata', attributes: { filename, mime: source.mimeType || bin.mimeType, workerId } }); } catch {}

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    // Markiere Job sofort als running und die erste Phase als running
    await repo.setStatus(jobId, 'running', { jobSecretHash: newHash });
    try { await repo.initializeTrace(jobId); await repo.traceAddEvent(jobId, { name: 'retry_start' }); } catch {}
    await repo.updateStep(jobId, 'extract_pdf', { status: 'running', startedAt: new Date() });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    try { await repo.traceAddEvent(jobId, { name: 'requeue_started', attributes: { callbackUrl, workerId } }); } catch {}
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 0, updatedAt: new Date().toISOString(), message: 'started', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Policies laden
    const policies = getPolicies({ parameters: job.parameters || {} });

    // Optional: Extract-Gate prüfen und ggf. lokal Template‑Only fahren
    try {
      const libraryService = LibraryService.getInstance();
      const libraries = await libraryService.getUserLibraries(userEmail);
      const lib = libraries.find(l => l.id === libraryId);
      const g = await gateExtractPdf({ repo, jobId, userEmail, library: lib, source, options: { targetLanguage: String(serviceFormData.get('target_language') || 'de') } });
      const runExtract = shouldRunExtract(g.exists, policies.extract);
      await repo.appendLog(jobId, { phase: 'retry_template_gate', details: { runExtract, gateExists: g.exists, gateReason: g.reason || null, policies, sourceName: source.name, parentId: source.parentId } } as unknown as Record<string, unknown>);
      if (!runExtract) {
        // Phase 1 überspringen → Schritte markieren
        await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.exists ? (g.reason || 'artifact_exists') : 'policy_ignore' } });

        // Template-Only Pfad ausführen, falls Policy es verlangt
        if (policies.metadata !== 'ignore') {
          // Idempotenz-Gate für Template: Shadow‑Twin laden und Frontmatter prüfen
          try {
            const siblings = await provider.listItemsById(source.parentId);
            const targetLanguage = String(serviceFormData.get('target_language') || 'de');
            const base = (source.name || 'output').replace(/\.[^/.]+$/, '');
            const expectedName = `${base}.${targetLanguage}.md`;
            const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName) as { id: string } | undefined;
            if (twin) {
              const twinBin = await provider.getBinary(twin.id);
              const originalMarkdown = await twinBin.blob.text();
              const parsed = parseSecretaryMarkdownStrict(originalMarkdown);
              const meta = parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta as Record<string, unknown> : {};
              const hasChapters = Array.isArray((meta as { chapters?: unknown }).chapters) && ((meta as { chapters: unknown[] }).chapters as unknown[]).length > 0;
              const pagesRaw = (meta as { pages?: unknown }).pages as unknown;
              const pagesNum = typeof pagesRaw === 'number' ? pagesRaw : (typeof pagesRaw === 'string' ? Number(pagesRaw) : NaN);
              const hasPages = Number.isFinite(pagesNum) && (pagesNum as number) > 0;
              const isComplete = hasChapters && hasPages;
              await repo.appendLog(jobId, { phase: 'retry_template_idempotency', details: { foundTwin: true, expectedName, hasChapters, hasPages, pagesRaw: pagesRaw ?? null, isComplete } } as unknown as Record<string, unknown>);
              if (isComplete && policies.metadata !== 'force') {
                // Kein vorzeitiges Completed – nur Gate-Info loggen
                await repo.appendLog(jobId, { phase: 'transform_gate_skip', message: 'frontmatter_complete' } as unknown as Record<string, unknown>);
                // Interner Callback mit vorhandenem Markdown, um zentrale Ingestion zu starten
                try {
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
                  if (internalToken) headers['X-Internal-Token'] = internalToken;
                  const callbackUrl = `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/external/jobs/${jobId}`;
                  const payload = { phase: 'template_completed', data: { extracted_text: originalMarkdown, metadata: meta, file_name: expectedName, parent_id: source.parentId } } as const;
                  await repo.appendLog(jobId, { phase: 'retry_internal_callback', details: { url: callbackUrl, hasToken: !!internalToken, bodyPreview: JSON.stringify(payload).slice(0, 512) } } as unknown as Record<string, unknown>);
                  const cbResp = await fetch(callbackUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
                  await repo.appendLog(jobId, { phase: 'retry_internal_callback_result', details: { status: cbResp.status, statusText: cbResp.statusText } } as unknown as Record<string, unknown>);
                } catch (e) {
                  await repo.appendLog(jobId, { phase: 'retry_internal_callback_error', details: { error: e instanceof Error ? e.message : String(e) } } as unknown as Record<string, unknown>);
                }
                return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true, template: true }, mode: 'template_skip' });
              }
            } else {
              await repo.appendLog(jobId, { phase: 'retry_template_idempotency', details: { foundTwin: false, expectedName } } as unknown as Record<string, unknown>);
            }
          } catch { /* ignore idempotency gate errors */ }

          await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
          // Kompaktes Live-Logging + SSE
          await repo.appendLog(jobId, { phase: 'initializing', progress: 5, message: 'Job initialisiert' });
          try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 5, updatedAt: new Date().toISOString(), message: 'initializing', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          await repo.appendLog(jobId, { phase: 'transform_template', progress: 10, message: 'Template-Transformation gestartet' });
          await repo.appendLog(jobId, { phase: 'retry_template_run_start', details: { reason: 'policy_do', hasTwin: true, templatePolicy: policies.metadata, expectedLanguage: String(serviceFormData.get('target_language') || 'de') } } as unknown as Record<string, unknown>);
          try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 10, updatedAt: new Date().toISOString(), message: 'transform_template', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          try {
            // Template bestimmen (modular)
            const libraries = await LibraryService.getInstance().getUserLibraries(userEmail);
            const lib = libraries.find(l => l.id === libraryId);
            const preferredTemplate = ((lib?.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || 'pdfanalyse').trim();
            const { templateContent } = await pickTemplate({ provider, repo, jobId, preferredTemplateName: preferredTemplate })
            // Shadow‑Twin finden und laden
            const siblings = await provider.listItemsById(source.parentId);
            const targetLanguage = String(serviceFormData.get('target_language') || 'de');
            const base = (source.name || 'output').replace(/\.[^/.]+$/, '');
            const expectedName = `${base}.${targetLanguage}.md`;
            const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName) as { id: string } | undefined;
            if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
            const twinBin = await provider.getBinary(twin.id);
            const originalMarkdown = await twinBin.blob.text();
            const stripped = stripAllFrontmatter(originalMarkdown)
            // Secretary Transformer via Modul
            const { runTemplateTransform } = await import('@/lib/external-jobs/template-run')
            const ctxForRun: RequestContext = { request, jobId, job, body: {}, internalBypass: true }
            const tr = await runTemplateTransform({ ctx: ctxForRun, extractedText: stripped, templateContent, targetLanguage })
            const mdMetaLocal: Record<string, unknown> = (tr.meta || {}) as Record<string, unknown>
            await repo.appendMeta(jobId, mdMetaLocal, 'template_transform');
            const metaKeysCount = Object.keys(mdMetaLocal || {}).length;
            await repo.appendLog(jobId, { phase: 'transform_meta_completed', progress: 90, message: `Template-Transformation abgeschlossen (${metaKeysCount} Schlüssel)` });
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 90, updatedAt: new Date().toISOString(), message: 'transform_meta_completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
            // Markdown neu zusammensetzen (modular)
            const mergedMeta = { ...(mdMetaLocal || {}), job_id: jobId, source_file: source.name || 'document.pdf', extract_status: 'completed', template_status: 'completed', summary_language: targetLanguage }
            const newMarkdown = createMarkdownWithFrontmatter(originalMarkdown, mergedMeta)
            // Interner Callback an zentralen Handler, um Ingestion zu starten
            try {
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
              if (internalToken) headers['X-Internal-Token'] = internalToken;
              const callbackUrl = `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/external/jobs/${jobId}`;
              const payload = { phase: 'template_completed', data: { extracted_text: newMarkdown, metadata: mergedMeta, file_name: expectedName, parent_id: source.parentId } } as const;
              await repo.appendLog(jobId, { phase: 'retry_internal_callback', details: { url: callbackUrl, hasToken: !!internalToken, bodyPreview: JSON.stringify(payload).slice(0, 512) } } as unknown as Record<string, unknown>);
              const cbResp = await fetch(callbackUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
              await repo.appendLog(jobId, { phase: 'retry_internal_callback_result', details: { status: cbResp.status, statusText: cbResp.statusText } } as unknown as Record<string, unknown>);
            } catch (e) {
              await repo.appendLog(jobId, { phase: 'retry_internal_callback_error', details: { error: e instanceof Error ? e.message : String(e) } } as unknown as Record<string, unknown>);
            }
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 98, updatedAt: new Date().toISOString(), message: 'stored_local', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
            // Doc‑Meta Upsert entfällt hier – erfolgt zentral im Callback/Ingester
          } catch (err) {
            await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: err instanceof Error ? err.message : String(err) } });
            await repo.setStatus(jobId, 'failed');
            return NextResponse.json({ error: 'template_only_failed' }, { status: 500 });
          }
        } else {
          await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          // Ingestion für diesen Use-Case ebenfalls überspringen
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          // Job abschließen (keine weiteren Phasen)
          await repo.setStatus(jobId, 'completed');
          clearWatchdog(jobId);
          await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract only)' } as unknown as Record<string, unknown>);
          try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true, template: true, ingest: true }, mode: 'extract_only' });
        }
        // Hinweis: Interner Callback erfolgt im Template-Only Block (siehe oben)
        return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true }, mode: 'template_only' });
      }
    } catch {
      // Falls Gate fehlschlägt, wird normal extrahiert
    }

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    // Zusätzliche Parameter für Audit/Debug
    const px = (job.parameters || {}) as Record<string, unknown>;
    const attrsPdf: Record<string, unknown> = {
      url: normalizedUrl,
      method: 'POST',
      workerId,
      extractionMethod: px['extractionMethod'] ?? job.correlation?.options?.extractionMethod ?? undefined,
      targetLanguage: px['targetLanguage'] ?? job.correlation?.options?.targetLanguage ?? undefined,
      useCache: px['useCache'] ?? job.correlation?.options?.useCache ?? undefined,
      includeImages: px['includeImages'] ?? job.correlation?.options?.includeImages ?? undefined,
      template: px['template'] ?? undefined,
      fileName: job.correlation?.source?.name,
      libraryId,
    };
    try { await repo.traceAddEvent(jobId, { spanId: 'extract', name: 'secretary_request_start', attributes: attrsPdf }); } catch {}
    let response: Response;
    try {
      response = await callPdfProcess({ url: normalizedUrl, formData: serviceFormData, apiKey: process.env.SECRETARY_SERVICE_API_KEY, timeoutMs: Number(process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 15000) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      FileLogger.error('external-jobs-retry', 'secretary_request_error', { jobId, message });
      try { await repo.traceAddEvent(jobId, { spanId: 'extract', name: 'extract_failed_network', level: 'error', attributes: { error: message } }); } catch {}
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    try { await repo.traceAddEvent(jobId, { spanId: 'extract', name: 'secretary_request_ack', attributes: { status: response.status, statusText: response.statusText, workerId } }); } catch {}
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    try { await repo.traceAddEvent(jobId, { spanId: 'extract', name: 'secretary_request_accepted', attributes: { status: response.status, workerId } }); } catch {}
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}


