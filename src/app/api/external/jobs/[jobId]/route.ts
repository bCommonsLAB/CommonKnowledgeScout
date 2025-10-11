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
      bufferLog(jobId, { phase: 'failed', message: 'callback_token fehlt' });
      await repo.appendLog(jobId, { phase: 'failed', message: 'callback_token fehlt' } as unknown as Record<string, unknown>);
      await repo.setStatus(jobId, 'failed', { error: { code: 'callback_token_missing', message: 'callback_token fehlt' } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'callback_token fehlt', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });
    }

    if (!internalBypass) {
      const tokenHash = repo.hashSecret(callbackToken as string);
      if (tokenHash !== job.jobSecretHash) {
        bufferLog(jobId, { phase: 'failed', message: 'Unauthorized callback' });
        await repo.appendLog(jobId, { phase: 'failed', message: 'Unauthorized callback' } as unknown as Record<string, unknown>);
        await repo.setStatus(jobId, 'failed', { error: { code: 'unauthorized', message: 'Ungültiges callback_token' } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Unauthorized callback', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);

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
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      FileLogger.info('external-jobs', 'Progress-Event', {
        jobId,
        phase: phase || 'progress',
        progress: progressValue,
        message
      });
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
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker) {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];
    let docMetaForIngestion: Record<string, unknown> | undefined;

    if (lib && extractedText) {
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
            await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
            templateStatus = 'skipped';
          }
        }
        const shouldRunTemplate = shouldRunWithGate(templateGateExists, policies.metadata);
        if (!shouldRunTemplate) {
          bufferLog(jobId, { phase: 'transform_meta_skipped', message: 'Template-Transformation übersprungen (Phase 1)' });
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
              fd.append('text', extractedText);
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
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
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

        // Frontmatter bestimmen und Shadow‑Twin speichern
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };
        docMetaForIngestion = finalMeta;
        await repo.appendMeta(jobId, finalMeta, 'template_transform');
        await repo.updateStep(jobId, 'transform_template', { status: templateStatus === 'failed' ? 'failed' : 'completed', endedAt: new Date(), ...(templateStatus === 'skipped' ? { details: { skipped: true } } : {}) });

        // Fatal: Wenn Template-Transformation gestartet wurde, aber fehlgeschlagen ist, abbrechen
        if (templateStatus === 'failed') {
          clearWatchdog(jobId);
          bufferLog(jobId, { phase: 'failed', message: 'Template-Transformation fehlgeschlagen (fatal)' });
          const bufferedTpl = drainBufferedLogs(jobId);
          for (const entry of bufferedTpl) {
            await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
          }
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
          // Ingestion-Status wird später ggf. separat ermittelt; hier neutral
          ingest_status: 'none',
        };
        // optionale Summary-Werte aus bereits vorhandenen Metadaten übernehmen, wenn vorhanden
        if (typeof (finalMeta as Record<string, unknown>)['summary_pages'] === 'number') ssotFlat['summary_pages'] = (finalMeta as Record<string, unknown>)['summary_pages'];
        if (typeof (finalMeta as Record<string, unknown>)['summary_chunks'] === 'number') ssotFlat['summary_chunks'] = (finalMeta as Record<string, unknown>)['summary_chunks'];
        ssotFlat['summary_language'] = lang;

        const mergedMeta = { ...finalMeta, ...ssotFlat } as Record<string, unknown>;

        const markdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, mergedMeta)
          : extractedText;
        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
        const saved = await provider.uploadFile(targetParentId, file);
        FileLogger.info('external-jobs', 'Shadow‑Twin gespeichert', { jobId, savedItemId: saved.id, name: saved.metadata?.name })
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

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
                  ingest_status: 'none',
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
                    fileId: t.fileId,
                    fileName: t.fileName,
                  } as Record<string, unknown>
                }))
                FileLogger.info('external-jobs', 'Doc‑Meta Upsert vorbereiten', { jobId, targets: targets.length, index: ctx.vectorIndex })
                await upsertVectorsChunked(idx.host, apiKey, vectors)
                FileLogger.info('external-jobs', 'Doc‑Meta Upsert erfolgreich', { jobId, count: targets.length })
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
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
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
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      }

      // Schritt: ingest_rag (optional automatisiert)
      try {
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
            // Wenn geskippt, keinen weiteren Ingestion-Versuch starten
            // dennoch Abschluss unten fortsetzen
          } else {
            await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
          }
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
        }
        FileLogger.info('external-jobs', 'Ingestion start', { jobId, libraryId: job.libraryId })
        const useIngestion = !!(job.parameters && typeof job.parameters === 'object' && (job.parameters as Record<string, unknown>)['doIngestRAG']);
        if (useIngestion && !ingestGateExists) {
          // Lade gespeicherten Markdown-Inhalt erneut (vereinfachend: extractedText)
          // Stabiler Schlüssel: Original-Quell-Item (PDF) bevorzugen, sonst Shadow‑Twin, sonst Fallback
          const fileId = (job.correlation.source?.itemId as string | undefined) || savedItemId || `${jobId}-md`;
          const fileName = `${(job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')}.${(job.correlation.options?.targetLanguage as string | undefined) || 'de'}.md`;
          const res = await IngestionService.upsertMarkdown(job.userEmail, job.libraryId, fileId, fileName, extractedText || '', docMetaForIngestion);
          const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
          await repo.setIngestion(jobId, { upsertAt: new Date(), vectorsUpserted: total, index: res.index });
          // Zusammenfassung loggen
          bufferLog(jobId, { phase: 'ingest_rag', message: `RAG-Ingestion: ${res.chunksUpserted} Chunks, ${res.docUpserted ? 1 : 0} Doc` });
          FileLogger.info('external-jobs', 'Ingestion success', { jobId, chunks: res.chunksUpserted, doc: res.docUpserted, total })
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() });
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
        }
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
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setResult(jobId, {
        extracted_text: extractedText,
        images_archive_url: imagesArchiveUrlFromWorker || undefined,
        metadata: body?.data?.metadata,
      }, { savedItemId, savedItems });

      // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
      await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

      FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
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


