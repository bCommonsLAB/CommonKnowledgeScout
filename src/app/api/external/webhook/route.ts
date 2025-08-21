import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';

async function ensureOneDriveAccessToken(lib: Library, userEmail: string): Promise<string> {
  // Nutze gespeicherten Access-Token oder refreshe über unsere Refresh-Route
  const accessToken = lib.config?.accessToken as string | undefined;
  const refreshToken = lib.config?.refreshToken as string | undefined;
  const tokenExpiry = Number(lib.config?.tokenExpiry || 0);
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
  // Setze Konfliktverhalten explizit auf replace, um 409 zu vermeiden
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    // Fallback: rename
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json = await res.json();
  return { id: json.id as string };
}

async function onedriveEnsureFolder(accessToken: string, parentId: string, name: string): Promise<{ id: string }> {
  // Suche Folder
  const url = parentId === 'root'
    ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
  const list = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!list.ok) throw new Error(`OneDrive children list fehlgeschlagen: ${list.status}`);
  const data = await list.json();
  const existing = (data.value as Array<any> | undefined)?.find((it) => it.folder && it.name === name);
  if (existing) return { id: existing.id as string };
  // Erstellen
  const createUrl = url;
  const resp = await fetch(createUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' })
  });
  if (!resp.ok) throw new Error(`OneDrive Ordnererstellung fehlgeschlagen: ${resp.status}`);
  const created = await resp.json();
  return { id: created.id as string };
}
// Generischer Webhook für externe Worker (z. B. Secretary)
// Validiert per-Job-Secret, aktualisiert Status und quittiert den Empfang

