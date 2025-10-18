import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
// import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { IngestionService } from '@/lib/chat/ingestion-service';
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser';
import { callTemplateTransform } from '@/lib/secretary/adapter';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateTransformTemplate, gateIngestRag } from '@/lib/processing/gates';
import { getPolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { getServerProvider } from '@/lib/storage/server-provider';
// parseSecretaryMarkdownStrict ungenutzt entfernt

// OneDrive-Utilities entfernt: Provider übernimmt Token/Uploads.

function toAsciiKebab(input: unknown, maxLen: number = 80): string | undefined {
  if (typeof input !== 'string') return undefined;
  const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  const replaced = input
    .trim()
    .toLowerCase()
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  const cut = replaced.slice(0, maxLen).replace(/-+$/g, '');
  return cut || undefined;
}

function splitToArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const arr = value
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  if (typeof value === 'string') {
    const arr = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  return undefined;
}

function normalizeStructuredData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...r };

  // shortTitle variants
  const shortTitleCandidate = (r['shortTitle'] ?? r['shortTitel'] ?? r['shortTitlel']) as unknown;
  if (typeof shortTitleCandidate === 'string') {
    const cleaned = shortTitleCandidate.replace(/[.!?]+$/g, '').trim();
    out['shortTitle'] = cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }
  delete out['shortTitel'];
  delete out['shortTitlel'];

  // slug normalization
  const slug = toAsciiKebab(r['slug']);
  if (slug) out['slug'] = slug;

  // authors and tags arrays
  const authors = splitToArray(r['authors']);
  if (authors) out['authors'] = authors;
  const tags = splitToArray(r['tags']);
  if (tags) {
    const norm = tags
      .map(t => toAsciiKebab(t, 80) || '')
      .filter(Boolean) as string[];
    out['tags'] = Array.from(new Set(norm));
  }

  // year number
  const yearVal = r['year'];
  if (typeof yearVal === 'string' && /^\d{4}$/.test(yearVal)) out['year'] = Number(yearVal);

  return out;
}

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
    const workerId = request.headers.get('x-worker-id') || request.headers.get('X-Worker-Id') || undefined;
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const body = await request.json();

    // Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
    let callbackToken: string | undefined = body?.callback_token;
    if (!callbackToken) {
      const headerToken = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token');
      if (headerToken) callbackToken = headerToken;
    }
    if (!callbackToken) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) callbackToken = authHeader.substring('Bearer '.length);
    }
    const internalBypass = (() => {
      const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token');
      const envToken = process.env.INTERNAL_TEST_TOKEN || '';
      return !!t && !!envToken && t === envToken;
    })();
    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (!callbackToken && !internalBypass) {
      const incomingProcessId = (body?.process && typeof body.process.id === 'string') ? body.process.id : (typeof body?.data?.processId === 'string' ? body.data.processId : undefined);
      bufferLog(jobId, { phase: 'unauthorized_callback', message: 'callback_token fehlt', details: { incomingProcessId, reason: 'missing' } });
      await repo.appendLog(jobId, { phase: 'unauthorized_callback', message: 'callback_token fehlt', details: { incomingProcessId, reason: 'missing' } } as unknown as Record<string, unknown>);
      return NextResponse.json({ error: 'callback_token fehlt' }, { status: 401 });
    }

    if (!internalBypass) {
      const tokenHash = repo.hashSecret(callbackToken as string);
      if (tokenHash !== job.jobSecretHash) {
        const incomingProcessId = (body?.process && typeof body.process.id === 'string') ? body.process.id : (typeof body?.data?.processId === 'string' ? body.data.processId : undefined);
        const safe = (s?: string) => (s ? s.slice(0, 12) : undefined);
        bufferLog(jobId, { phase: 'unauthorized_callback', message: 'Unauthorized callback', details: { incomingProcessId, reason: 'hash_mismatch', expected: safe(job.jobSecretHash), got: safe(tokenHash) } });
        await repo.appendLog(jobId, { phase: 'unauthorized_callback', message: 'Unauthorized callback', details: { incomingProcessId, reason: 'hash_mismatch', expected: safe(job.jobSecretHash), got: safe(tokenHash) } } as unknown as Record<string, unknown>);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    try { await repo.traceAddEvent(jobId, { name: 'callback_received', attributes: { keys: Object.keys(body || {}), hasData: !!body?.data, hasProcess: !!body?.process, workerId } }); } catch {}
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);
    // Prozess‑Guard: Nur Events mit übereinstimmender processId akzeptieren (außer interner Bypass/Template-Callback)
    try {
      const incomingProcessId: string | undefined = (body?.process && typeof body.process.id === 'string') ? body.process.id : (typeof body?.data?.processId === 'string' ? body.data.processId : undefined);
      if (!internalBypass && job.processId && incomingProcessId && incomingProcessId !== job.processId) {
        try { await repo.traceAddEvent(jobId, { name: 'ignored_mismatched_process', level: 'warn', attributes: { incomingProcessId, jobProcessId: job.processId } }); } catch {}
        return NextResponse.json({ status: 'ignored', reason: 'mismatched_process' });
      }
    } catch {}

    // Progress-Handling
    const progressValue = typeof body?.progress === 'number'
      ? body.progress
      : typeof body?.data?.progress === 'number'
        ? body.data.progress
        : typeof body?.percent === 'number'
          ? body.percent
          : typeof body?.data?.percent === 'number'
            ? body.data.percent
            : undefined;
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof body?.data?.phase === 'string' && body.data.phase) || undefined;
    const message = (typeof body?.message === 'string' && body.message) || (typeof body?.data?.message === 'string' && body.data.message) || undefined;

    const hasError = !!body?.error;
    // Erweiterung: template_completed liefert extracted_text als Markdown
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed' || body?.phase === 'template_completed');
    // Diagnose: Eingang loggen (minimal, aber ausreichend zur Nachverfolgung)
    try {
      await repo.appendLog(jobId, { phase: 'callback_received', details: {
        internalBypass,
        hasToken: !!callbackToken,
        phaseInBody: body?.phase || body?.data?.phase || null,
        hasFinalPayload,
        keys: typeof body === 'object' && body ? Object.keys(body as Record<string, unknown>) : [],
      } } as unknown as Record<string, unknown>);
      await repo.traceAddEvent(jobId, { name: 'callback_received_detail', attributes: { hasFinalPayload, phase, progress: progressValue, message, workerId } });
    } catch {}

    // Terminal: "failed"-Phase immer sofort abbrechen
    if (!hasFinalPayload && !hasError && phase === 'failed') {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', message });
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), error: { message: message || 'Worker meldete failed' } }); } catch {}
      // gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_failed_phase', message: message || 'Worker meldete failed' } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: message || 'failed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed_phase' });
    }

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      try { await repo.traceAddEvent(jobId, { spanId: 'extract', name: 'progress', attributes: { phase: phase || 'progress', progress: progressValue, message } }); } catch {}
      // Push-Event für UI (SSE)
      getJobEventBus().emitUpdate(job.userEmail, {
        type: 'job_update',
        jobId,
        status: 'running',
        phase: phase || 'progress',
        progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        message,
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
        sourceItemId: job.correlation?.source?.itemId,
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker && body?.phase !== 'template_completed') {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Phasen-Flags aus Parametern lesen (zur harten Deaktivierung von Teilphasen)
    const phasesParam = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { template?: boolean; ingest?: boolean } }).phases : undefined;
    const templatePhaseEnabled = phasesParam?.template !== false;
    const ingestPhaseEnabled = phasesParam?.ingest !== false;

    // Kurzschluss: Extract‑Only (Template und Ingest deaktiviert)
    if (!templatePhaseEnabled && !ingestPhaseEnabled) {
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'phase_disabled' } }); } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'phase_disabled' } }); } catch {}
      await repo.setStatus(jobId, 'completed');
      clearWatchdog(jobId);
      // Ergebnis sichern (nur OCR‑Text, keine gespeicherten Items)
      await repo.setResult(jobId, {
        extracted_text: extractedText,
        images_archive_url: imagesArchiveUrlFromWorker || undefined,
        metadata: body?.data?.metadata,
      }, { savedItemId: undefined, savedItems: [] });
      await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract only: phases disabled)' } as unknown as Record<string, unknown>);
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'extract_only' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];
    let docMetaForIngestion: Record<string, unknown> | undefined;

    // Schrittstatus extract_pdf auf completed setzen, sobald OCR-Ergebnis vorliegt
    if (extractedText) {
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date() }); } catch {}
    }

    if (lib) {
      const policies = getPolicies({ parameters: job.parameters || {} });
      const autoSkip = true;

      if (lib) {
        // Einheitliche Serverinitialisierung des Providers (DB-Config, Token enthalten)
        let provider;
        try {
          provider = await getServerProvider(job.userEmail, job.libraryId);
        } catch (e) {
          const reason = e instanceof Error ? e.message : 'Provider-Initialisierung fehlgeschlagen';
          bufferLog(jobId, { phase: 'provider_init_failed', message: reason });
          await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: reason } });
          await repo.setStatus(jobId, 'failed', { error: { code: 'CONFIG_ERROR', message: reason } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: reason, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'error', jobId, kind: 'provider_init_failed', message: reason }, { status: 400 });
        }

        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';

        // Optionale Template-Verarbeitung (Phase 2)
        let metadataFromTemplate: Record<string, unknown> | null = null;
        let templateStatus: 'completed' | 'failed' | 'skipped' = 'completed';
        // Gate für Transform-Template (Phase 2)
        let templateGateExists = false;
        if (autoSkip) {
          const g = await gateTransformTemplate({ repo, jobId, userEmail: job.userEmail, library: lib, source: job.correlation?.source, options: job.correlation?.options as { targetLanguage?: string } | undefined });
          templateGateExists = g.exists;
          if (g.exists) {
            // Kein vorzeitiges Completed mehr – Completion erfolgt erst nach Speichern
            bufferLog(jobId, { phase: 'transform_gate_skip', message: g.reason || 'artifact_exists' });
          } else {
            bufferLog(jobId, { phase: 'transform_gate_plan', message: 'Template-Transformation wird ausgeführt' });
          }
        }
        const shouldRunTemplate = shouldRunWithGate(templateGateExists, policies.metadata);
        if (!shouldRunTemplate) {
          bufferLog(jobId, { phase: 'transform_meta_skipped', message: 'Template-Transformation übersprungen (Phase 1)' });
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
            await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
            try {
            // Templates-Ordner vorbereiten
            const rootItems = await provider.listItemsById('root');
            const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
            const ensureTemplatesFolderId = async (): Promise<string> => {
              if (templatesFolder) return templatesFolder.id;
              const created = await provider.createFolder('root', 'templates');
              bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
              return created.id;
            };
            const templatesFolderId = await ensureTemplatesFolderId();

            // Template-Datei wählen bzw. anlegen
            let chosen: { id: string } | undefined;
            if (templatesFolderId) {
              const tplItems = await provider.listItemsById(templatesFolderId);
              const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
              const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
              chosen = preferredTemplate
                ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
              try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_selected', attributes: { preferred: preferredTemplate, picked: !!chosen, templateName: (preferredTemplate || ((chosen as unknown as { metadata?: { name?: string } })?.metadata?.name) || 'pdfanalyse.md') } }); } catch {}
              if (!chosen) {
                const defaultTemplateContent = '# {{title}}\n';
                const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
                await provider.uploadFile(templatesFolderId, tplFile);
                bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
                const re = await provider.listItemsById(templatesFolderId);
                chosen = re.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md') as unknown as { id: string } | undefined;
              }
            } else {
              bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
            }

            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              await repo.appendMeta(jobId, { template_used: (chosen as unknown as { metadata?: { name?: string } }).metadata?.name }, 'template_pick');

              // Secretary Transformer aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText || '');
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              // Kontext übergeben (Dateiname/Pfad/Job)
              try {
                const parentId = job.correlation.source?.parentId || 'root';
                const parentPath = await provider.getPathById(parentId); // z.B. /Berichte Landesämter/Bevölk.Schutz
                const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                const rawName = job.correlation.source?.name || 'document.pdf';
                const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
                const baseName = withoutExt.replace(new RegExp(`\\.${lang}$`, 'i'), '');
                const ctx = {
                  filename: baseName,
                  filepath: dirPath,
                  libraryId: job.libraryId,
                  jobId: job.jobId,
                  sourceItemId: job.correlation.source?.itemId,
                  parentId: job.correlation.source?.parentId
                } as const;
                fd.append('context', JSON.stringify(ctx));
              } catch {}
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_request_start', attributes: { url: transformerUrl, method: 'POST', targetLanguage: lang, templateContentLen: templateContent.length } }); } catch {}
              const resp = await callTemplateTransform({ url: transformerUrl, text: extractedText || '', targetLanguage: lang, templateContent, apiKey: process.env.SECRETARY_SERVICE_API_KEY, timeoutMs: Number(process.env.EXTERNAL_TEMPLATE_TIMEOUT_MS || process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 600000) });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                const d = (data as { data?: unknown }).data as { structured_data?: unknown } | undefined;
                const normalized = normalizeStructuredData(d?.structured_data);
                metadataFromTemplate = normalized || null;
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
                templateStatus = 'failed';
              }
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
        docMetaForIngestion = finalMeta;
        await repo.appendMeta(jobId, finalMeta, 'template_transform');
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
        try {
          const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
          const origin = (() => { try { return new URL(request.url).origin } catch { return (process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000') } })();
          // Vorhandene Kapitel (Frontmatter/Template) an den Analyzer mitgeben
          const existingChaptersUnknownForApi = (mergedMeta as { chapters?: unknown }).chapters
          const chaptersInForApi: Array<Record<string, unknown>> | undefined = Array.isArray(existingChaptersUnknownForApi) ? existingChaptersUnknownForApi as Array<Record<string, unknown>> : undefined
          const res = await fetch(`${origin}/api/chat/${encodeURIComponent(job.libraryId)}/analyze-chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-External-Job': jobId, ...(internalToken ? { 'X-Internal-Token': internalToken } : {}) },
            body: JSON.stringify({ fileId: job.correlation?.source?.itemId || job.jobId, content: textSource, mode: 'heuristic', chaptersIn: chaptersInForApi })
          })
          if (res.ok) {
            const data = await res.json().catch(() => ({})) as { result?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>>; stats?: { chapterCount?: number; pages?: number } } }
            const chap = Array.isArray(data?.result?.chapters) ? data!.result!.chapters! : []
            const toc = Array.isArray(data?.result?.toc) ? data!.result!.toc! : []
            const pages = typeof data?.result?.stats?.pages === 'number' ? data!.result!.stats!.pages : undefined
            if (chap.length > 0) {
              // Nur Seitenzahlen in bestehenden Kapiteln reparieren; übrige Felder erhalten; keine zusätzlichen Kapitel hinzufügen
              const existingChaptersUnknown = (mergedMeta as { chapters?: unknown }).chapters
              const existingChapters: Array<Record<string, unknown>> = Array.isArray(existingChaptersUnknown) ? (existingChaptersUnknown as Array<Record<string, unknown>>) : []
              const norm = chap as Array<Record<string, unknown>>
              const normalizeTitle = (s: string) => s
                .replace(/[\*`_#>\[\]]+/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase()
              const findMatch = (ec: Record<string, unknown>): Record<string, unknown> | undefined => {
                const o = typeof ec.order === 'number' ? (ec.order as number) : undefined
                const tRaw = typeof ec.title === 'string' ? (ec.title as string) : ''
                const t = normalizeTitle(tRaw)
                // 1) Match per order
                let hit = typeof o === 'number' ? norm.find(nc => typeof (nc as { order?: unknown }).order === 'number' && (nc as { order: number }).order === o) : undefined
                // 2) Fallback per normalisiertem Titel (startsWith / includes)
                if (!hit && t) {
                  hit = norm.find(nc => {
                    const nt = typeof (nc as { title?: unknown }).title === 'string' ? normalizeTitle((nc as { title: string }).title) : ''
                    return nt === t || nt.startsWith(t) || t.startsWith(nt) || nt.includes(t) || t.includes(nt)
                  })
                }
                return hit
              }
              const patched = existingChapters.map(ec => {
                const nc = findMatch(ec)
                if (nc) {
                  const sp = typeof (nc as { startPage?: unknown }).startPage === 'number' ? (nc as { startPage: number }).startPage : undefined
                  const ep = typeof (nc as { endPage?: unknown }).endPage === 'number' ? (nc as { endPage: number }).endPage : undefined
                  const next = { ...ec } as Record<string, unknown>
                  // Startseite: nur ergänzen, nie überschreiben
                  const hasStart = typeof (next as { startPage?: unknown }).startPage === 'number'
                  if (!hasStart && typeof sp === 'number') next.startPage = sp
                  // Endseite: übernehmen, wenn fehlend ODER eine Erweiterung nach rechts (z. B. Lücke schließen)
                  const currentEnd = typeof (next as { endPage?: unknown }).endPage === 'number' ? (next as { endPage: number }).endPage : undefined
                  if (typeof ep === 'number' && (currentEnd === undefined || ep > currentEnd)) (next as { endPage: number }).endPage = ep
                  // pageCount aus finalen Seiten neu berechnen
                  const ns = typeof (next as { startPage?: unknown }).startPage === 'number' ? (next as { startPage: number }).startPage : undefined
                  const ne = typeof (next as { endPage?: unknown }).endPage === 'number' ? (next as { endPage: number }).endPage : undefined
                  if (typeof ns === 'number' && typeof ne === 'number') (next as { pageCount: number }).pageCount = Math.max(1, ne - ns + 1)
                  return next
                }
                return ec
              })
              mergedMeta = { ...mergedMeta, chapters: patched, toc }
            }
            // Seitenzahl aus Kapitelanalyse ins Frontmatter übernehmen (Schlüssel: "pages"),
            // aber nur ergänzen, nicht überschreiben, falls bereits vorhanden
            if (typeof pages === 'number') {
              const hasPagesField = typeof (mergedMeta as { pages?: unknown }).pages === 'number'
              if (!hasPagesField) (mergedMeta as { pages: number }).pages = pages
            }
            const msg = `Kapitel normalisiert: ${chap.length}${pages ? ` · Seiten ${pages}` : ''}`
            bufferLog(jobId, { phase: 'chapters_normalized', message: msg })
            try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 45, updatedAt: new Date().toISOString(), message: 'chapters_normalized', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          } else {
            bufferLog(jobId, { phase: 'chapters_normalize_failed', message: `Analyze-Endpoint ${res.status}` })
            // Abbruch, wenn Ingestion geplant war – Kapitel nicht verlässlich → Prozess stoppen
            const ingestPlanned = ((): boolean => {
              try {
                const p = getPolicies({ parameters: job.parameters || {} })
                return p.ingest !== 'ignore'
              } catch { return true }
            })()
            if (ingestPlanned) {
              clearWatchdog(jobId)
              await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: 'Kapitel-Normalisierung fehlgeschlagen' } })
              // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
              void drainBufferedLogs(jobId)
              await repo.setStatus(jobId, 'failed', { error: { code: 'chapters_normalize_failed', message: 'Analyze-Endpoint nicht erreichbar/404' } })
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'chapters_normalize_failed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
              return NextResponse.json({ status: 'error', jobId, kind: 'chapters_normalize_failed' }, { status: 500 })
            }
          }
        } catch (e) {
          bufferLog(jobId, { phase: 'chapters_normalize_error', message: e instanceof Error ? e.message : String(e) })
          // analoger Abbruch bei geplantem Ingest
          const ingestPlanned = ((): boolean => {
            try {
              const p = getPolicies({ parameters: job.parameters || {} })
              return p.ingest !== 'ignore'
            } catch { return true }
          })()
          if (ingestPlanned) {
            clearWatchdog(jobId)
            await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: 'Kapitel-Normalisierung Fehler' } })
            // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
            void drainBufferedLogs(jobId)
            await repo.setStatus(jobId, 'failed', { error: { code: 'chapters_normalize_error', message: 'Analyze-Endpoint Fehler' } })
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'chapters_normalize_error', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
            return NextResponse.json({ status: 'error', jobId, kind: 'chapters_normalize_error' }, { status: 500 })
          }
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
        const stripAllFrontmatter = (text: string): string => {
          let out = text
          const re = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/m
          while (re.test(out)) out = out.replace(re, '')
          return out
        }
        const bodyOnly = stripAllFrontmatter(textSource)
        const markdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(bodyOnly, mergedMeta)
          : bodyOnly;
        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        // Zielordner verifizieren (Pfad abrufbar?)
        try { await provider.getPathById(targetParentId); }
        catch {
          bufferLog(jobId, { phase: 'store_folder_missing', message: 'Zielordner nicht gefunden' });
        await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: 'Zielordner nicht gefunden (store)' } });
          await repo.setStatus(jobId, 'failed', { error: { code: 'STORE_FOLDER_NOT_FOUND', message: 'Zielordner nicht gefunden' } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'store_folder_missing', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'error', jobId, kind: 'store_folder_missing' }, { status: 500 });
        }
        // Speichern gehört fachlich zur Template-Phase
        // Kein erneutes Starten des Template‑Steps, wenn bereits completed
        try {
          const latest = await repo.get(jobId)
          const tpl = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'transform_template') : undefined
          if (tpl?.status !== 'completed') {
            // nichts tun: Template bleibt im bisherigen Status; Speichern gehört zur laufenden Phase
          }
        } catch {}
        const saved = await provider.uploadFile(targetParentId, file);
        try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'stored_local', attributes: { savedItemId: saved.id, name: saved.metadata?.name } }); } catch {}
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;
        // Pfad festschreiben
        try {
          const p = await provider.getPathById(targetParentId);
          await repo.appendLog(jobId, { phase: 'stored_path', message: `${p}/${uniqueName}` } as unknown as Record<string, unknown>);
          // @ts-expect-error custom field for UI refresh
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 98, updatedAt: new Date().toISOString(), message: 'stored_local', jobType: job.job_type, fileName: uniqueName, sourceItemId: job.correlation?.source?.itemId, refreshFolderId: targetParentId });
        } catch {}
        // Final: Template erst jetzt (nach erfolgreichem Speichern inkl. Pfad) auf completed setzen
        await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() })
        try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_done' }); } catch {}

        // NEU: Doc‑Meta in Pinecone upserten (Statuscache) – für Shadow‑Twin UND Quelle (falls vorhanden)
        try {
          const apiKey = process.env.PINECONE_API_KEY
          if (apiKey) {
            const { loadLibraryChatContext } = await import('@/lib/chat/loader')
            const { describeIndex, upsertVectorsChunked } = await import('@/lib/chat/pinecone')
            const ctx = await loadLibraryChatContext(job.userEmail, job.libraryId)
            if (ctx) {
              const idx = await describeIndex(ctx.vectorIndex, apiKey)
              if (idx?.host) {
                const dim = typeof idx.dimension === 'number' ? idx.dimension : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)
                const zero = new Array<number>(dim).fill(0)
                zero[0] = 1

                // Kanonische ID: bevorzugt die Quell‑PDF
                const canonicalFileId = sourceId || saved.id
                // Bestehende Einträge zu dieser Quelle vorab löschen (Idempotenz)
                try {
                  const { deleteByFilter } = await import('@/lib/chat/pinecone')
                  await deleteByFilter(idx.host, apiKey, { sourceFileId: { $eq: canonicalFileId } })
                  // Zusätzlich evtl. alte fileId-basierte Einträge entfernen
                  await deleteByFilter(idx.host, apiKey, { fileId: { $eq: canonicalFileId } })
                } catch { /* ignore */ }

                // Statusflachfelder
                const statusFlat: Record<string, unknown> = {
                  extract_status: 'completed',
                  template_status: templateStatus,
                  ingest_status: 'preparing',
                }
                // Metadatenquellen
                const docMeta = mergedMeta
                const baseMeta = {
                  kind: 'doc',
                  user: job.userEmail,
                  libraryId: job.libraryId,
                  upsertedAt: new Date().toISOString(),
                  docMetaJson: JSON.stringify(docMeta || {}),
                  sourceFileId: canonicalFileId,
                } as Record<string, unknown>

                const targets: Array<{ id: string; fileId: string; fileName: string }> = [
                  // Nur EIN kanonischer Doc‑Meta‑Vektor pro Quelle
                  { id: `${canonicalFileId}-meta`, fileId: canonicalFileId, fileName: sourceId ? (job.correlation?.source?.name || saved.metadata.name) : saved.metadata.name },
                ]

                const vectors = targets.map(t => ({
                  id: t.id,
                  values: zero,
                  metadata: {
                    ...baseMeta,
                    ...statusFlat,
                    // Keine Zähler mehr zu früh setzen – finale Zahlen kommen nach Chunking
                    fileId: t.fileId,
                    fileName: t.fileName,
                  } as Record<string, unknown>
                }))
                try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_upsert_prepare', attributes: { targets: targets.length, index: ctx.vectorIndex } }); } catch {}
                await upsertVectorsChunked(idx.host, apiKey, vectors)
                try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_upserted', attributes: { count: targets.length } }); } catch {}
                bufferLog(jobId, { phase: 'doc_meta_upsert', message: `Pinecone Doc‑Meta upserted (${targets.length})` })
              }
            }
          }
        } catch (err) {
          FileLogger.error('external-jobs', 'Doc‑Meta Upsert fehlgeschlagen', err)
          bufferLog(jobId, { phase: 'doc_meta_upsert_failed', message: 'Doc‑Meta Upsert fehlgeschlagen' })
        }

        // Bilder-ZIP optional verarbeiten
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              const base = baseRaw.replace(/\/$/, '');
              const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
              archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`;
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              clearWatchdog(jobId);
              // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
              void drainBufferedLogs(jobId);
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            }
            const arrayBuf = await resp.arrayBuffer();
            const base64Zip = Buffer.from(arrayBuf).toString('base64');
            const originalItemForImages = {
              id: sourceId || 'unknown',
              parentId: targetParentId,
              type: 'file' as const,
              metadata: {
                name: job.correlation.source?.name || 'source.pdf',
                size: 0,
                modifiedAt: new Date(),
                mimeType: job.correlation.source?.mimeType || 'application/pdf',
              },
            };
            const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
            const imageResult = await ImageExtractionService.saveZipArchive(
              base64Zip,
              'images.zip',
              originalItemForImages,
              provider,
              async (folderId: string) => provider.listItemsById(folderId),
              extractedText,
              lang,
              textContents
            );
            for (const it of imageResult.savedItems) savedItems.push(it.id);
            bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            clearWatchdog(jobId);
            // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
            void drainBufferedLogs(jobId);
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
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
          const res = await IngestionService.upsertMarkdown(job.userEmail, job.libraryId, fileId, fileName, markdownForIngestion, docMetaForIngestion, jobId);
          // Nach Chunking (50-70%)
          try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 60, updatedAt: new Date().toISOString(), message: 'ingest_chunking_done', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
          await repo.setIngestion(jobId, { upsertAt: new Date(), vectorsUpserted: total, index: res.index });
          // Zusammenfassung loggen
          bufferLog(jobId, { phase: 'ingest_rag', message: `RAG-Ingestion: ${res.chunksUpserted} Chunks, ${res.docUpserted ? 1 : 0} Doc` });
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_pinecone_upserted', attributes: { chunks: res.chunksUpserted, doc: res.docUpserted, total } }); } catch {}
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

      await repo.setStatus(jobId, 'completed');
      clearWatchdog(jobId);
      // gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      await repo.setResult(jobId, {
        extracted_text: extractedText,
        images_archive_url: imagesArchiveUrlFromWorker || undefined,
        metadata: body?.data?.metadata,
      }, { savedItemId, savedItems });

      // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
      await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

      try { await repo.traceAddEvent(jobId, { name: 'completed', attributes: { savedItemId, savedItemsCount: savedItems.length } }); } catch {}
      // @ts-expect-error custom field for UI refresh
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, refreshFolderId: (job.correlation?.source?.parentId || 'root') });
      return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
    }

    // Sollte nicht erreicht werden
    return NextResponse.json({ status: 'ok', jobId, kind: 'noop_final' });
  } catch (err) {
    try {
      const { jobId } = await params;
      const repo = new ExternalJobsRepository();
      const job = await repo.get(jobId);
      if (job) {
        bufferLog(jobId, { phase: 'failed', message: 'Invalid payload' });
        await repo.appendLog(jobId, { phase: 'failed', message: 'Invalid payload' } as unknown as Record<string, unknown>);
        await repo.setStatus(jobId, 'failed', { error: { code: 'invalid_payload', message: err instanceof Error ? err.message : 'Invalid payload' } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Invalid payload', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      }
    } catch {
      // ignore secondary failures
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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


