import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';

interface OneDriveAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

async function ensureOneDriveAccessToken(lib: Library): Promise<string> {
  const cfg = lib.config as unknown as OneDriveAuthConfig | undefined;
  const accessToken = cfg?.accessToken as string | undefined;
  const refreshToken = cfg?.refreshToken as string | undefined;
  const tokenExpiry = Number(cfg?.tokenExpiry || 0);
  const isExpired = !tokenExpiry || Date.now() / 1000 > tokenExpiry - 60;

  if (accessToken && !isExpired) return accessToken;
  if (!refreshToken) throw new Error('OneDrive Refresh-Token fehlt in der Library-Konfiguration');

  const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/api/auth/onedrive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId: lib.id, refreshToken })
  });
  if (!resp.ok) throw new Error(`OneDrive Token-Refresh fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.accessToken as string;
}

async function onedriveUploadFile(accessToken: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<{ id: string }> {
  const base = parentId === 'root'
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`;
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json: unknown = await res.json();
  return { id: (json as { id?: string }).id as string };
}

async function onedriveEnsureFolder(accessToken: string, parentId: string, name: string): Promise<{ id: string }> {
  const url = parentId === 'root'
    ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
  const list = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!list.ok) throw new Error(`OneDrive children list fehlgeschlagen: ${list.status}`);
  const data: unknown = await list.json();
  const existing = (Array.isArray((data as { value?: unknown }).value) ? (data as { value: Array<{ id?: string; name?: string; folder?: unknown }> }).value : undefined)?.find((it) => it.folder && it.name === name);
  if (existing) return { id: existing.id as string };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' })
  });
  if (!resp.ok) throw new Error(`OneDrive Ordnererstellung fehlgeschlagen: ${resp.status}`);
  const created: unknown = await resp.json();
  return { id: (created as { id?: string }).id as string };
}

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
    if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_data || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
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
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveData: string | undefined = body?.data?.images_archive_data;
    const imagesArchiveFilename: string | undefined = body?.data?.images_archive_filename;

    if (!extractedText && !imagesArchiveData) {
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    if (lib && extractedText) {
      if (lib.type === 'local') {
        const provider = new FileSystemProvider(lib.path);
        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';
        // Pfade nur bei Bedarf auflösen (derzeit nicht benötigt)
        // await provider.getPathById(sourceId ?? '').catch(() => undefined);
        // await provider.getPathById(targetParentId).catch(() => '/');
        // Pfade ermitteln (aktuell nur für Debugging/Logging nutzbar)
        // const sourceAbsPath = sourceRelPath && sourceRelPath !== '/' ? path.join(lib.path, sourceRelPath.replace(/^\//, '')) : lib.path;
        // const targetAbsPath = targetRelPath && targetRelPath !== '/' ? path.join(lib.path, targetRelPath.replace(/^\//, '')) : lib.path;

        const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        // const savedRelPath = await provider.getPathById(saved.id).catch(() => undefined);
        // const savedAbsPath = savedRelPath && savedRelPath !== '/' ? path.join(lib.path, savedRelPath.replace(/^\//, '')) : undefined;
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;

        if (imagesArchiveData) {
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

          const imageResult = await ImageExtractionService.saveZipArchive(
            imagesArchiveData,
            imagesArchiveFilename || 'pdf_images.zip',
            originalItemForImages,
            provider,
            async () => [],
            extractedText,
            lang,
            body?.data?.metadata?.text_contents
          );
          for (const it of imageResult.savedItems) savedItems.push(it.id);

          bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
        }
      } else if (lib && lib.type === 'onedrive') {
        const accessToken = await ensureOneDriveAccessToken(lib);
        const targetParentId = job.correlation?.source?.parentId || 'root';
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const md = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;
        const contentBuffer = Buffer.from(md, 'utf8');
        const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
        savedItemId = saved.id;
        savedItems.push(saved.id);

        bufferLog(jobId, { phase: 'stored_cloud', message: 'Shadow‑Twin gespeichert' });

        if (imagesArchiveData) {
          const imagesFolder = await onedriveEnsureFolder(accessToken, targetParentId, `.${baseName}`);
          const JSZip = await import('jszip');
          const zip = await new JSZip.default().loadAsync(Buffer.from(imagesArchiveData, 'base64'));
          const entries = Object.entries(zip.files as Record<string, unknown>);
          let imagesSaved = 0;

          const textContents: Array<{ page: number; content: string }> | undefined = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
          for (const [filePath, fileEntry] of entries) {
            if ((fileEntry as { dir?: boolean }).dir) continue;
            const ext = filePath.split('.').pop()?.toLowerCase();
            if (!ext || !['png', 'jpg', 'jpeg'].includes(ext)) continue;
            const originalFileName = filePath.split('/').pop() || `image.${ext}`;
            const pageFileName = originalFileName.replace(/^image_(\d+)/, (_m, n) => `page_${String(n).padStart(3, '0')}`);
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            const bin = await (fileEntry as { async: (t: 'nodebuffer') => Promise<Buffer> }).async('nodebuffer');
            const imgItem = await onedriveUploadFile(accessToken, imagesFolder.id, pageFileName, mime, bin);
            savedItems.push(imgItem.id);
            imagesSaved++;
            if (textContents && textContents.length > 0) {
              const match = pageFileName.match(/page_(\d+)/);
              if (match) {
                const page = Number(match[1]);
                const tc = textContents.find(t => t.page === page);
                if (tc) {
                  const mdName = `${pageFileName.replace(/\.(png|jpg|jpeg)$/i, '')}.${lang}.md`;
                  const mdBuffer = Buffer.from(
                    `# ${pageFileName}\n\n## Quelle\n**PDF-Datei:** ${job.correlation.source?.name || ''}\n**Bild:** ${pageFileName}\n**Sprache:** ${lang}\n**Seite:** ${page}\n\n## Extrahierter Text\n${tc.content}\n`,
                    'utf8'
                  );
                  const mdItem = await onedriveUploadFile(accessToken, imagesFolder.id, mdName, 'text/markdown', mdBuffer);
                  savedItems.push(mdItem.id);
                }
              }
            }
          }
          bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imagesSaved})` });
        }
      }
    }

    await repo.setStatus(jobId, 'completed');
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_data: imagesArchiveData,
      images_archive_filename: imagesArchiveFilename,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });

    // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
    await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

    FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}


