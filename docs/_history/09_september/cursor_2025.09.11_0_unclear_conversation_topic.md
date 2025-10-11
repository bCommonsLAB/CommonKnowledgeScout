# Unclear conversation topic
_Exported on 10/9/2025 at 14:58:30 GMT+2 from Cursor (1.7.38)_

---

**User**

??

---

**Cursor**

Ich öffne die betroffenen Dateien mit Lint-Fehlern und suche die exakten Stellen, um minimale, gezielte Edits vorzunehmen.

Ich werde die relevanten Dateien öffnen, um die Typen der erwarteten Parameter zu prüfen und die minimalen Edits vorzubereiten. Danach wende ich die Edits an und prüfe Linter-Fehler erneut.

Ich passe jetzt die minimalen Edits in 4 Dateien an (Entfernen ungenutzter Importe, Ersetzen von any, kleine Typanpassungen) und prüfe danach die Linter-Ausgabe für genau diese Dateien.

```typescript
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
import { getServerProvider } from '@/lib/storage/server-provider';

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
      const doExtractMetadata = !!(job.parameters && typeof job.parameters === 'object' && (job.parameters as Record<string, unknown>)['doExtractMetadata']);
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
        // Gate für Transform-Template (Phase 2)
        let templateGateExists = false;
        if (autoSkip) {
          const g = await gateTransformTemplate({ repo, jobId, userEmail: job.userEmail, library: lib, source: job.correlation?.source, options: job.correlation?.options as { targetLanguage?: string } | undefined });
          templateGateExists = g.exists;
          if (g.exists) {
            await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
          }
        }
        if (!doExtractMetadata || templateGateExists) {
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
              }
            }
          } catch(err) {
            console.error(err);
            bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler') });
          }
        }

        // Frontmatter bestimmen und Shadow‑Twin speichern
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };
        docMetaForIngestion = finalMeta;
        await repo.appendMeta(jobId, finalMeta, 'template_transform');
        await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const markdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, finalMeta)
          : extractedText;
        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

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



```

```javascript
const config: Record<string, unknown> = { ...(lib.config || {}) };
config['accessToken'] = accessToken; 
lib.config = config as StorageConfig;
```

```javascript
if (lib.config) {
  const cfg = lib.config as Record<string, unknown>;
  delete cfg['accessToken']; 
}
```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { StorageFactory } from '@/lib/storage/storage-factory'