export async function POST(request: NextRequest) {
  try {
    const worker = request.headers.get('x-worker') || 'secretary';
    const body = await request.json();

    const jobId: string | undefined = body?.jobId || body?.correlation?.jobId;
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

    if (!jobId || !callbackToken) {
      return NextResponse.json({ error: 'jobId oder callback_token fehlt' }, { status: 400 });
    }

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) {
      FileLogger.warn('external-webhook', 'Job nicht gefunden', { jobId });
      return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    }

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) {
      FileLogger.warn('external-webhook', 'Token-Validierung fehlgeschlagen', { jobId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);
    await repo.appendLog(jobId, { phase: 'webhook_received', worker, headers: { hasAuth: !!request.headers.get('authorization'), hasCallbackHeader: !!request.headers.get('x-callback-token') } });
    FileLogger.info('external-webhook', 'Job running', { jobId, worker });

    // Serverseitiges Speichern (lokaler Provider sofort; Cloud später per Writer)
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveData: string | undefined = body?.data?.images_archive_data;
    const imagesArchiveFilename: string | undefined = body?.data?.images_archive_filename;

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    if (lib && extractedText) {
      if (lib.type === 'local') {
        // Lokales Speichern: FileSystemProvider mit basePath aus Library
        const provider = new FileSystemProvider(lib.path);

        // Auflösen der Quell- und Zielpfade (relativ und absolut)
        const sourceId = (job.correlation as any)?.source?.itemId;
        const targetParentId = (job.correlation as any)?.source?.parentId || 'root';
        const sourceRelPath = sourceId ? await provider.getPathById(sourceId).catch(() => undefined) : undefined;
        const targetRelPath = await provider.getPathById(targetParentId).catch(() => '/');
        const sourceAbsPath = sourceRelPath && sourceRelPath !== '/' ? path.join(lib.path, sourceRelPath.replace(/^\//, '')) : lib.path;
        const targetAbsPath = targetRelPath && targetRelPath !== '/' ? path.join(lib.path, targetRelPath.replace(/^\//, '')) : lib.path;

        // Minimale Metadaten → Markdown mit Frontmatter über TransformService
        const markdown = (TransformService as any).createMarkdownWithFrontmatter
          ? (TransformService as any).createMarkdownWithFrontmatter(extractedText, body?.data?.metadata || {})
          : extractedText;

        // Shadow-Twin-Dateiname ermitteln
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options as any)?.targetLanguage || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        // In den sinnvollen Ordner schreiben: parentId aus correlation.source.parentId, sonst root
        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        // Persistente Logs: Quelle/Ziel inkl. Pfade
        const savedRelPath = await provider.getPathById(saved.id).catch(() => undefined);
        const savedAbsPath = savedRelPath && savedRelPath !== '/' ? path.join(lib.path, savedRelPath.replace(/^\//, '')) : undefined;
        await repo.appendLog(jobId, {
          phase: 'stored_local',
          sourceId,
          sourceRelativePath: sourceRelPath,
          sourceAbsolutePath: sourceAbsPath,
          targetParentId,
          targetRelativePath: targetRelPath,
          targetAbsolutePath: targetAbsPath,
          savedItemId: saved.id,
          savedRelativePath: savedRelPath,
          savedAbsolutePath: savedAbsPath,
          fileName: uniqueName
        });
        savedItemId = saved.id;
        FileLogger.info('external-webhook', 'Shadow-Twin gespeichert (local)', { jobId, savedItemId, name: uniqueName });

        // Bilder optional extrahieren (Unterordner .<pdfname>)
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

          const imagesFolderRel = imageResult.folderItem ? await provider.getPathById(imageResult.folderItem.id).catch(() => undefined) : undefined;
          const imagesFolderAbs = imagesFolderRel && imagesFolderRel !== '/' ? path.join(lib.path, imagesFolderRel.replace(/^\//, '')) : undefined;
          await repo.appendLog(jobId, {
            phase: 'images_extracted',
            folderId: imageResult.folderItem?.id,
            folderRelativePath: imagesFolderRel,
            folderAbsolutePath: imagesFolderAbs,
            imagesSavedCount: imageResult.savedItems.length,
          });
          FileLogger.info('external-webhook', 'Bilder extrahiert (local)', { jobId, count: imageResult.savedItems.length });
        }
      } else {
        // Cloud-Provider (OneDrive): Speichern über Graph API
        if (lib.type === 'onedrive') {
          const accessToken = await ensureOneDriveAccessToken(lib, job.userEmail);

          // Ziel-Ordner (parentId) aus Korrelation
          const targetParentId = (job.correlation as any)?.source?.parentId || 'root';

          // Datei erstellen: Shadow‑Twin Markdown
          const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
          const lang = (job.correlation.options as any)?.targetLanguage || 'de';
          const uniqueName = `${baseName}.${lang}.md`;
          const contentBuffer = Buffer.from(
            (TransformService as any).createMarkdownWithFrontmatter
              ? (TransformService as any).createMarkdownWithFrontmatter(extractedText, body?.data?.metadata || {})
              : extractedText,
            'utf8'
          );

          const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
          savedItemId = saved.id;
          savedItems.push(saved.id);

          await repo.appendLog(jobId, {
            phase: 'stored_cloud',
            provider: 'onedrive',
            targetParentId,
            savedItemId: saved.id,
            fileName: uniqueName
          });
          FileLogger.info('external-webhook', 'Shadow-Twin gespeichert (OneDrive)', { jobId, savedItemId: saved.id, name: uniqueName });

          // Bilder optional extrahieren → Unterordner .<basename>
          if (imagesArchiveData) {
            const imagesFolder = await onedriveEnsureFolder(accessToken, targetParentId, `.${baseName}`);

            // ZIP entpacken und hochladen
            const JSZip = await import('jszip');
            const zip = await new JSZip.default().loadAsync(Buffer.from(imagesArchiveData, 'base64'));
            const entries = Object.entries(zip.files);
            let imagesSaved = 0;

            // optional seitenweise Markdown
            const textContents: Array<{ page: number; content: string }> | undefined = body?.data?.metadata?.text_contents;

            for (const [filePath, file] of entries) {
              if (file.dir) continue;
              const ext = filePath.split('.').pop()?.toLowerCase();
              if (!ext || !['png', 'jpg', 'jpeg'].includes(ext)) continue;

              const originalFileName = filePath.split('/').pop() || `image.${ext}`;
              const pageFileName = originalFileName.replace(/^image_(\d+)/, (_m, n) => `page_${String(n).padStart(3, '0')}`);
              const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
              const bin = await file.async('nodebuffer');
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

            await repo.appendLog(jobId, {
              phase: 'images_extracted',
              provider: 'onedrive',
              folderId: imagesFolder.id,
              imagesSavedCount: imagesSaved
            });
            FileLogger.info('external-webhook', 'Bilder extrahiert (OneDrive)', { jobId, count: imagesSaved });
          }
        } else {
          FileLogger.info('external-webhook', 'Cloud-Provider nicht implementiert', { jobId, provider: lib.type });
        }
      }
    }

    await repo.setStatus(jobId, 'completed');
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_data: imagesArchiveData,
      images_archive_filename: imagesArchiveFilename,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });
    FileLogger.info('external-webhook', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });

    // Vorläufige Quittung mit Echo relevanter Felder
    return NextResponse.json({
      status: 'ok',
      worker,
      jobId,
      received: {
        hasProcess: !!body?.process,
        hasData: !!body?.data,
        hasCorrelation: !!body?.correlation,
      }
    });
  } catch (error) {
    FileLogger.error('external-webhook', 'Fehler im Webhook', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}