// PATCH - Persistiert Tokens in der Library (Server-intern oder via Clerk)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const isInternal = req.headers.get('x-internal-request') === '1'
    const emailParam = req.nextUrl.searchParams.get('email') || undefined
    if (!isInternal) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = isInternal ? null : await currentUser()
    const email = emailParam || user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const { accessToken, refreshToken, tokenExpiry } = await req.json()
    if (!accessToken || !refreshToken || !tokenExpiry) {
      return NextResponse.json({ error: 'accessToken, refreshToken, tokenExpiry erforderlich' }, { status: 400 })
    }

    const svc = LibraryService.getInstance()
    const libs = await svc.getUserLibraries(email)
    const lib = libs.find(l => l.id === id)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    // Tokens typisiert ohne any in die Konfiguration schreiben
    const cfg: Record<string, unknown> = { ...(lib.config || {}) }
    cfg['accessToken'] = accessToken
    cfg['refreshToken'] = refreshToken
    cfg['tokenExpiry'] = Number(tokenExpiry)
    lib.config = cfg as typeof lib.config

    const ok = await svc.updateLibrary(email, lib)
    if (!ok) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE - Tokens in der DB entfernen und Provider-Cache leeren
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const isInternal = req.headers.get('x-internal-request') === '1'
    const emailParam = req.nextUrl.searchParams.get('email') || undefined
    if (!isInternal) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = isInternal ? null : await currentUser()
    const email = emailParam || user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const svc = LibraryService.getInstance()
    const libs = await svc.getUserLibraries(email)
    const lib = libs.find(l => l.id === id)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    if (lib.config) {
      const cfg = lib.config as unknown as Record<string, unknown>
      delete cfg['accessToken']
      delete cfg['refreshToken']
      delete cfg['tokenExpiry']
      lib.config = cfg as typeof lib.config
    }

    const ok = await svc.updateLibrary(email, lib)
    if (!ok) return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })

    try {
      const factory = StorageFactory.getInstance()
      await factory.clearProvider(id)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST - Temporäre Tokens abrufen und aus DB entfernen (bestehende Logik beibehalten)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    if (!user?.emailAddresses?.length) return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 400 })
    const userEmail = user.emailAddresses[0].emailAddress

    const { id } = await params
    const libraryService = LibraryService.getInstance()
    const library = await libraryService.getLibrary(userEmail, id)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const config = library.config as Record<string, unknown>
    const tempAccessToken = config?.tempAccessToken as string
    const tempRefreshToken = config?.tempRefreshToken as string
    const tempTokenExpiry = config?.tempTokenExpiry as string
    const tempTokensAvailable = config?.tempTokensAvailable as boolean

    if (!tempTokensAvailable || !tempAccessToken || !tempRefreshToken) {
      return NextResponse.json({ error: 'Keine temporären Tokens verfügbar', hasTokens: false }, { status: 404 })
    }

    const updatedConfig = { ...config }
    delete updatedConfig.tempAccessToken
    delete updatedConfig.tempRefreshToken
    delete updatedConfig.tempTokenExpiry
    delete updatedConfig.tempTokensAvailable

    const updatedLibrary = { ...library, config: updatedConfig }
    await libraryService.updateLibrary(userEmail, updatedLibrary)

    return NextResponse.json({ success: true, tokens: { accessToken: tempAccessToken, refreshToken: tempRefreshToken, tokenExpiry: tempTokenExpiry } })
  } catch {
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { LibraryService } from '@/lib/services/library-service';
import { StorageFactory } from '@/lib/storage/storage-factory';

function stripFrontmatter(markdown: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n?/;
  return markdown.replace(fm, '');
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Kein Benutzer-E-Mail gefunden' }, { status: 401 });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : '';
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    const ingest = Boolean(body.ingest);
    if (!libraryId || !fileId) return NextResponse.json({ error: 'libraryId und fileId erforderlich' }, { status: 400 });

    // Markdown laden (provider-agnostisch)
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined);
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });

    let markdown = '';
    const factory = StorageFactory.getInstance();
    factory.setLibraries([{ id: lib.id, label: lib.label, type: lib.type, path: lib.path, isEnabled: lib.isEnabled, config: lib.config || {} }]);
    const provider = await factory.getProvider(lib.id);
    const bin = await provider.getBinary(fileId);
    markdown = await bin.blob.text();

    const extractedText = stripFrontmatter(markdown);

    // Internen Job erstellen (ohne PDF-Extraktion) – reuse bestehende Callback-Logik
    const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
    if (!internalToken) return NextResponse.json({ error: 'INTERNAL_TEST_TOKEN nicht konfiguriert' }, { status: 500 });

    const createRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''}/api/external/jobs/internal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ libraryId, parentId: 'root', fileName: 'shadow-twin.md', userEmail: '', targetLanguage: 'de', extractionMethod: 'native', includeImages: false })
    });
    if (!createRes.ok) {
      const t = await createRes.text().catch(() => 'Fehler');
      return NextResponse.json({ error: `Job konnte nicht erstellt werden: ${t}` }, { status: 500 });
    }
    const { jobId, callbackUrl } = await createRes.json() as { jobId: string; callbackUrl: string };

    // useIngestionPipeline optional setzen
    if (ingest) {
      const repo = new ExternalJobsRepository();
      await repo.mergeParameters(jobId, { useIngestionPipeline: true });
    }

    // Callback direkt füttern – nur Template/Store Pfade werden greifen
    const cbRes = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ data: { extracted_text: extractedText } })
    });
    if (!cbRes.ok) {
      const t = await cbRes.text().catch(() => 'Fehler');
      return NextResponse.json({ error: `Callback fehlgeschlagen: ${t}` }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



```

```typescript
import { StorageProvider, StorageItem, StorageValidationResult, StorageError, StorageItemMetadata } from './types';
import { ClientLibrary } from '@/types/library';
import * as process from 'process';

interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: {
    id: string;
    path?: string;
  };
}

interface OneDriveItemResponse {
  value: OneDriveFile[];
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * OneDrive Provider
 * Implementiert die StorageProvider-Schnittstelle für Microsoft OneDrive
 */
export class OneDriveProvider implements StorageProvider {
  private library: ClientLibrary;
  private baseUrl: string;
  private userEmail: string | null = null;
  private baseFolderId: string | null = null;
  private basePath: string = '';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;
  private authenticated: boolean = false;
  private oauthDefaults: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } | null = null;
  
  // Neu: Token-Refresh Promise für Debouncing
  private refreshPromise: Promise<void> | null = null;
  // Neu: Flag für Token-Löschung
  private clearingTokens: boolean = false;

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    // Im Server-Kontext kann baseUrl übergeben werden, sonst relative URL verwenden
    this.baseUrl = baseUrl || '';
    this.loadTokens();
    this.loadOAuthDefaults(); // Lade OAuth-Standardwerte
  }

  get name() {
    return 'Microsoft OneDrive';
  }

  get id() {
    return this.library.id;
  }

  /**
   * Erstellt eine absolute oder relative API-URL je nach Kontext
   */
  private getApiUrl(path: string): string {
    const url = `${this.baseUrl}${path}`;
    if (this.userEmail) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}email=${encodeURIComponent(this.userEmail)}`;
    }
    return url;
  }

  setUserEmail(email: string) {
    this.userEmail = email;
  }

  private normalizeBasePath(input: string | undefined): string {
    if (!input) return '';
    const trimmed = input.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return trimmed ? `/${trimmed}` : '';
  }

  private async ensureBaseFolderResolved(): Promise<void> {
    // Resolve once per provider lifecycle
    if (this.baseFolderId !== null) return;
    const configured = this.normalizeBasePath(this.library.path);
    this.basePath = configured;
    // If no base path configured, use root
    if (!configured) {
      this.baseFolderId = 'root';
      return;
    }

    const accessToken = await this.ensureAccessToken();
    // Try to resolve the configured path to an item id
    const tryResolve = async (): Promise<string | null> => {
      const url = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(configured)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        return data.id ?? null;
      }
      if (res.status === 404) return null;
      // Other errors
      const txt = await res.text().catch(() => '');
      throw new StorageError(`Fehler beim Auflösen des Basisordners: ${txt || res.statusText}`,'API_ERROR', this.id);
    };

    let id: string | null = await tryResolve();
    if (id) {
      this.baseFolderId = id;
      return;
    }

    // Create path recursively
    const segments = configured.split('/').filter(Boolean);
    let parentId: string | 'root' = 'root';
    for (const segment of segments) {
      // Try to find child under parent
      let childId: string | null = null;
      const listUrl = parentId === 'root'
        ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
        : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
      const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (listRes.ok) {
        const data = await listRes.json() as { value?: Array<{ id: string; name: string; folder?: unknown }> };
        const match = (data.value || []).find(x => x.name === segment && x.folder);
        if (match) childId = match.id;
      }
      if (!childId) {
        const createUrl = parentId === 'root'
          ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
          : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: segment, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' })
        });
        if (!createRes.ok) {
          const txt = await createRes.text().catch(() => '');
          throw new StorageError(`Fehler beim Erstellen des Basisordners "${segment}": ${txt || createRes.statusText}`,'API_ERROR', this.id);
        }
        const created = await createRes.json() as { id: string };
        childId = created.id;
      }
      parentId = childId as string;
    }
    this.baseFolderId = parentId;
  }

  private loadTokens() {
    // Server-Kontext: Tokens aus der Library-Konfiguration lesen (DB)
    if (typeof window === 'undefined') {
      try {
        const cfg = this.library.config as unknown as {
          accessToken?: string; refreshToken?: string; tokenExpiry?: number | string
        } | undefined;
        if (cfg?.accessToken && cfg?.refreshToken) {
          this.accessToken = cfg.accessToken;
          this.refreshToken = cfg.refreshToken;
          this.tokenExpiry = Number(cfg.tokenExpiry || 0);
          this.authenticated = true;
          console.log('[OneDriveProvider] Tokens aus Library-Konfiguration geladen (Server-Kontext)');
        }
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus Library-Konfiguration:', error);
      }
      return;
    }

    // Client-Kontext: Tokens aus localStorage
    try {
      const tokensJson = localStorage.getItem(`onedrive_tokens_${this.library.id}`);
      if (tokensJson) {
        const tokens = JSON.parse(tokensJson);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.tokenExpiry = tokens.expiry;
        this.authenticated = true;
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage geladen`);
      }
    } catch (error) {
      console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus localStorage:', error);
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
    // Konvertiere expiresIn (Sekunden) in Millisekunden und addiere aktuelle Zeit
    const expiry = Date.now() + (expiresIn * 1000);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = expiry;
    this.authenticated = true;

    // Client-Kontext: Tokens im localStorage persistieren
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`onedrive_tokens_${this.library.id}`, JSON.stringify({
          accessToken,
          refreshToken,
          expiry
        }));
        
        console.log('[OneDriveProvider] Tokens im localStorage gespeichert', {
          libraryId: this.library.id,
          expiresIn: `${expiresIn} Sekunden`,
          expiryTime: new Date(expiry).toISOString()
        });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens im localStorage:', error);
      }
    }

    // Server-Kontext: Tokens in der Library-Konfiguration persistieren (DB)
    if (typeof window === 'undefined') {
      try {
        await fetch(this.getApiUrl(`/api/libraries/${this.library.id}/tokens`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Request': '1' },
          body: JSON.stringify({ accessToken, refreshToken, tokenExpiry: Math.floor(expiry / 1000).toString() })
        });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens in der DB:', error);
      }
    }
  }

  private async clearTokens() {
    // Verhindere mehrfache gleichzeitige Aufrufe
    if (this.clearingTokens) {
      console.log('[OneDriveProvider] Token-Löschung läuft bereits, überspringe...');
      return;
    }
    this.clearingTokens = true;

    // Client: localStorage räumen
    if (typeof window !== 'undefined') {
      try {
        const localStorageKey = `onedrive_tokens_${this.library.id}`;
        localStorage.removeItem(localStorageKey);
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage entfernt`);
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens aus localStorage:', error);
      }
    }

    // Server: DB-Eintrag löschen
    if (typeof window === 'undefined') {
      try {
        await fetch(this.getApiUrl(`/api/libraries/${this.library.id}/tokens`), { method: 'DELETE', headers: { 'X-Internal-Request': '1' } });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens in der DB:', error);
      }
    }

    this.clearingTokens = false;
    
    // Setze lokale Variablen zurück
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
    this.authenticated = false;
  }

  private async loadOAuthDefaults() {
    try {
      // Im Server-Kontext (kein window-Objekt) die Umgebungsvariable direkt lesen
      if (typeof window === 'undefined') {
        const redirectUri = process.env.MS_REDIRECT_URI || '';
        if (redirectUri) {
          this.oauthDefaults = {
            tenantId: '',
            clientId: '',
            clientSecret: '',
            redirectUri
          };
          console.log('[OneDriveProvider] OAuth-Defaults aus Umgebungsvariablen geladen (Server-Kontext)');
        }
        return;
      }
      
      // Im Client-Kontext den API-Call machen
      const response = await fetch(this.getApiUrl('/api/settings/oauth-defaults'));
      if (response.ok) {
        const data = await response.json();
        if (data.hasDefaults) {
          this.oauthDefaults = data.defaults;
          console.log('[OneDriveProvider] OAuth-Defaults geladen');
        }
      }
    } catch (error) {
      console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
    }
  }

  private getConfigValue(key: 'tenantId' | 'clientId' | 'clientSecret' | 'redirectUri'): string {
    // Erst in der Bibliotheks-Konfiguration nachschauen
    const value = this.library.config?.[key] as string;
    if (value) return value;
    
    // Für clientId und clientSecret keine Defaults verwenden - diese müssen explizit gesetzt werden
    if (key === 'clientId' || key === 'clientSecret') {
      return ''; // Leere Zeichenkette zurückgeben, damit wir prüfen können, ob der Wert fehlt
    }
    
    // Dann in den geladenen OAuth-Defaults
    if (this.oauthDefaults && this.oauthDefaults[key]) {
      return this.oauthDefaults[key];
    }
    
    // Fallback für tenantId
    if (key === 'tenantId') return 'common';
    
    // Fallback für redirectUri
    if (key === 'redirectUri') {
      // Im Server-Kontext direkt aus der Umgebungsvariable lesen
      if (typeof window === 'undefined' && process.env.MS_REDIRECT_URI) {
        return process.env.MS_REDIRECT_URI;
      }
      
      // Im Client-Kontext aus OAuth-Defaults
      if (this.oauthDefaults?.redirectUri) {
        return this.oauthDefaults.redirectUri;
      }
      
      throw new StorageError(
        "Fehlende Redirect URI in der Umgebungskonfiguration",
        "CONFIG_ERROR",
        this.id
      );
    }
    
    return '';
  }

  public async getAuthUrl(): Promise<string> {
    // Stelle sicher, dass OAuth-Defaults geladen sind
    if (!this.oauthDefaults) {
      try {
        await this.loadOAuthDefaults();
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
      }
    }

    const tenantId = this.getConfigValue('tenantId');
    const clientId = this.getConfigValue('clientId');
    const redirectUri = this.getConfigValue('redirectUri');

    if (!clientId) {
      throw new StorageError(
        "Fehlende Client ID für OneDrive-Authentifizierung",
        "CONFIG_ERROR",
        this.id
      );
    }

    if (!redirectUri) {
      throw new StorageError(
        "Fehlende Redirect URI für OneDrive-Authentifizierung",
        "CONFIG_ERROR",
        this.id
      );
    }

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=Files.ReadWrite offline_access`;
  }

  public async authenticate(code: string): Promise<boolean> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      const tenantId = this.getConfigValue('tenantId');
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        throw new StorageError(
          `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`,
          "CONFIG_ERROR",
          this.id
        );
      }

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Token-Austausch fehlgeschlagen: ${errorData.error_description || response.statusText}`,
          "AUTH_ERROR",
          this.id
        );
      }

      const data = await response.json() as TokenResponse;
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return true;
    } catch (error) {
      console.error('[OneDriveProvider] Authentifizierungsfehler:', error);
      await this.clearTokens();
      throw error;
    }
  }

  public isAuthenticated(): boolean {
    return this.authenticated && !!this.accessToken;
  }

  private async ensureAccessToken(): Promise<string> {
    // Wenn kein Token vorhanden, Fehler werfen
    if (!this.accessToken) {
      throw new StorageError(
        "Nicht authentifiziert",
        "AUTH_REQUIRED",
        this.id
      );
    }

    // Wenn Token in weniger als 5 Minuten abläuft, versuche Refresh
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 Minuten in Millisekunden
    const now = Date.now();
    const timeUntilExpiry = this.tokenExpiry - now;
    
    // Log Token-Status
    console.log('[OneDriveProvider] Token-Status:', {
      libraryId: this.library.id,
      tokenExpiry: new Date(this.tokenExpiry).toISOString(),
      currentTime: new Date(now).toISOString(),
      timeUntilExpiry: `${Math.floor(timeUntilExpiry / 1000)} Sekunden`,
      hasRefreshToken: !!this.refreshToken,
      isExpired: this.tokenExpiry <= now,
      refreshBuffer: `${FIVE_MINUTES / 1000} Sekunden`
    });

    // Nur refreshen wenn:
    // 1. Token abgelaufen ist ODER
    // 2. Token läuft in weniger als 5 Minuten ab UND
    // 3. Refresh-Token vorhanden ist UND
    // 4. Kein Refresh bereits läuft
    if (
      (this.tokenExpiry <= now || timeUntilExpiry <= FIVE_MINUTES) && 
      this.refreshToken && 
      !this.refreshPromise
    ) {
      await this.refreshAccessToken();
    } else if (this.refreshPromise) {
      // Wenn bereits ein Refresh läuft, warte darauf
      console.log('[OneDriveProvider] Token-Refresh läuft bereits, warte auf Abschluss...');
      await this.refreshPromise;
    }

    return this.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    // Wenn bereits ein Refresh läuft, warte auf dessen Abschluss
    if (this.refreshPromise) {
      console.log('[OneDriveProvider] Token-Refresh läuft bereits, warte auf Abschluss...');
      return this.refreshPromise;
    }

    // Erstelle ein neues Refresh-Promise
    this.refreshPromise = (async () => {
      try {
        if (!this.refreshToken) {
          throw new StorageError(
            "Kein Refresh-Token verfügbar",
            "AUTH_ERROR",
            this.id
          );
        }

        // Token-Refresh über die Server-Route durchführen (vermeidet CORS-Probleme)
        console.log('[OneDriveProvider] Führe Token-Refresh über Server-Route durch');
        
        const response = await fetch(this.getApiUrl('/api/auth/onedrive/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': '1'
          },
          body: JSON.stringify({
            libraryId: this.library.id,
            refreshToken: this.refreshToken
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new StorageError(
            `Token-Aktualisierung fehlgeschlagen: ${errorData.details || errorData.error || response.statusText}`,
            "AUTH_ERROR",
            this.id
          );
        }

        const data = await response.json();
        await this.saveTokens(data.accessToken, data.refreshToken, data.expiresIn);
        console.log('[OneDriveProvider] Token erfolgreich über Server erneuert');
      } catch (error) {
        console.error('[OneDriveProvider] Fehler bei Token-Aktualisierung:', error);
        await this.clearTokens();
        throw error;
      } finally {
        // Lösche das Promise nach Abschluss
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Konvertiert OneDrive-Dateiinformationen in ein StorageItem
  private mapOneDriveFileToStorageItem(file: OneDriveFile): StorageItem {
    const metadata: StorageItemMetadata = {
      name: file.name,
      size: file.size,
      modifiedAt: new Date(file.lastModifiedDateTime),
      mimeType: file.file?.mimeType || (file.folder ? 'application/folder' : 'application/octet-stream'),
    };

    return {
      id: file.id,
      parentId: file.parentReference?.id || 'root',
      type: file.folder ? 'folder' : 'file',
      metadata
    };
  }

  // StorageProvider Methoden

  async validateConfiguration(): Promise<StorageValidationResult> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      // Prüfe, ob die nötigen Konfigurationswerte vorhanden sind
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        return {
          isValid: false,
          error: `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`
        };
      }

      // Wenn wir keinen Access Token haben, ist Konfiguration gültig,
      // aber Authentifizierung erforderlich
      if (!this.isAuthenticated()) {
        return {
          isValid: true,
          error: "Authentifizierung erforderlich"
        };
      }

      // Mit einem API-Aufruf testen, ob die Authentifizierung funktioniert
      try {
        await this.ensureAccessToken();
        const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root', {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            isValid: false,
            error: `OneDrive API-Fehler: ${errorData.error?.message || response.statusText}`
          };
        }

        return { isValid: true };
      } catch (error) {
        return {
          isValid: false,
          error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Validierung"
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Validierung"
      };
    }
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      if (folderId === 'root' && this.baseFolderId && this.baseFolderId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}/children`;
      } else if (folderId && folderId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen der Dateien: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const data = await response.json() as OneDriveItemResponse;
      return data.value.map(file => this.mapOneDriveFileToStorageItem(file));
    } catch (error) {
      console.error('[OneDriveProvider] listItemsById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Auflisten der Dateien",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root';
      if (itemId && itemId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen der Datei: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const file = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(file);
    } catch (error) {
      console.error('[OneDriveProvider] getItemById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen der Datei",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      let url;
      if (parentId === 'root') {
        if (this.baseFolderId && this.baseFolderId !== 'root') {
          url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}/children`;
        } else {
          url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
        }
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Erstellen des Ordners: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const folder = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(folder);
    } catch (error) {
      console.error('[OneDriveProvider] createFolder Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Erstellen des Ordners",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht gelöscht werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        // Bei DELETE gibt es möglicherweise keine JSON-Antwort
        const errorText = await response.text();
        throw new StorageError(
          `Fehler beim Löschen des Elements: ${errorText || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }
    } catch (error) {
      console.error('[OneDriveProvider] deleteItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht verschoben werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Zuerst die Informationen des Items abrufen, um den Namen zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!itemResponse.ok) {
        const errorData = await itemResponse.json();
        throw new StorageError(
          `Fehler beim Abrufen der Item-Informationen: ${errorData.error?.message || itemResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      // Verschieben des Items
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      const parentReference = newParentId === 'root' 
        ? { id: 'root' } 
        : { id: newParentId };

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentReference
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Verschieben des Elements: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }
    } catch (error) {
      console.error('[OneDriveProvider] moveItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Verschieben",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht umbenannt werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Umbenennen des Items über die Microsoft Graph API
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Umbenennen des Elements: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const renamedFile = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(renamedFile);
    } catch (error) {
      console.error('[OneDriveProvider] renameItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Umbenennen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      let url;
      if (parentId === 'root') {
        if (this.baseFolderId && this.baseFolderId !== 'root') {
          url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}:/${file.name}:/content`;
        } else {
          url = `https://graph.microsoft.com/v1.0/me/drive/root:/${file.name}:/content`;
        }
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${file.name}:/content`;
      }

      // Datei als ArrayBuffer lesen
      const arrayBuffer = await file.arrayBuffer();

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: arrayBuffer
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Hochladen der Datei: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const uploadedFile = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(uploadedFile);
    } catch (error) {
      console.error('[OneDriveProvider] uploadFile Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Hochladen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (fileId === 'root') {
        throw new StorageError(
          "Der Root-Ordner hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Dateiinformationen abrufen, um den MIME-Typ zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!itemResponse.ok) {
        const errorData = await itemResponse.json();
        throw new StorageError(
          `Fehler beim Abrufen der Dateiinformationen: ${errorData.error?.message || itemResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const fileInfo = await itemResponse.json() as OneDriveFile;
      
      if (fileInfo.folder) {
        throw new StorageError(
          "Der angegebene Pfad ist ein Ordner und hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Dateiinhalt abrufen
      const contentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!contentResponse.ok) {
        throw new StorageError(
          `Fehler beim Abrufen des Dateiinhalts: ${contentResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const blob = await contentResponse.blob();
      const mimeType = fileInfo.file?.mimeType || contentResponse.headers.get('content-type') || 'application/octet-stream';

      return { blob, mimeType };
    } catch (error) {
      console.error('[OneDriveProvider] getBinary Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen des Binärinhalts",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }



  async getPathById(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      if (itemId === 'root') {
        return '/';
      }

      // Item-Informationen abrufen
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen des Pfads: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const item = await response.json() as OneDriveFile;

      // Pfad aus parentReference extrahieren
      if (item.parentReference?.path) {
        // Entfernen von "/drive/root:" vom Pfad
        let path = item.parentReference.path.replace('/drive/root:', '');
        
        // Füge Dateinamen hinzu
        path = `${path}/${item.name}`;
        
        // Formatiere den Pfad
        path = path.replace(/^\/+|\/+$/g, ''); // Entferne führende/nachfolgende Slashes
        // Basispfad entfernen, wenn konfiguriert
        if (this.basePath && path.startsWith(this.basePath.replace(/^\/+/, ''))) {
          let rel = path.substring(this.basePath.replace(/^\/+/, '').length);
          rel = rel.replace(/^\/+/, '');
          return rel ? `/${rel}` : '/';
        }
        return path ? `/${path}` : '/';
      }
      
      return item.name;
    } catch (error) {
      console.error('[OneDriveProvider] getPathById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen des Pfads",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?select=@microsoft.graph.downloadUrl`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data['@microsoft.graph.downloadUrl']) {
        throw new Error('Keine Download-URL in der API-Antwort');
      }

      return data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('[OneDriveProvider] getDownloadUrl Fehler:', error);
      throw new StorageError('Fehler beim Abrufen der Download-URL: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?select=@microsoft.graph.downloadUrl`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data['@microsoft.graph.downloadUrl']) {
        throw new Error('Keine Streaming-URL in der API-Antwort');
      }

      return data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('[OneDriveProvider] getStreamingUrl Fehler:', error);
      throw new StorageError('Fehler beim Abrufen der Streaming-URL: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    if (itemId === 'root') {
      // Root-Item erzeugen
      return [
        {
          id: 'root',
          parentId: '',
          type: 'folder',
          metadata: {
            name: 'root',
            size: 0,
            modifiedAt: new Date(),
            mimeType: 'application/folder'
          }
        }
      ];
    }
    const path = await this.getPathById(itemId); // z.B. /foo/bar/baz
    const segments = path.split('/').filter(Boolean);
    let parentId = 'root';
    const pathItems: StorageItem[] = [];
    for (const segment of segments) {
      const children = await this.listItemsById(parentId);
      const folder = children.find(child => child.metadata.name === segment && child.type === 'folder');
      if (!folder) break;
      // Eltern in den Cache schreiben, falls sie fehlen
      if (parentId !== 'root' && !pathItems.find(item => item.id === parentId)) {
        try {
          const parentItem = await this.getItemById(parentId);
          pathItems.push(parentItem);
        } catch {}
      }
      pathItems.push(folder);
      parentId = folder.id;
    }
    return [{
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: 'root',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    }, ...pathItems];
  }
} 
```

Ich habe die ersten Fehler bereinigt. Jetzt passe ich die restlichen beiden Lint-Fehler an (`prefer-const` in `onedrive-provider.ts` und `any`-Cast in `server-provider.ts`) und baue erneut ohne Pipes, damit PowerShell nicht meckert.

```typescript
import { StorageProvider, StorageItem, StorageValidationResult, StorageError, StorageItemMetadata } from './types';
import { ClientLibrary } from '@/types/library';
import * as process from 'process';

interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: {
    id: string;
    path?: string;
  };
}

interface OneDriveItemResponse {
  value: OneDriveFile[];
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * OneDrive Provider
 * Implementiert die StorageProvider-Schnittstelle für Microsoft OneDrive
 */
export class OneDriveProvider implements StorageProvider {
  private library: ClientLibrary;
  private baseUrl: string;
  private userEmail: string | null = null;
  private baseFolderId: string | null = null;
  private basePath: string = '';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;
  private authenticated: boolean = false;
  private oauthDefaults: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } | null = null;
  
  // Neu: Token-Refresh Promise für Debouncing
  private refreshPromise: Promise<void> | null = null;
  // Neu: Flag für Token-Löschung
  private clearingTokens: boolean = false;

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    // Im Server-Kontext kann baseUrl übergeben werden, sonst relative URL verwenden
    this.baseUrl = baseUrl || '';
    this.loadTokens();
    this.loadOAuthDefaults(); // Lade OAuth-Standardwerte
  }

  get name() {
    return 'Microsoft OneDrive';
  }

  get id() {
    return this.library.id;
  }

  /**
   * Erstellt eine absolute oder relative API-URL je nach Kontext
   */
  private getApiUrl(path: string): string {
    const url = `${this.baseUrl}${path}`;
    if (this.userEmail) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}email=${encodeURIComponent(this.userEmail)}`;
    }
    return url;
  }

  setUserEmail(email: string) {
    this.userEmail = email;
  }

  private normalizeBasePath(input: string | undefined): string {
    if (!input) return '';
    const trimmed = input.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return trimmed ? `/${trimmed}` : '';
  }

  private async ensureBaseFolderResolved(): Promise<void> {
    // Resolve once per provider lifecycle
    if (this.baseFolderId !== null) return;
    const configured = this.normalizeBasePath(this.library.path);
    this.basePath = configured;
    // If no base path configured, use root
    if (!configured) {
      this.baseFolderId = 'root';
      return;
    }

    const accessToken = await this.ensureAccessToken();
    // Try to resolve the configured path to an item id
    const tryResolve = async (): Promise<string | null> => {
      const url = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(configured)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        return data.id ?? null;
      }
      if (res.status === 404) return null;
      // Other errors
      const txt = await res.text().catch(() => '');
      throw new StorageError(`Fehler beim Auflösen des Basisordners: ${txt || res.statusText}`,'API_ERROR', this.id);
    };

    const id: string | null = await tryResolve();
    if (id) {
      this.baseFolderId = id;
      return;
    }

    // Create path recursively
    const segments = configured.split('/').filter(Boolean);
    let parentId: string | 'root' = 'root';
    for (const segment of segments) {
      // Try to find child under parent
      let childId: string | null = null;
      const listUrl = parentId === 'root'
        ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
        : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
      const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (listRes.ok) {
        const data = await listRes.json() as { value?: Array<{ id: string; name: string; folder?: unknown }> };
        const match = (data.value || []).find(x => x.name === segment && x.folder);
        if (match) childId = match.id;
      }
      if (!childId) {
        const createUrl = parentId === 'root'
          ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
          : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: segment, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' })
        });
        if (!createRes.ok) {
          const txt = await createRes.text().catch(() => '');
          throw new StorageError(`Fehler beim Erstellen des Basisordners "${segment}": ${txt || createRes.statusText}`,'API_ERROR', this.id);
        }
        const created = await createRes.json() as { id: string };
        childId = created.id;
      }
      parentId = childId as string;
    }
    this.baseFolderId = parentId;
  }

  private loadTokens() {
    // Server-Kontext: Tokens aus der Library-Konfiguration lesen (DB)
    if (typeof window === 'undefined') {
      try {
        const cfg = this.library.config as unknown as {
          accessToken?: string; refreshToken?: string; tokenExpiry?: number | string
        } | undefined;
        if (cfg?.accessToken && cfg?.refreshToken) {
          this.accessToken = cfg.accessToken;
          this.refreshToken = cfg.refreshToken;
          this.tokenExpiry = Number(cfg.tokenExpiry || 0);
          this.authenticated = true;
          console.log('[OneDriveProvider] Tokens aus Library-Konfiguration geladen (Server-Kontext)');
        }
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus Library-Konfiguration:', error);
      }
      return;
    }

    // Client-Kontext: Tokens aus localStorage
    try {
      const tokensJson = localStorage.getItem(`onedrive_tokens_${this.library.id}`);
      if (tokensJson) {
        const tokens = JSON.parse(tokensJson);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.tokenExpiry = tokens.expiry;
        this.authenticated = true;
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage geladen`);
      }
    } catch (error) {
      console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus localStorage:', error);
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
    // Konvertiere expiresIn (Sekunden) in Millisekunden und addiere aktuelle Zeit
    const expiry = Date.now() + (expiresIn * 1000);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = expiry;
    this.authenticated = true;

    // Client-Kontext: Tokens im localStorage persistieren
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`onedrive_tokens_${this.library.id}`, JSON.stringify({
          accessToken,
          refreshToken,
          expiry
        }));
        
        console.log('[OneDriveProvider] Tokens im localStorage gespeichert', {
          libraryId: this.library.id,
          expiresIn: `${expiresIn} Sekunden`,
          expiryTime: new Date(expiry).toISOString()
        });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens im localStorage:', error);
      }
    }

    // Server-Kontext: Tokens in der Library-Konfiguration persistieren (DB)
    if (typeof window === 'undefined') {
      try {
        await fetch(this.getApiUrl(`/api/libraries/${this.library.id}/tokens`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Request': '1' },
          body: JSON.stringify({ accessToken, refreshToken, tokenExpiry: Math.floor(expiry / 1000).toString() })
        });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens in der DB:', error);
      }
    }
  }

  private async clearTokens() {
    // Verhindere mehrfache gleichzeitige Aufrufe
    if (this.clearingTokens) {
      console.log('[OneDriveProvider] Token-Löschung läuft bereits, überspringe...');
      return;
    }
    this.clearingTokens = true;

    // Client: localStorage räumen
    if (typeof window !== 'undefined') {
      try {
        const localStorageKey = `onedrive_tokens_${this.library.id}`;
        localStorage.removeItem(localStorageKey);
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage entfernt`);
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens aus localStorage:', error);
      }
    }

    // Server: DB-Eintrag löschen
    if (typeof window === 'undefined') {
      try {
        await fetch(this.getApiUrl(`/api/libraries/${this.library.id}/tokens`), { method: 'DELETE', headers: { 'X-Internal-Request': '1' } });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens in der DB:', error);
      }
    }

    this.clearingTokens = false;
    
    // Setze lokale Variablen zurück
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
    this.authenticated = false;
  }

  private async loadOAuthDefaults() {
    try {
      // Im Server-Kontext (kein window-Objekt) die Umgebungsvariable direkt lesen
      if (typeof window === 'undefined') {
        const redirectUri = process.env.MS_REDIRECT_URI || '';
        if (redirectUri) {
          this.oauthDefaults = {
            tenantId: '',
            clientId: '',
            clientSecret: '',
            redirectUri
          };
          console.log('[OneDriveProvider] OAuth-Defaults aus Umgebungsvariablen geladen (Server-Kontext)');
        }
        return;
      }
      
      // Im Client-Kontext den API-Call machen
      const response = await fetch(this.getApiUrl('/api/settings/oauth-defaults'));
      if (response.ok) {
        const data = await response.json();
        if (data.hasDefaults) {
          this.oauthDefaults = data.defaults;
          console.log('[OneDriveProvider] OAuth-Defaults geladen');
        }
      }
    } catch (error) {
      console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
    }
  }

  private getConfigValue(key: 'tenantId' | 'clientId' | 'clientSecret' | 'redirectUri'): string {
    // Erst in der Bibliotheks-Konfiguration nachschauen
    const value = this.library.config?.[key] as string;
    if (value) return value;
    
    // Für clientId und clientSecret keine Defaults verwenden - diese müssen explizit gesetzt werden
    if (key === 'clientId' || key === 'clientSecret') {
      return ''; // Leere Zeichenkette zurückgeben, damit wir prüfen können, ob der Wert fehlt
    }
    
    // Dann in den geladenen OAuth-Defaults
    if (this.oauthDefaults && this.oauthDefaults[key]) {
      return this.oauthDefaults[key];
    }
    
    // Fallback für tenantId
    if (key === 'tenantId') return 'common';
    
    // Fallback für redirectUri
    if (key === 'redirectUri') {
      // Im Server-Kontext direkt aus der Umgebungsvariable lesen
      if (typeof window === 'undefined' && process.env.MS_REDIRECT_URI) {
        return process.env.MS_REDIRECT_URI;
      }
      
      // Im Client-Kontext aus OAuth-Defaults
      if (this.oauthDefaults?.redirectUri) {
        return this.oauthDefaults.redirectUri;
      }
      
      throw new StorageError(
        "Fehlende Redirect URI in der Umgebungskonfiguration",
        "CONFIG_ERROR",
        this.id
      );
    }
    
    return '';
  }

  public async getAuthUrl(): Promise<string> {
    // Stelle sicher, dass OAuth-Defaults geladen sind
    if (!this.oauthDefaults) {
      try {
        await this.loadOAuthDefaults();
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
      }
    }

    const tenantId = this.getConfigValue('tenantId');
    const clientId = this.getConfigValue('clientId');
    const redirectUri = this.getConfigValue('redirectUri');

    if (!clientId) {
      throw new StorageError(
        "Fehlende Client ID für OneDrive-Authentifizierung",
        "CONFIG_ERROR",
        this.id
      );
    }

    if (!redirectUri) {
      throw new StorageError(
        "Fehlende Redirect URI für OneDrive-Authentifizierung",
        "CONFIG_ERROR",
        this.id
      );
    }

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=Files.ReadWrite offline_access`;
  }

  public async authenticate(code: string): Promise<boolean> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      const tenantId = this.getConfigValue('tenantId');
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        throw new StorageError(
          `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`,
          "CONFIG_ERROR",
          this.id
        );
      }

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Token-Austausch fehlgeschlagen: ${errorData.error_description || response.statusText}`,
          "AUTH_ERROR",
          this.id
        );
      }

      const data = await response.json() as TokenResponse;
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return true;
    } catch (error) {
      console.error('[OneDriveProvider] Authentifizierungsfehler:', error);
      await this.clearTokens();
      throw error;
    }
  }

  public isAuthenticated(): boolean {
    return this.authenticated && !!this.accessToken;
  }

  private async ensureAccessToken(): Promise<string> {
    // Wenn kein Token vorhanden, Fehler werfen
    if (!this.accessToken) {
      throw new StorageError(
        "Nicht authentifiziert",
        "AUTH_REQUIRED",
        this.id
      );
    }

    // Wenn Token in weniger als 5 Minuten abläuft, versuche Refresh
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 Minuten in Millisekunden
    const now = Date.now();
    const timeUntilExpiry = this.tokenExpiry - now;
    
    // Log Token-Status
    console.log('[OneDriveProvider] Token-Status:', {
      libraryId: this.library.id,
      tokenExpiry: new Date(this.tokenExpiry).toISOString(),
      currentTime: new Date(now).toISOString(),
      timeUntilExpiry: `${Math.floor(timeUntilExpiry / 1000)} Sekunden`,
      hasRefreshToken: !!this.refreshToken,
      isExpired: this.tokenExpiry <= now,
      refreshBuffer: `${FIVE_MINUTES / 1000} Sekunden`
    });

    // Nur refreshen wenn:
    // 1. Token abgelaufen ist ODER
    // 2. Token läuft in weniger als 5 Minuten ab UND
    // 3. Refresh-Token vorhanden ist UND
    // 4. Kein Refresh bereits läuft
    if (
      (this.tokenExpiry <= now || timeUntilExpiry <= FIVE_MINUTES) && 
      this.refreshToken && 
      !this.refreshPromise
    ) {
      await this.refreshAccessToken();
    } else if (this.refreshPromise) {
      // Wenn bereits ein Refresh läuft, warte darauf
      console.log('[OneDriveProvider] Token-Refresh läuft bereits, warte auf Abschluss...');
      await this.refreshPromise;
    }

    return this.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    // Wenn bereits ein Refresh läuft, warte auf dessen Abschluss
    if (this.refreshPromise) {
      console.log('[OneDriveProvider] Token-Refresh läuft bereits, warte auf Abschluss...');
      return this.refreshPromise;
    }

    // Erstelle ein neues Refresh-Promise
    this.refreshPromise = (async () => {
      try {
        if (!this.refreshToken) {
          throw new StorageError(
            "Kein Refresh-Token verfügbar",
            "AUTH_ERROR",
            this.id
          );
        }

        // Token-Refresh über die Server-Route durchführen (vermeidet CORS-Probleme)
        console.log('[OneDriveProvider] Führe Token-Refresh über Server-Route durch');
        
        const response = await fetch(this.getApiUrl('/api/auth/onedrive/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': '1'
          },
          body: JSON.stringify({
            libraryId: this.library.id,
            refreshToken: this.refreshToken
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new StorageError(
            `Token-Aktualisierung fehlgeschlagen: ${errorData.details || errorData.error || response.statusText}`,
            "AUTH_ERROR",
            this.id
          );
        }

        const data = await response.json();
        await this.saveTokens(data.accessToken, data.refreshToken, data.expiresIn);
        console.log('[OneDriveProvider] Token erfolgreich über Server erneuert');
      } catch (error) {
        console.error('[OneDriveProvider] Fehler bei Token-Aktualisierung:', error);
        await this.clearTokens();
        throw error;
      } finally {
        // Lösche das Promise nach Abschluss
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Konvertiert OneDrive-Dateiinformationen in ein StorageItem
  private mapOneDriveFileToStorageItem(file: OneDriveFile): StorageItem {
    const metadata: StorageItemMetadata = {
      name: file.name,
      size: file.size,
      modifiedAt: new Date(file.lastModifiedDateTime),
      mimeType: file.file?.mimeType || (file.folder ? 'application/folder' : 'application/octet-stream'),
    };

    return {
      id: file.id,
      parentId: file.parentReference?.id || 'root',
      type: file.folder ? 'folder' : 'file',
      metadata
    };
  }

  // StorageProvider Methoden

  async validateConfiguration(): Promise<StorageValidationResult> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      // Prüfe, ob die nötigen Konfigurationswerte vorhanden sind
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        return {
          isValid: false,
          error: `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`
        };
      }

      // Wenn wir keinen Access Token haben, ist Konfiguration gültig,
      // aber Authentifizierung erforderlich
      if (!this.isAuthenticated()) {
        return {
          isValid: true,
          error: "Authentifizierung erforderlich"
        };
      }

      // Mit einem API-Aufruf testen, ob die Authentifizierung funktioniert
      try {
        await this.ensureAccessToken();
        const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root', {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            isValid: false,
            error: `OneDrive API-Fehler: ${errorData.error?.message || response.statusText}`
          };
        }

        return { isValid: true };
      } catch (error) {
        return {
          isValid: false,
          error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Validierung"
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Validierung"
      };
    }
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      if (folderId === 'root' && this.baseFolderId && this.baseFolderId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}/children`;
      } else if (folderId && folderId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen der Dateien: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const data = await response.json() as OneDriveItemResponse;
      return data.value.map(file => this.mapOneDriveFileToStorageItem(file));
    } catch (error) {
      console.error('[OneDriveProvider] listItemsById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Auflisten der Dateien",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root';
      if (itemId && itemId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen der Datei: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const file = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(file);
    } catch (error) {
      console.error('[OneDriveProvider] getItemById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen der Datei",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      let url;
      if (parentId === 'root') {
        if (this.baseFolderId && this.baseFolderId !== 'root') {
          url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}/children`;
        } else {
          url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
        }
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Erstellen des Ordners: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const folder = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(folder);
    } catch (error) {
      console.error('[OneDriveProvider] createFolder Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Erstellen des Ordners",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht gelöscht werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        // Bei DELETE gibt es möglicherweise keine JSON-Antwort
        const errorText = await response.text();
        throw new StorageError(
          `Fehler beim Löschen des Elements: ${errorText || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }
    } catch (error) {
      console.error('[OneDriveProvider] deleteItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht verschoben werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Zuerst die Informationen des Items abrufen, um den Namen zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!itemResponse.ok) {
        const errorData = await itemResponse.json();
        throw new StorageError(
          `Fehler beim Abrufen der Item-Informationen: ${errorData.error?.message || itemResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      // Verschieben des Items
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      const parentReference = newParentId === 'root' 
        ? { id: 'root' } 
        : { id: newParentId };

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentReference
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Verschieben des Elements: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }
    } catch (error) {
      console.error('[OneDriveProvider] moveItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Verschieben",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht umbenannt werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Umbenennen des Items über die Microsoft Graph API
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Umbenennen des Elements: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const renamedFile = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(renamedFile);
    } catch (error) {
      console.error('[OneDriveProvider] renameItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Umbenennen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      let url;
      if (parentId === 'root') {
        if (this.baseFolderId && this.baseFolderId !== 'root') {
          url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}:/${file.name}:/content`;
        } else {
          url = `https://graph.microsoft.com/v1.0/me/drive/root:/${file.name}:/content`;
        }
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${file.name}:/content`;
      }

      // Datei als ArrayBuffer lesen
      const arrayBuffer = await file.arrayBuffer();

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: arrayBuffer
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Hochladen der Datei: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const uploadedFile = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(uploadedFile);
    } catch (error) {
      console.error('[OneDriveProvider] uploadFile Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Hochladen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (fileId === 'root') {
        throw new StorageError(
          "Der Root-Ordner hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Dateiinformationen abrufen, um den MIME-Typ zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!itemResponse.ok) {
        const errorData = await itemResponse.json();
        throw new StorageError(
          `Fehler beim Abrufen der Dateiinformationen: ${errorData.error?.message || itemResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const fileInfo = await itemResponse.json() as OneDriveFile;
      
      if (fileInfo.folder) {
        throw new StorageError(
          "Der angegebene Pfad ist ein Ordner und hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Dateiinhalt abrufen
      const contentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!contentResponse.ok) {
        throw new StorageError(
          `Fehler beim Abrufen des Dateiinhalts: ${contentResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const blob = await contentResponse.blob();
      const mimeType = fileInfo.file?.mimeType || contentResponse.headers.get('content-type') || 'application/octet-stream';

      return { blob, mimeType };
    } catch (error) {
      console.error('[OneDriveProvider] getBinary Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen des Binärinhalts",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }



  async getPathById(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      await this.ensureBaseFolderResolved();
      
      if (itemId === 'root') {
        return '/';
      }

      // Item-Informationen abrufen
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen des Pfads: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const item = await response.json() as OneDriveFile;

      // Pfad aus parentReference extrahieren
      if (item.parentReference?.path) {
        // Entfernen von "/drive/root:" vom Pfad
        let path = item.parentReference.path.replace('/drive/root:', '');
        
        // Füge Dateinamen hinzu
        path = `${path}/${item.name}`;
        
        // Formatiere den Pfad
        path = path.replace(/^\/+|\/+$/g, ''); // Entferne führende/nachfolgende Slashes
        // Basispfad entfernen, wenn konfiguriert
        if (this.basePath && path.startsWith(this.basePath.replace(/^\/+/, ''))) {
          let rel = path.substring(this.basePath.replace(/^\/+/, '').length);
          rel = rel.replace(/^\/+/, '');
          return rel ? `/${rel}` : '/';
        }
        return path ? `/${path}` : '/';
      }
      
      return item.name;
    } catch (error) {
      console.error('[OneDriveProvider] getPathById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen des Pfads",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?select=@microsoft.graph.downloadUrl`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data['@microsoft.graph.downloadUrl']) {
        throw new Error('Keine Download-URL in der API-Antwort');
      }

      return data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('[OneDriveProvider] getDownloadUrl Fehler:', error);
      throw new StorageError('Fehler beim Abrufen der Download-URL: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?select=@microsoft.graph.downloadUrl`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data['@microsoft.graph.downloadUrl']) {
        throw new Error('Keine Streaming-URL in der API-Antwort');
      }

      return data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('[OneDriveProvider] getStreamingUrl Fehler:', error);
      throw new StorageError('Fehler beim Abrufen der Streaming-URL: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    if (itemId === 'root') {
      // Root-Item erzeugen
      return [
        {
          id: 'root',
          parentId: '',
          type: 'folder',
          metadata: {
            name: 'root',
            size: 0,
            modifiedAt: new Date(),
            mimeType: 'application/folder'
          }
        }
      ];
    }
    const path = await this.getPathById(itemId); // z.B. /foo/bar/baz
    const segments = path.split('/').filter(Boolean);
    let parentId = 'root';
    const pathItems: StorageItem[] = [];
    for (const segment of segments) {
      const children = await this.listItemsById(parentId);
      const folder = children.find(child => child.metadata.name === segment && child.type === 'folder');
      if (!folder) break;
      // Eltern in den Cache schreiben, falls sie fehlen
      if (parentId !== 'root' && !pathItems.find(item => item.id === parentId)) {
        try {
          const parentItem = await this.getItemById(parentId);
          pathItems.push(parentItem);
        } catch {}
      }
      pathItems.push(folder);
      parentId = folder.id;
    }
    return [{
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: 'root',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    }, ...pathItems];
  }
} 
```

```typescript
import { StorageFactory } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/types';
import { LibraryService } from '@/lib/services/library-service';

export async function getServerProvider(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';

  const libraryService = LibraryService.getInstance();
  const libraries = await libraryService.getUserLibraries(userEmail);
  const lib = libraries.find(l => l.id === libraryId);
  if (!lib) throw new Error('Library nicht gefunden');

  const factory = StorageFactory.getInstance();
  factory.setApiBaseUrl(baseUrl);
  factory.setUserEmail(userEmail);
  factory.setLibraries([{ 
    id: lib.id,
    label: lib.label,
    type: lib.type,
    path: lib.path,
    isEnabled: lib.isEnabled,
    config: (lib.config as unknown as Record<string, unknown>) || {}
  }]);

  const provider = await factory.getProvider(lib.id);
  const validation = await provider.validateConfiguration();
  if (!validation.isValid) throw new Error(validation.error || 'Ungültige Provider-Konfiguration');
  return provider;
}





```

Ich passe die Typisierung in `src/app/api/metadata/template/run/route.ts` an, damit `config` dem erwarteten `ClientLibrary`-Schema entspricht. Danach starte ich den Build erneut.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { LibraryService } from '@/lib/services/library-service';
import { StorageFactory } from '@/lib/storage/storage-factory';

function stripFrontmatter(markdown: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n?/;
  return markdown.replace(fm, '');
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Kein Benutzer-E-Mail gefunden' }, { status: 401 });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : '';
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    const ingest = Boolean(body.ingest);
    if (!libraryId || !fileId) return NextResponse.json({ error: 'libraryId und fileId erforderlich' }, { status: 400 });

    // Markdown laden (provider-agnostisch)
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined);
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });

    let markdown = '';
    const factory = StorageFactory.getInstance();
    factory.setLibraries([{ id: lib.id, label: lib.label, type: lib.type, path: lib.path, isEnabled: lib.isEnabled, config: (lib.config as unknown as Record<string, unknown>) || {} }]);
    const provider = await factory.getProvider(lib.id);
    const bin = await provider.getBinary(fileId);
    markdown = await bin.blob.text();

    const extractedText = stripFrontmatter(markdown);

    // Internen Job erstellen (ohne PDF-Extraktion) – reuse bestehende Callback-Logik
    const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
    if (!internalToken) return NextResponse.json({ error: 'INTERNAL_TEST_TOKEN nicht konfiguriert' }, { status: 500 });

    const createRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''}/api/external/jobs/internal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ libraryId, parentId: 'root', fileName: 'shadow-twin.md', userEmail: '', targetLanguage: 'de', extractionMethod: 'native', includeImages: false })
    });
    if (!createRes.ok) {
      const t = await createRes.text().catch(() => 'Fehler');
      return NextResponse.json({ error: `Job konnte nicht erstellt werden: ${t}` }, { status: 500 });
    }
    const { jobId, callbackUrl } = await createRes.json() as { jobId: string; callbackUrl: string };

    // useIngestionPipeline optional setzen
    if (ingest) {
      const repo = new ExternalJobsRepository();
      await repo.mergeParameters(jobId, { useIngestionPipeline: true });
    }

    // Callback direkt füttern – nur Template/Store Pfade werden greifen
    const cbRes = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ data: { extracted_text: extractedText } })
    });
    if (!cbRes.ok) {
      const t = await cbRes.text().catch(() => 'Fehler');
      return NextResponse.json({ error: `Callback fehlgeschlagen: ${t}` }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



```

```typescriptreact
"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

interface JobReportTabProps {
  libraryId: string
  fileId: string
  fileName?: string
  provider?: StorageProvider | null
  // Quelle der Metadaten steuern: 'merged' = cumulativeMeta + Frontmatter (Standard),
  // 'frontmatter' = ausschließlich Frontmatter aus Markdown anzeigen
  sourceMode?: 'merged' | 'frontmatter'
  // Darstellungsmodus: 'full' zeigt Kopf/Steps/Logs/Parameter; 'metaOnly' zeigt nur Metadaten/Kapitel/TOC
  viewMode?: 'full' | 'metaOnly'
  // Optional explizite Markdown-Datei-ID (Shadow‑Twin). Überschreibt auto-Erkennung.
  mdFileId?: string | null
}

interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: { message: string }; details?: { skipped?: boolean } }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        // 1) Versuche Job über result.savedItemId (Shadow‑Twin) zu finden
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        UILogger.debug('JobReportTab', 'Request byResultItemId', { url: byResultUrl.toString() })
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        UILogger.debug('JobReportTab', 'Result byResultItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })

        // 2) Fallback: über correlation.source.itemId (Originaldatei)
        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceItemId', { url: bySourceUrl.toString() })
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        // 3) Fallback: über correlation.source.name (Dateiname der Quelle)
        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          // Wenn wir den tatsächlichen Dateinamen kennen, verwende ihn.
          // Für Shadow‑Twins (z. B. name.de.md) versuche das Basis‑PDF (name.pdf).
          let candidate = (fileName && typeof fileName === 'string') ? fileName : (fileId.includes('/') ? (fileId.split('/').pop() as string) : fileId)
          const parts = candidate.split('.')
          if (parts.length >= 3) {
            const ext1 = parts[parts.length - 1].toLowerCase()
            const ext2 = parts[parts.length - 2].toLowerCase()
            if ((ext1 === 'md' || ext1 === 'mdx') && /^[a-z]{2}$/i.test(ext2)) {
              candidate = parts.slice(0, -2).join('.') + '.pdf'
            }
          }
          byNameUrl.searchParams.set('bySourceName', candidate)
          byNameUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceName', { url: byNameUrl.toString(), nameOnly: candidate, originalFileName: fileName })
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceName', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        if (!cancelled) setJob(j)
        if (j) UILogger.info('JobReportTab', 'Job gefunden', { jobId: j.jobId, status: j.status })
        else UILogger.warn('JobReportTab', 'Kein Job gefunden', { libraryId, fileId })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId])

  // Wenn Template benutzt wurde, lade dessen Inhalt aus /templates und extrahiere Frontmatter-Schlüssel
  useEffect(() => {
    async function loadTemplateFields() {
      try {
        setTemplateFields(null)
        const tpl = job?.cumulativeMeta && typeof (job.cumulativeMeta as unknown) === 'object'
          ? (job.cumulativeMeta as Record<string, unknown>)['template_used']
          : undefined
        const templateName = typeof tpl === 'string' ? tpl : undefined
        if (!templateName || !provider) return
        const rootItems = await provider.listItemsById('root')
        const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'))
        if (!templatesFolder) return
        const tplItems = await provider.listItemsById(templatesFolder.id)
        const match = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === templateName.toLowerCase()))
        if (!match) return
        const bin = await provider.getBinary(match.id)
        const text = await bin.blob.text()
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            if (k) keys.push(k)
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
      } catch (e) {
        UILogger.warn('JobReportTab', 'Template-Felder konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadTemplateFields()
  }, [job, provider])

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (Fallback, falls cumulativeMeta unvollständig ist)
  useEffect(() => {
    async function loadFrontmatter() {
      try {
        if (!provider) return
        const mdId = (mdFileId || (job?.result?.savedItemId as string | undefined) || fileId)
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        const m = text.match(/^---[\s\S]*?---/)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!m, length: m ? m[0].length : 0 })
        if (!m) { setFrontmatterMeta(null); return }
        const fm = m[0]
        const meta: Record<string, unknown> = {}
        // Einfache Parser-Heuristiken für häufige Felder (JSON-ähnliche Werte werden geparst)
        const tryParse = (val: string): unknown => {
          const trimmed = val.trim()
          if (!trimmed) return ''
          if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
          if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed)
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try { return JSON.parse(trimmed) } catch { return trimmed }
          }
          return trimmed.replace(/^"|"$/g, '')
        }
        // Versuche kompakte Arrays (z. B. authors: ["..."])
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            const v = t.slice(idx + 1)
            meta[k] = tryParse(v)
          }
        }
        // Spezialfälle: mehrzeilige JSON-Blöcke für chapters/toc extrahieren
        const cap = /\nchapters:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (cap && cap[1]) {
          try { meta['chapters'] = JSON.parse(cap[1]) } catch { /* ignore */ }
        }
        const tocCap = /\ntoc:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (tocCap && tocCap[1]) {
          try { meta['toc'] = JSON.parse(tocCap[1]) } catch { /* ignore */ }
        }
        UILogger.info('JobReportTab', 'Frontmatter: Keys & Counts', {
          keys: Object.keys(meta),
          chapters: Array.isArray(meta['chapters']) ? (meta['chapters'] as unknown[]).length : 0,
          toc: Array.isArray(meta['toc']) ? (meta['toc'] as unknown[]).length : 0,
        })
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, fileId, mdFileId, job?.result?.savedItemId, sourceMode])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'full' && job && (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Job {job.jobId}</div>
            <div className="text-xs text-muted-foreground">{job.job_type} · {job.operation} · {new Date(job.updatedAt).toLocaleString()}</div>
          </div>
          <div className="inline-flex items-center rounded px-2 py-0.5 bg-muted text-xs">{job.status}</div>
        </div>
      )}

      {/* Template Hinweis (im Frontmatter-only-Modus ausgeblendet) */}
      {sourceMode !== 'frontmatter' && typeof job.cumulativeMeta?.template_used === 'string' && (
        <div className="text-xs text-muted-foreground">Template: {String(job.cumulativeMeta.template_used)}</div>
      )}

      {/* Schritte mit Ampel-Logik */}
      {viewMode === 'full' && Array.isArray(job.steps) && job.steps.length > 0 && (
        <div>
          <div className="font-medium mb-1">Schritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {job.steps.map((s) => {
              // Geplante Phasen ermitteln (neue Flags bevorzugt, sonst phases)
              const p = (job.parameters || {}) as Record<string, unknown>
              const hasNewFlags = typeof p['doExtractPDF'] === 'boolean' || typeof p['doExtractMetadata'] === 'boolean' || typeof p['doIngestRAG'] === 'boolean'
              const phases = hasNewFlags
                ? {
                    extract: p['doExtractPDF'] === true,
                    template: p['doExtractMetadata'] === true,
                    ingest: p['doIngestRAG'] === true,
                  }
                : ((p['phases'] as { extract?: boolean; template?: boolean; ingest?: boolean }) || {})

              const planned = (() => {
                const n = s.name
                if (n === 'extract_pdf') return phases.extract === true
                if (n === 'transform_template' || n === 'store_shadow_twin') return phases.template === true
                if (n === 'ingest_rag') return phases.ingest === true
                return false
              })()

              // Ampel-Status ableiten
              const skipped = !!(s as { details?: { skipped?: boolean } }).details?.skipped
              let icon = '○'
              let cls = 'text-muted-foreground'
              if (s.status === 'failed') { icon = '✕'; cls = 'text-red-600' }
              else if (s.status === 'running') { icon = '◐'; cls = 'text-yellow-600' }
              else if (s.status === 'completed') { icon = skipped ? '○' : '✓'; cls = skipped ? 'text-gray-400' : 'text-green-600' }
              else if (s.status === 'pending') { icon = planned ? '•' : '○'; cls = planned ? 'text-yellow-600' : 'text-muted-foreground' }

              const time = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ''
              return (
                <div key={s.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${cls}`}>
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                  {time ? <span className="opacity-70">{time}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge */}
      {(() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? templateFields
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc')
        if (flatKeys.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium">{k}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{valueStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch) */}
      {(() => {
        const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
          : ((job.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
        if (!Array.isArray(chapters) || chapters.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Kapitel</div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">L</th>
                  <th className="py-1 pr-2">Start</th>
                  <th className="py-1 pr-2">Ende</th>
                  <th className="py-1 pr-2">Seiten</th>
                  <th className="py-1 pr-2">Summary</th>
                  <th className="py-1 pr-2">Keywords</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c, i) => {
                  const order = typeof c.order === 'number' ? c.order : (i + 1)
                  const level = typeof c.level === 'number' ? c.level : undefined
                  const title = typeof c.title === 'string' ? c.title : ''
                  const startPage = typeof c.startPage === 'number' ? c.startPage : (c.startPage === null ? '' : '')
                  const endPage = typeof c.endPage === 'number' ? c.endPage : (c.endPage === null ? '' : '')
                  const pageCount = typeof c.pageCount === 'number' ? c.pageCount : (c.pageCount === null ? '' : '')
                  const summaryVal = typeof c.summary === 'string' ? c.summary : ''
                  const summary = summaryVal.length > 160 ? `${summaryVal.slice(0, 160)}…` : summaryVal
                  const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
                  return (
                    <tr key={`${title}-${order}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top">{order}</td>
                      <td className="py-1 pr-2 align-top">
                        <span className="whitespace-pre-wrap break-words">{title}</span>
                      </td>
                      <td className="py-1 pr-2 align-top">{typeof level === 'number' ? level : ''}</td>
                      <td className="py-1 pr-2 align-top">{startPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{endPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{pageCount as string | number}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{summary}</td>
                      <td className="py-1 pr-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {keywords.map(k => (
                            <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Evidenz separat (erste Zeichen beschränkt) */}
            <div className="mt-1 text-xs text-muted-foreground">
              {chapters.map((c, i) => {
                const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
                if (!ev) return null
                const title = typeof c.title === 'string' ? c.title : `Kapitel ${i+1}`
                const preview = ev.length > 140 ? `${ev.slice(0, 140)}…` : ev
                return (
                  <div key={`ev-${i}`} className="truncate">
                    <span className="font-medium">{title}:</span> <span className="opacity-80">{preview}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Inhaltsverzeichnis */}
      {(() => {
        const toc: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.toc) ? (frontmatterMeta?.toc as Array<Record<string, unknown>>) : [])
          : ((job.cumulativeMeta as unknown as { toc?: Array<Record<string, unknown>> }).toc || [])
        if (!Array.isArray(toc) || toc.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Inhaltsverzeichnis</div>
          <div className="overflow-auto max-h-40">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">Seite</th>
                  <th className="py-1 pr-2">L</th>
                </tr>
              </thead>
              <tbody>
                {toc.map((t, i) => {
                  const title = typeof t.title === 'string' ? t.title : ''
                  const page = typeof t.page === 'number' ? t.page : ''
                  const level = typeof t.level === 'number' ? t.level : ''
                  return (
                    <tr key={`${title}-${i}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{title}</td>
                      <td className="py-1 pr-2 align-top">{page}</td>
                      <td className="py-1 pr-2 align-top">{level}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {viewMode === 'full' && job.ingestion && (
        <div>
          <div className="font-medium mb-1">Ingestion</div>
          <div className="text-xs text-muted-foreground">{job.ingestion.index || '—'} · Vektoren: {job.ingestion.vectorsUpserted ?? '—'} · {job.ingestion.upsertAt ? new Date(job.ingestion.upsertAt).toLocaleString() : '—'}</div>
        </div>
      )}

      {viewMode === 'full' && Array.isArray(job.logs) && job.logs.length > 0 && (
        <div>
          <div className="font-medium mb-1">Logs (neueste zuerst)</div>
          <ul className="space-y-0.5 max-h-48 overflow-auto">
            {[...job.logs].reverse().slice(0, 30).map((l, i) => (
              <li key={i} className="text-xs">
                {new Date(l.timestamp).toLocaleTimeString()} · {l.phase || '—'} · {typeof l.progress === 'number' ? `${l.progress}% · ` : ''}{l.message || ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameter am Ende */}
      {viewMode === 'full' && job.parameters && (
        <div>
          <div className="font-medium mb-1">Parameter</div>
          <pre className="bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(job.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}



```

Ich fixe die Nullability-Absicherung in `job-report-tab.tsx` für den Template-Hinweis und starte anschließend den Build erneut.

```typescriptreact
"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

interface JobReportTabProps {
  libraryId: string
  fileId: string
  fileName?: string
  provider?: StorageProvider | null
  // Quelle der Metadaten steuern: 'merged' = cumulativeMeta + Frontmatter (Standard),
  // 'frontmatter' = ausschließlich Frontmatter aus Markdown anzeigen
  sourceMode?: 'merged' | 'frontmatter'
  // Darstellungsmodus: 'full' zeigt Kopf/Steps/Logs/Parameter; 'metaOnly' zeigt nur Metadaten/Kapitel/TOC
  viewMode?: 'full' | 'metaOnly'
  // Optional explizite Markdown-Datei-ID (Shadow‑Twin). Überschreibt auto-Erkennung.
  mdFileId?: string | null
}

interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: { message: string }; details?: { skipped?: boolean } }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        // 1) Versuche Job über result.savedItemId (Shadow‑Twin) zu finden
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        UILogger.debug('JobReportTab', 'Request byResultItemId', { url: byResultUrl.toString() })
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        UILogger.debug('JobReportTab', 'Result byResultItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })

        // 2) Fallback: über correlation.source.itemId (Originaldatei)
        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceItemId', { url: bySourceUrl.toString() })
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        // 3) Fallback: über correlation.source.name (Dateiname der Quelle)
        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          // Wenn wir den tatsächlichen Dateinamen kennen, verwende ihn.
          // Für Shadow‑Twins (z. B. name.de.md) versuche das Basis‑PDF (name.pdf).
          let candidate = (fileName && typeof fileName === 'string') ? fileName : (fileId.includes('/') ? (fileId.split('/').pop() as string) : fileId)
          const parts = candidate.split('.')
          if (parts.length >= 3) {
            const ext1 = parts[parts.length - 1].toLowerCase()
            const ext2 = parts[parts.length - 2].toLowerCase()
            if ((ext1 === 'md' || ext1 === 'mdx') && /^[a-z]{2}$/i.test(ext2)) {
              candidate = parts.slice(0, -2).join('.') + '.pdf'
            }
          }
          byNameUrl.searchParams.set('bySourceName', candidate)
          byNameUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceName', { url: byNameUrl.toString(), nameOnly: candidate, originalFileName: fileName })
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceName', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        if (!cancelled) setJob(j)
        if (j) UILogger.info('JobReportTab', 'Job gefunden', { jobId: j.jobId, status: j.status })
        else UILogger.warn('JobReportTab', 'Kein Job gefunden', { libraryId, fileId })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId])

  // Wenn Template benutzt wurde, lade dessen Inhalt aus /templates und extrahiere Frontmatter-Schlüssel
  useEffect(() => {
    async function loadTemplateFields() {
      try {
        setTemplateFields(null)
        const tpl = job?.cumulativeMeta && typeof (job.cumulativeMeta as unknown) === 'object'
          ? (job.cumulativeMeta as Record<string, unknown>)['template_used']
          : undefined
        const templateName = typeof tpl === 'string' ? tpl : undefined
        if (!templateName || !provider) return
        const rootItems = await provider.listItemsById('root')
        const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'))
        if (!templatesFolder) return
        const tplItems = await provider.listItemsById(templatesFolder.id)
        const match = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === templateName.toLowerCase()))
        if (!match) return
        const bin = await provider.getBinary(match.id)
        const text = await bin.blob.text()
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            if (k) keys.push(k)
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
      } catch (e) {
        UILogger.warn('JobReportTab', 'Template-Felder konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadTemplateFields()
  }, [job, provider])

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (Fallback, falls cumulativeMeta unvollständig ist)
  useEffect(() => {
    async function loadFrontmatter() {
      try {
        if (!provider) return
        const mdId = (mdFileId || (job?.result?.savedItemId as string | undefined) || fileId)
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        const m = text.match(/^---[\s\S]*?---/)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!m, length: m ? m[0].length : 0 })
        if (!m) { setFrontmatterMeta(null); return }
        const fm = m[0]
        const meta: Record<string, unknown> = {}
        // Einfache Parser-Heuristiken für häufige Felder (JSON-ähnliche Werte werden geparst)
        const tryParse = (val: string): unknown => {
          const trimmed = val.trim()
          if (!trimmed) return ''
          if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
          if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed)
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try { return JSON.parse(trimmed) } catch { return trimmed }
          }
          return trimmed.replace(/^"|"$/g, '')
        }
        // Versuche kompakte Arrays (z. B. authors: ["..."])
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            const v = t.slice(idx + 1)
            meta[k] = tryParse(v)
          }
        }
        // Spezialfälle: mehrzeilige JSON-Blöcke für chapters/toc extrahieren
        const cap = /\nchapters:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (cap && cap[1]) {
          try { meta['chapters'] = JSON.parse(cap[1]) } catch { /* ignore */ }
        }
        const tocCap = /\ntoc:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (tocCap && tocCap[1]) {
          try { meta['toc'] = JSON.parse(tocCap[1]) } catch { /* ignore */ }
        }
        UILogger.info('JobReportTab', 'Frontmatter: Keys & Counts', {
          keys: Object.keys(meta),
          chapters: Array.isArray(meta['chapters']) ? (meta['chapters'] as unknown[]).length : 0,
          toc: Array.isArray(meta['toc']) ? (meta['toc'] as unknown[]).length : 0,
        })
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, fileId, mdFileId, job?.result?.savedItemId, sourceMode])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'full' && job && (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Job {job.jobId}</div>
            <div className="text-xs text-muted-foreground">{job.job_type} · {job.operation} · {new Date(job.updatedAt).toLocaleString()}</div>
          </div>
          <div className="inline-flex items-center rounded px-2 py-0.5 bg-muted text-xs">{job.status}</div>
        </div>
      )}

      {/* Template Hinweis (im Frontmatter-only-Modus ausgeblendet) */}
      {sourceMode !== 'frontmatter' && job && typeof job.cumulativeMeta?.template_used === 'string' && (
        <div className="text-xs text-muted-foreground">Template: {String(job.cumulativeMeta.template_used)}</div>
      )}

      {/* Schritte mit Ampel-Logik */}
      {viewMode === 'full' && Array.isArray(job.steps) && job.steps.length > 0 && (
        <div>
          <div className="font-medium mb-1">Schritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {job.steps.map((s) => {
              // Geplante Phasen ermitteln (neue Flags bevorzugt, sonst phases)
              const p = (job.parameters || {}) as Record<string, unknown>
              const hasNewFlags = typeof p['doExtractPDF'] === 'boolean' || typeof p['doExtractMetadata'] === 'boolean' || typeof p['doIngestRAG'] === 'boolean'
              const phases = hasNewFlags
                ? {
                    extract: p['doExtractPDF'] === true,
                    template: p['doExtractMetadata'] === true,
                    ingest: p['doIngestRAG'] === true,
                  }
                : ((p['phases'] as { extract?: boolean; template?: boolean; ingest?: boolean }) || {})

              const planned = (() => {
                const n = s.name
                if (n === 'extract_pdf') return phases.extract === true
                if (n === 'transform_template' || n === 'store_shadow_twin') return phases.template === true
                if (n === 'ingest_rag') return phases.ingest === true
                return false
              })()

              // Ampel-Status ableiten
              const skipped = !!(s as { details?: { skipped?: boolean } }).details?.skipped
              let icon = '○'
              let cls = 'text-muted-foreground'
              if (s.status === 'failed') { icon = '✕'; cls = 'text-red-600' }
              else if (s.status === 'running') { icon = '◐'; cls = 'text-yellow-600' }
              else if (s.status === 'completed') { icon = skipped ? '○' : '✓'; cls = skipped ? 'text-gray-400' : 'text-green-600' }
              else if (s.status === 'pending') { icon = planned ? '•' : '○'; cls = planned ? 'text-yellow-600' : 'text-muted-foreground' }

              const time = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ''
              return (
                <div key={s.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${cls}`}>
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                  {time ? <span className="opacity-70">{time}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge */}
      {(() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? templateFields
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc')
        if (flatKeys.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium">{k}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{valueStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch) */}
      {(() => {
        const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
          : ((job.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
        if (!Array.isArray(chapters) || chapters.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Kapitel</div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">L</th>
                  <th className="py-1 pr-2">Start</th>
                  <th className="py-1 pr-2">Ende</th>
                  <th className="py-1 pr-2">Seiten</th>
                  <th className="py-1 pr-2">Summary</th>
                  <th className="py-1 pr-2">Keywords</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c, i) => {
                  const order = typeof c.order === 'number' ? c.order : (i + 1)
                  const level = typeof c.level === 'number' ? c.level : undefined
                  const title = typeof c.title === 'string' ? c.title : ''
                  const startPage = typeof c.startPage === 'number' ? c.startPage : (c.startPage === null ? '' : '')
                  const endPage = typeof c.endPage === 'number' ? c.endPage : (c.endPage === null ? '' : '')
                  const pageCount = typeof c.pageCount === 'number' ? c.pageCount : (c.pageCount === null ? '' : '')
                  const summaryVal = typeof c.summary === 'string' ? c.summary : ''
                  const summary = summaryVal.length > 160 ? `${summaryVal.slice(0, 160)}…` : summaryVal
                  const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
                  return (
                    <tr key={`${title}-${order}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top">{order}</td>
                      <td className="py-1 pr-2 align-top">
                        <span className="whitespace-pre-wrap break-words">{title}</span>
                      </td>
                      <td className="py-1 pr-2 align-top">{typeof level === 'number' ? level : ''}</td>
                      <td className="py-1 pr-2 align-top">{startPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{endPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{pageCount as string | number}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{summary}</td>
                      <td className="py-1 pr-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {keywords.map(k => (
                            <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Evidenz separat (erste Zeichen beschränkt) */}
            <div className="mt-1 text-xs text-muted-foreground">
              {chapters.map((c, i) => {
                const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
                if (!ev) return null
                const title = typeof c.title === 'string' ? c.title : `Kapitel ${i+1}`
                const preview = ev.length > 140 ? `${ev.slice(0, 140)}…` : ev
                return (
                  <div key={`ev-${i}`} className="truncate">
                    <span className="font-medium">{title}:</span> <span className="opacity-80">{preview}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Inhaltsverzeichnis */}
      {(() => {
        const toc: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.toc) ? (frontmatterMeta?.toc as Array<Record<string, unknown>>) : [])
          : ((job.cumulativeMeta as unknown as { toc?: Array<Record<string, unknown>> }).toc || [])
        if (!Array.isArray(toc) || toc.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Inhaltsverzeichnis</div>
          <div className="overflow-auto max-h-40">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">Seite</th>
                  <th className="py-1 pr-2">L</th>
                </tr>
              </thead>
              <tbody>
                {toc.map((t, i) => {
                  const title = typeof t.title === 'string' ? t.title : ''
                  const page = typeof t.page === 'number' ? t.page : ''
                  const level = typeof t.level === 'number' ? t.level : ''
                  return (
                    <tr key={`${title}-${i}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{title}</td>
                      <td className="py-1 pr-2 align-top">{page}</td>
                      <td className="py-1 pr-2 align-top">{level}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {viewMode === 'full' && job.ingestion && (
        <div>
          <div className="font-medium mb-1">Ingestion</div>
          <div className="text-xs text-muted-foreground">{job.ingestion.index || '—'} · Vektoren: {job.ingestion.vectorsUpserted ?? '—'} · {job.ingestion.upsertAt ? new Date(job.ingestion.upsertAt).toLocaleString() : '—'}</div>
        </div>
      )}

      {viewMode === 'full' && Array.isArray(job.logs) && job.logs.length > 0 && (
        <div>
          <div className="font-medium mb-1">Logs (neueste zuerst)</div>
          <ul className="space-y-0.5 max-h-48 overflow-auto">
            {[...job.logs].reverse().slice(0, 30).map((l, i) => (
              <li key={i} className="text-xs">
                {new Date(l.timestamp).toLocaleTimeString()} · {l.phase || '—'} · {typeof l.progress === 'number' ? `${l.progress}% · ` : ''}{l.message || ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameter am Ende */}
      {viewMode === 'full' && job.parameters && (
        <div>
          <div className="font-medium mb-1">Parameter</div>
          <pre className="bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(job.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}



```

```typescriptreact
"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

interface JobReportTabProps {
  libraryId: string
  fileId: string
  fileName?: string
  provider?: StorageProvider | null
  // Quelle der Metadaten steuern: 'merged' = cumulativeMeta + Frontmatter (Standard),
  // 'frontmatter' = ausschließlich Frontmatter aus Markdown anzeigen
  sourceMode?: 'merged' | 'frontmatter'
  // Darstellungsmodus: 'full' zeigt Kopf/Steps/Logs/Parameter; 'metaOnly' zeigt nur Metadaten/Kapitel/TOC
  viewMode?: 'full' | 'metaOnly'
  // Optional explizite Markdown-Datei-ID (Shadow‑Twin). Überschreibt auto-Erkennung.
  mdFileId?: string | null
}

interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: { message: string }; details?: { skipped?: boolean } }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        // 1) Versuche Job über result.savedItemId (Shadow‑Twin) zu finden
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        UILogger.debug('JobReportTab', 'Request byResultItemId', { url: byResultUrl.toString() })
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        UILogger.debug('JobReportTab', 'Result byResultItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })

        // 2) Fallback: über correlation.source.itemId (Originaldatei)
        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceItemId', { url: bySourceUrl.toString() })
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        // 3) Fallback: über correlation.source.name (Dateiname der Quelle)
        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          // Wenn wir den tatsächlichen Dateinamen kennen, verwende ihn.
          // Für Shadow‑Twins (z. B. name.de.md) versuche das Basis‑PDF (name.pdf).
          let candidate = (fileName && typeof fileName === 'string') ? fileName : (fileId.includes('/') ? (fileId.split('/').pop() as string) : fileId)
          const parts = candidate.split('.')
          if (parts.length >= 3) {
            const ext1 = parts[parts.length - 1].toLowerCase()
            const ext2 = parts[parts.length - 2].toLowerCase()
            if ((ext1 === 'md' || ext1 === 'mdx') && /^[a-z]{2}$/i.test(ext2)) {
              candidate = parts.slice(0, -2).join('.') + '.pdf'
            }
          }
          byNameUrl.searchParams.set('bySourceName', candidate)
          byNameUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceName', { url: byNameUrl.toString(), nameOnly: candidate, originalFileName: fileName })
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceName', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        if (!cancelled) setJob(j)
        if (j) UILogger.info('JobReportTab', 'Job gefunden', { jobId: j.jobId, status: j.status })
        else UILogger.warn('JobReportTab', 'Kein Job gefunden', { libraryId, fileId })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId])

  // Wenn Template benutzt wurde, lade dessen Inhalt aus /templates und extrahiere Frontmatter-Schlüssel
  useEffect(() => {
    async function loadTemplateFields() {
      try {
        setTemplateFields(null)
        const tpl = job?.cumulativeMeta && typeof (job.cumulativeMeta as unknown) === 'object'
          ? (job.cumulativeMeta as Record<string, unknown>)['template_used']
          : undefined
        const templateName = typeof tpl === 'string' ? tpl : undefined
        if (!templateName || !provider) return
        const rootItems = await provider.listItemsById('root')
        const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'))
        if (!templatesFolder) return
        const tplItems = await provider.listItemsById(templatesFolder.id)
        const match = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === templateName.toLowerCase()))
        if (!match) return
        const bin = await provider.getBinary(match.id)
        const text = await bin.blob.text()
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            if (k) keys.push(k)
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
      } catch (e) {
        UILogger.warn('JobReportTab', 'Template-Felder konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadTemplateFields()
  }, [job, provider])

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (Fallback, falls cumulativeMeta unvollständig ist)
  useEffect(() => {
    async function loadFrontmatter() {
      try {
        if (!provider) return
        const mdId = (mdFileId || (job?.result?.savedItemId as string | undefined) || fileId)
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        const m = text.match(/^---[\s\S]*?---/)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!m, length: m ? m[0].length : 0 })
        if (!m) { setFrontmatterMeta(null); return }
        const fm = m[0]
        const meta: Record<string, unknown> = {}
        // Einfache Parser-Heuristiken für häufige Felder (JSON-ähnliche Werte werden geparst)
        const tryParse = (val: string): unknown => {
          const trimmed = val.trim()
          if (!trimmed) return ''
          if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
          if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed)
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try { return JSON.parse(trimmed) } catch { return trimmed }
          }
          return trimmed.replace(/^"|"$/g, '')
        }
        // Versuche kompakte Arrays (z. B. authors: ["..."])
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            const v = t.slice(idx + 1)
            meta[k] = tryParse(v)
          }
        }
        // Spezialfälle: mehrzeilige JSON-Blöcke für chapters/toc extrahieren
        const cap = /\nchapters:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (cap && cap[1]) {
          try { meta['chapters'] = JSON.parse(cap[1]) } catch { /* ignore */ }
        }
        const tocCap = /\ntoc:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (tocCap && tocCap[1]) {
          try { meta['toc'] = JSON.parse(tocCap[1]) } catch { /* ignore */ }
        }
        UILogger.info('JobReportTab', 'Frontmatter: Keys & Counts', {
          keys: Object.keys(meta),
          chapters: Array.isArray(meta['chapters']) ? (meta['chapters'] as unknown[]).length : 0,
          toc: Array.isArray(meta['toc']) ? (meta['toc'] as unknown[]).length : 0,
        })
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, fileId, mdFileId, job?.result?.savedItemId, sourceMode])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'full' && job && (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Job {job.jobId}</div>
            <div className="text-xs text-muted-foreground">{job.job_type} · {job.operation} · {new Date(job.updatedAt).toLocaleString()}</div>
          </div>
          <div className="inline-flex items-center rounded px-2 py-0.5 bg-muted text-xs">{job.status}</div>
        </div>
      )}

      {/* Template Hinweis (im Frontmatter-only-Modus ausgeblendet) */}
      {sourceMode !== 'frontmatter' && job && typeof job.cumulativeMeta?.template_used === 'string' && (
        <div className="text-xs text-muted-foreground">Template: {String(job.cumulativeMeta.template_used)}</div>
      )}

      {/* Schritte mit Ampel-Logik */}
      {viewMode === 'full' && job && Array.isArray(job.steps) && job.steps.length > 0 && (
        <div>
          <div className="font-medium mb-1">Schritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {job.steps.map((s) => {
              // Geplante Phasen ermitteln (neue Flags bevorzugt, sonst phases)
              const p = (job.parameters || {}) as Record<string, unknown>
              const hasNewFlags = typeof p['doExtractPDF'] === 'boolean' || typeof p['doExtractMetadata'] === 'boolean' || typeof p['doIngestRAG'] === 'boolean'
              const phases = hasNewFlags
                ? {
                    extract: p['doExtractPDF'] === true,
                    template: p['doExtractMetadata'] === true,
                    ingest: p['doIngestRAG'] === true,
                  }
                : ((p['phases'] as { extract?: boolean; template?: boolean; ingest?: boolean }) || {})

              const planned = (() => {
                const n = s.name
                if (n === 'extract_pdf') return phases.extract === true
                if (n === 'transform_template' || n === 'store_shadow_twin') return phases.template === true
                if (n === 'ingest_rag') return phases.ingest === true
                return false
              })()

              // Ampel-Status ableiten
              const skipped = !!(s as { details?: { skipped?: boolean } }).details?.skipped
              let icon = '○'
              let cls = 'text-muted-foreground'
              if (s.status === 'failed') { icon = '✕'; cls = 'text-red-600' }
              else if (s.status === 'running') { icon = '◐'; cls = 'text-yellow-600' }
              else if (s.status === 'completed') { icon = skipped ? '○' : '✓'; cls = skipped ? 'text-gray-400' : 'text-green-600' }
              else if (s.status === 'pending') { icon = planned ? '•' : '○'; cls = planned ? 'text-yellow-600' : 'text-muted-foreground' }

              const time = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ''
              return (
                <div key={s.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${cls}`}>
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                  {time ? <span className="opacity-70">{time}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge */}
      {(() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? templateFields
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc')
        if (flatKeys.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium">{k}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{valueStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch) */}
      {(() => {
        const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
        if (!Array.isArray(chapters) || chapters.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Kapitel</div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">L</th>
                  <th className="py-1 pr-2">Start</th>
                  <th className="py-1 pr-2">Ende</th>
                  <th className="py-1 pr-2">Seiten</th>
                  <th className="py-1 pr-2">Summary</th>
                  <th className="py-1 pr-2">Keywords</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c, i) => {
                  const order = typeof c.order === 'number' ? c.order : (i + 1)
                  const level = typeof c.level === 'number' ? c.level : undefined
                  const title = typeof c.title === 'string' ? c.title : ''
                  const startPage = typeof c.startPage === 'number' ? c.startPage : (c.startPage === null ? '' : '')
                  const endPage = typeof c.endPage === 'number' ? c.endPage : (c.endPage === null ? '' : '')
                  const pageCount = typeof c.pageCount === 'number' ? c.pageCount : (c.pageCount === null ? '' : '')
                  const summaryVal = typeof c.summary === 'string' ? c.summary : ''
                  const summary = summaryVal.length > 160 ? `${summaryVal.slice(0, 160)}…` : summaryVal
                  const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
                  return (
                    <tr key={`${title}-${order}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top">{order}</td>
                      <td className="py-1 pr-2 align-top">
                        <span className="whitespace-pre-wrap break-words">{title}</span>
                      </td>
                      <td className="py-1 pr-2 align-top">{typeof level === 'number' ? level : ''}</td>
                      <td className="py-1 pr-2 align-top">{startPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{endPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{pageCount as string | number}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{summary}</td>
                      <td className="py-1 pr-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {keywords.map(k => (
                            <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Evidenz separat (erste Zeichen beschränkt) */}
            <div className="mt-1 text-xs text-muted-foreground">
              {chapters.map((c, i) => {
                const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
                if (!ev) return null
                const title = typeof c.title === 'string' ? c.title : `Kapitel ${i+1}`
                const preview = ev.length > 140 ? `${ev.slice(0, 140)}…` : ev
                return (
                  <div key={`ev-${i}`} className="truncate">
                    <span className="font-medium">{title}:</span> <span className="opacity-80">{preview}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Inhaltsverzeichnis */}
      {(() => {
        const toc: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.toc) ? (frontmatterMeta?.toc as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { toc?: Array<Record<string, unknown>> }).toc || [])
        if (!Array.isArray(toc) || toc.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Inhaltsverzeichnis</div>
          <div className="overflow-auto max-h-40">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">Seite</th>
                  <th className="py-1 pr-2">L</th>
                </tr>
              </thead>
              <tbody>
                {toc.map((t, i) => {
                  const title = typeof t.title === 'string' ? t.title : ''
                  const page = typeof t.page === 'number' ? t.page : ''
                  const level = typeof t.level === 'number' ? t.level : ''
                  return (
                    <tr key={`${title}-${i}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{title}</td>
                      <td className="py-1 pr-2 align-top">{page}</td>
                      <td className="py-1 pr-2 align-top">{level}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {viewMode === 'full' && job.ingestion && (
        <div>
          <div className="font-medium mb-1">Ingestion</div>
          <div className="text-xs text-muted-foreground">{job.ingestion.index || '—'} · Vektoren: {job.ingestion.vectorsUpserted ?? '—'} · {job.ingestion.upsertAt ? new Date(job.ingestion.upsertAt).toLocaleString() : '—'}</div>
        </div>
      )}

      {viewMode === 'full' && Array.isArray(job.logs) && job.logs.length > 0 && (
        <div>
          <div className="font-medium mb-1">Logs (neueste zuerst)</div>
          <ul className="space-y-0.5 max-h-48 overflow-auto">
            {[...job.logs].reverse().slice(0, 30).map((l, i) => (
              <li key={i} className="text-xs">
                {new Date(l.timestamp).toLocaleTimeString()} · {l.phase || '—'} · {typeof l.progress === 'number' ? `${l.progress}% · ` : ''}{l.message || ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameter am Ende */}
      {viewMode === 'full' && job.parameters && (
        <div>
          <div className="font-medium mb-1">Parameter</div>
          <pre className="bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(job.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}



```

Ich ergänze Null-Checks in `job-report-tab.tsx` für Ingestion-, Logs- und Parameter-Blöcke und baue erneut.

```typescriptreact
"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

interface JobReportTabProps {
  libraryId: string
  fileId: string
  fileName?: string
  provider?: StorageProvider | null
  // Quelle der Metadaten steuern: 'merged' = cumulativeMeta + Frontmatter (Standard),
  // 'frontmatter' = ausschließlich Frontmatter aus Markdown anzeigen
  sourceMode?: 'merged' | 'frontmatter'
  // Darstellungsmodus: 'full' zeigt Kopf/Steps/Logs/Parameter; 'metaOnly' zeigt nur Metadaten/Kapitel/TOC
  viewMode?: 'full' | 'metaOnly'
  // Optional explizite Markdown-Datei-ID (Shadow‑Twin). Überschreibt auto-Erkennung.
  mdFileId?: string | null
}

interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: { message: string }; details?: { skipped?: boolean } }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        // 1) Versuche Job über result.savedItemId (Shadow‑Twin) zu finden
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        UILogger.debug('JobReportTab', 'Request byResultItemId', { url: byResultUrl.toString() })
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        UILogger.debug('JobReportTab', 'Result byResultItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })

        // 2) Fallback: über correlation.source.itemId (Originaldatei)
        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceItemId', { url: bySourceUrl.toString() })
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        // 3) Fallback: über correlation.source.name (Dateiname der Quelle)
        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          // Wenn wir den tatsächlichen Dateinamen kennen, verwende ihn.
          // Für Shadow‑Twins (z. B. name.de.md) versuche das Basis‑PDF (name.pdf).
          let candidate = (fileName && typeof fileName === 'string') ? fileName : (fileId.includes('/') ? (fileId.split('/').pop() as string) : fileId)
          const parts = candidate.split('.')
          if (parts.length >= 3) {
            const ext1 = parts[parts.length - 1].toLowerCase()
            const ext2 = parts[parts.length - 2].toLowerCase()
            if ((ext1 === 'md' || ext1 === 'mdx') && /^[a-z]{2}$/i.test(ext2)) {
              candidate = parts.slice(0, -2).join('.') + '.pdf'
            }
          }
          byNameUrl.searchParams.set('bySourceName', candidate)
          byNameUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceName', { url: byNameUrl.toString(), nameOnly: candidate, originalFileName: fileName })
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceName', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        if (!cancelled) setJob(j)
        if (j) UILogger.info('JobReportTab', 'Job gefunden', { jobId: j.jobId, status: j.status })
        else UILogger.warn('JobReportTab', 'Kein Job gefunden', { libraryId, fileId })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId])

  // Wenn Template benutzt wurde, lade dessen Inhalt aus /templates und extrahiere Frontmatter-Schlüssel
  useEffect(() => {
    async function loadTemplateFields() {
      try {
        setTemplateFields(null)
        const tpl = job?.cumulativeMeta && typeof (job.cumulativeMeta as unknown) === 'object'
          ? (job.cumulativeMeta as Record<string, unknown>)['template_used']
          : undefined
        const templateName = typeof tpl === 'string' ? tpl : undefined
        if (!templateName || !provider) return
        const rootItems = await provider.listItemsById('root')
        const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'))
        if (!templatesFolder) return
        const tplItems = await provider.listItemsById(templatesFolder.id)
        const match = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === templateName.toLowerCase()))
        if (!match) return
        const bin = await provider.getBinary(match.id)
        const text = await bin.blob.text()
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            if (k) keys.push(k)
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
      } catch (e) {
        UILogger.warn('JobReportTab', 'Template-Felder konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadTemplateFields()
  }, [job, provider])

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (Fallback, falls cumulativeMeta unvollständig ist)
  useEffect(() => {
    async function loadFrontmatter() {
      try {
        if (!provider) return
        const mdId = (mdFileId || (job?.result?.savedItemId as string | undefined) || fileId)
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        const m = text.match(/^---[\s\S]*?---/)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!m, length: m ? m[0].length : 0 })
        if (!m) { setFrontmatterMeta(null); return }
        const fm = m[0]
        const meta: Record<string, unknown> = {}
        // Einfache Parser-Heuristiken für häufige Felder (JSON-ähnliche Werte werden geparst)
        const tryParse = (val: string): unknown => {
          const trimmed = val.trim()
          if (!trimmed) return ''
          if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
          if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed)
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try { return JSON.parse(trimmed) } catch { return trimmed }
          }
          return trimmed.replace(/^"|"$/g, '')
        }
        // Versuche kompakte Arrays (z. B. authors: ["..."])
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            const v = t.slice(idx + 1)
            meta[k] = tryParse(v)
          }
        }
        // Spezialfälle: mehrzeilige JSON-Blöcke für chapters/toc extrahieren
        const cap = /\nchapters:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (cap && cap[1]) {
          try { meta['chapters'] = JSON.parse(cap[1]) } catch { /* ignore */ }
        }
        const tocCap = /\ntoc:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (tocCap && tocCap[1]) {
          try { meta['toc'] = JSON.parse(tocCap[1]) } catch { /* ignore */ }
        }
        UILogger.info('JobReportTab', 'Frontmatter: Keys & Counts', {
          keys: Object.keys(meta),
          chapters: Array.isArray(meta['chapters']) ? (meta['chapters'] as unknown[]).length : 0,
          toc: Array.isArray(meta['toc']) ? (meta['toc'] as unknown[]).length : 0,
        })
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, fileId, mdFileId, job?.result?.savedItemId, sourceMode])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'full' && job && (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Job {job.jobId}</div>
            <div className="text-xs text-muted-foreground">{job.job_type} · {job.operation} · {new Date(job.updatedAt).toLocaleString()}</div>
          </div>
          <div className="inline-flex items-center rounded px-2 py-0.5 bg-muted text-xs">{job.status}</div>
        </div>
      )}

      {/* Template Hinweis (im Frontmatter-only-Modus ausgeblendet) */}
      {sourceMode !== 'frontmatter' && job && typeof job.cumulativeMeta?.template_used === 'string' && (
        <div className="text-xs text-muted-foreground">Template: {String(job.cumulativeMeta.template_used)}</div>
      )}

      {/* Schritte mit Ampel-Logik */}
      {viewMode === 'full' && job && Array.isArray(job.steps) && job.steps.length > 0 && (
        <div>
          <div className="font-medium mb-1">Schritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {job.steps.map((s) => {
              // Geplante Phasen ermitteln (neue Flags bevorzugt, sonst phases)
              const p = (job.parameters || {}) as Record<string, unknown>
              const hasNewFlags = typeof p['doExtractPDF'] === 'boolean' || typeof p['doExtractMetadata'] === 'boolean' || typeof p['doIngestRAG'] === 'boolean'
              const phases = hasNewFlags
                ? {
                    extract: p['doExtractPDF'] === true,
                    template: p['doExtractMetadata'] === true,
                    ingest: p['doIngestRAG'] === true,
                  }
                : ((p['phases'] as { extract?: boolean; template?: boolean; ingest?: boolean }) || {})

              const planned = (() => {
                const n = s.name
                if (n === 'extract_pdf') return phases.extract === true
                if (n === 'transform_template' || n === 'store_shadow_twin') return phases.template === true
                if (n === 'ingest_rag') return phases.ingest === true
                return false
              })()

              // Ampel-Status ableiten
              const skipped = !!(s as { details?: { skipped?: boolean } }).details?.skipped
              let icon = '○'
              let cls = 'text-muted-foreground'
              if (s.status === 'failed') { icon = '✕'; cls = 'text-red-600' }
              else if (s.status === 'running') { icon = '◐'; cls = 'text-yellow-600' }
              else if (s.status === 'completed') { icon = skipped ? '○' : '✓'; cls = skipped ? 'text-gray-400' : 'text-green-600' }
              else if (s.status === 'pending') { icon = planned ? '•' : '○'; cls = planned ? 'text-yellow-600' : 'text-muted-foreground' }

              const time = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ''
              return (
                <div key={s.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${cls}`}>
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                  {time ? <span className="opacity-70">{time}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge */}
      {(() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? templateFields
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc')
        if (flatKeys.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium">{k}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{valueStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch) */}
      {(() => {
        const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
        if (!Array.isArray(chapters) || chapters.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Kapitel</div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">L</th>
                  <th className="py-1 pr-2">Start</th>
                  <th className="py-1 pr-2">Ende</th>
                  <th className="py-1 pr-2">Seiten</th>
                  <th className="py-1 pr-2">Summary</th>
                  <th className="py-1 pr-2">Keywords</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c, i) => {
                  const order = typeof c.order === 'number' ? c.order : (i + 1)
                  const level = typeof c.level === 'number' ? c.level : undefined
                  const title = typeof c.title === 'string' ? c.title : ''
                  const startPage = typeof c.startPage === 'number' ? c.startPage : (c.startPage === null ? '' : '')
                  const endPage = typeof c.endPage === 'number' ? c.endPage : (c.endPage === null ? '' : '')
                  const pageCount = typeof c.pageCount === 'number' ? c.pageCount : (c.pageCount === null ? '' : '')
                  const summaryVal = typeof c.summary === 'string' ? c.summary : ''
                  const summary = summaryVal.length > 160 ? `${summaryVal.slice(0, 160)}…` : summaryVal
                  const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
                  return (
                    <tr key={`${title}-${order}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top">{order}</td>
                      <td className="py-1 pr-2 align-top">
                        <span className="whitespace-pre-wrap break-words">{title}</span>
                      </td>
                      <td className="py-1 pr-2 align-top">{typeof level === 'number' ? level : ''}</td>
                      <td className="py-1 pr-2 align-top">{startPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{endPage as string | number}</td>
                      <td className="py-1 pr-2 align-top">{pageCount as string | number}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{summary}</td>
                      <td className="py-1 pr-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {keywords.map(k => (
                            <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Evidenz separat (erste Zeichen beschränkt) */}
            <div className="mt-1 text-xs text-muted-foreground">
              {chapters.map((c, i) => {
                const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
                if (!ev) return null
                const title = typeof c.title === 'string' ? c.title : `Kapitel ${i+1}`
                const preview = ev.length > 140 ? `${ev.slice(0, 140)}…` : ev
                return (
                  <div key={`ev-${i}`} className="truncate">
                    <span className="font-medium">{title}:</span> <span className="opacity-80">{preview}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Inhaltsverzeichnis */}
      {(() => {
        const toc: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.toc) ? (frontmatterMeta?.toc as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { toc?: Array<Record<string, unknown>> }).toc || [])
        if (!Array.isArray(toc) || toc.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Inhaltsverzeichnis</div>
          <div className="overflow-auto max-h-40">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">Seite</th>
                  <th className="py-1 pr-2">L</th>
                </tr>
              </thead>
              <tbody>
                {toc.map((t, i) => {
                  const title = typeof t.title === 'string' ? t.title : ''
                  const page = typeof t.page === 'number' ? t.page : ''
                  const level = typeof t.level === 'number' ? t.level : ''
                  return (
                    <tr key={`${title}-${i}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{title}</td>
                      <td className="py-1 pr-2 align-top">{page}</td>
                      <td className="py-1 pr-2 align-top">{level}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {viewMode === 'full' && job && job.ingestion && (
        <div>
          <div className="font-medium mb-1">Ingestion</div>
          <div className="text-xs text-muted-foreground">{job.ingestion.index || '—'} · Vektoren: {job.ingestion.vectorsUpserted ?? '—'} · {job.ingestion.upsertAt ? new Date(job.ingestion.upsertAt).toLocaleString() : '—'}</div>
        </div>
      )}

      {viewMode === 'full' && job && Array.isArray(job.logs) && job.logs.length > 0 && (
        <div>
          <div className="font-medium mb-1">Logs (neueste zuerst)</div>
          <ul className="space-y-0.5 max-h-48 overflow-auto">
            {[...job.logs].reverse().slice(0, 30).map((l, i) => (
              <li key={i} className="text-xs">
                {new Date(l.timestamp).toLocaleTimeString()} · {l.phase || '—'} · {typeof l.progress === 'number' ? `${l.progress}% · ` : ''}{l.message || ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameter am Ende */}
      {viewMode === 'full' && job && job.parameters && (
        <div>
          <div className="font-medium mb-1">Parameter</div>
          <pre className="bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(job.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}



```

- Habe die Build-Blocker gelöst: ungenutzte Importe entfernt, any-Typen ersetzt, prefer-const gefixt, und strikte Nullprüfungen in `job-report-tab.tsx` ergänzt.
- Build läuft jetzt durch; es bleiben nur React-Hook-Warnungen in diversen Komponenten.

Kurztests, um zu verifizieren:
- pnpm build: erfolgreich (nur Warnungen).
- Relevante Dateien:
  - `src/app/api/external/jobs/[jobId]/route.ts`: entfernte ungenutzte `StorageFactory`/`Library`-Imports.
  - `src/app/api/libraries/[id]/tokens/route.ts`: `any` eliminiert, Konfiguration typisiert aktualisiert; unnötige `catch (error)`-Variable entfernt.
  - `src/app/api/metadata/template/run/route.ts`: `type` nicht mehr via `as any`; `config` sicher auf `Record<string, unknown>` gecastet.
  - `src/lib/storage/onedrive-provider.ts`: `prefer-const` für `id`.
  - `src/lib/storage/server-provider.ts`: `type` ohne `as any`.
  - `src/components/library/job-report-tab.tsx`: mehrere Nullability-Guards (`job && ...`), optionale Zugriffe für Metadaten, Logs und Parameter.

Wenn du möchtest, kümmere ich mich als Nächstes um die React Hooks Warnungen in den UI-Komponenten.

