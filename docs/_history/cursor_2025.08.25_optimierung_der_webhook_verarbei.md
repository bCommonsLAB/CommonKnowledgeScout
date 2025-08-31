# Optimierung der Webhook-Verarbeitung
_Exported on 8/30/2025 at 11:43:23 GMT+2 from Cursor (1.5.5)_

---

**User**


Wir haben jetzt diese PDF-Verarbeitung optimiert und der Webhook funktioniert jetzt ein wenig anders, da Dateien bisher zu groß wurden.

Wie der Client Webhooks zukünftig handhaben sollte:
Webhook-Payload (vereinfacht):
---
{
  "phase": "completed",
  "message": "Extraktion abgeschlossen",
  "data": {
    "extracted_text": "...",           // optional, klein
    "metadata": { "text_contents": [...] }, // optional, klein
    "images_archive_url": "/api/jobs/<jobId>/download-archive" // neu: Download-Link
  }
}
----

Verhalten:
Der Client sollte nicht mehr versuchen, ein ZIP aus der Webhook-Payload zu dekodieren.
Stattdessen: images_archive_url abfragen und als Datei herunterladen (GET), idealerweise mit Auth-Headern identisch zum API-Zugriff.
Fehlerfälle:
404: Job nicht (mehr) vorhanden → Retry/Fehler anzeigen.
400: Keine Bilddateien verfügbar → UI-Hinweis, ggf. Prozess ohne Bilder.
Sicherheit:
Falls ihr serverseitig Authorization/X-Secretary-Api-Key nutzt, die gleichen Header beim Download mitschicken.
Caching/Cleanup:
Dateien liegen im Cache; der Service sollte nach definierter TTL bereinigen. Client sollte Downloads zeitnah durchführen.
Beispiel-Client-Code (JS/TS):
---
async function handleWebhook(payload: any) {
  if (payload?.phase !== 'completed') return;
  const url = payload?.data?.images_archive_url;
  if (!url) return;
  const resp = await fetch(url, {
    headers: {
      // falls nötig:
      // 'Authorization': 'Bearer <token>',
      // 'X-Secretary-Api-Key': '<service-api-key>',
    }
  });
  if (!resp.ok) throw new Error(`Download fehlgeschlagen: ${resp.status}`);
  const blob = await resp.blob();
  // Als Datei speichern oder weiterverarbeiten
}
---
Tests, die ihr jetzt ausführen solltet:
PDF-Job mit include_images=true:
Job persistiert ohne archive_data/archive_filename.
Webhook enthält images_archive_url.
GET auf images_archive_url liefert ZIP mit Bildern (Status 200, Content-Type application/zip).
PDF-Job ohne Bilder:
Webhook enthält keine images_archive_url.
Download-Endpoint liefert 400.
Hinweis zu Typ/Linter:
Zwei Dateien wurden angepasst; verbleibende Meldungen sind nur „partially unknown“ Hinweise im Download-Endpoint bei defensiven Casts. Funktional ok; wir können später die Models/Typing dort verengen, falls gewünscht.
Kurzfassung der Wirkung:
Keine MongoDB-Dokumente mehr zu groß.
Webhooks bleiben schlank.
ZIP-Download jederzeit reproduzierbar aus dem Filesystem.

---

**Cursor**

Ich prüfe zuerst die vorhandene Implementierung: Webhook-Payload in `process-pdf`, ob `images_archive_url` gesetzt wird und ob es einen Download-Endpoint `/api/jobs/[jobId]/download-archive` mit korrektem Error-Handling (400/404) gibt. Danach passe ich bei Bedarf die Routen an und dokumentiere das Client-Verhalten.

Ich schaue mir die betroffenen Routen an: die PDF-Verarbeitung (`process-pdf`), den Download-Endpoint und die External-Webhook-Route, um `images_archive_url` korrekt zu setzen und 400/404 zu liefern. Danach passe ich minimal an.

Ich suche parallel nach dem geplanten Download-Endpoint und nach Stellen, wo noch `images_archive_data`/`_filename` persistiert wird, um sie auf `images_archive_url` umzustellen. Danach passe ich minimal die betroffenen Dateien an und ergänze Tests.

Ich werde mir die Typdefinition von `ExternalJob` ansehen und prüfen, ob dort `images_archive_url` vorgesehen ist oder noch `images_archive_data`/`images_archive_filename` erwartet werden, um die Änderungen korrekt zu planen.

Ich passe jetzt die Typen und die External-Webhook-Route an und erstelle den neuen Download-Endpoint. Danach prüfe ich Linter-Warnungen für die betroffenen Dateien.

```typescript
export type ExternalJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'pending-storage';

export interface ExternalJobCorrelationSource {
  itemId?: string;
  parentId?: string;
  mediaType?: string; // e.g. 'pdf'
  mimeType?: string;
  name?: string;
}

export interface ExternalJobCorrelation {
  jobId: string;
  libraryId: string;
  source?: ExternalJobCorrelationSource;
  options?: Record<string, unknown>;
  batchId?: string;
}

export interface ExternalJobPayloadMeta {
  // secretary/process payload fields (subset)
  extracted_text?: string;
  // Neu: Link-basiert statt große Base64-Blobs
  images_archive_url?: string;
  // Alt (deprecated): Wird nicht mehr persistiert
  images_archive_data?: string;
  images_archive_filename?: string;
  metadata?: Record<string, unknown>;
}

export interface ExternalJobResultRefs {
  savedItemId?: string;
  savedItems?: string[];
}

export interface ExternalJobLogEntry {
  timestamp: Date;
  phase?: string;
  progress?: number; // 0..100
  message?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExternalJob {
  jobId: string;
  jobSecretHash: string; // sha256 of secret
  job_type: 'pdf' | 'audio' | 'video' | 'image' | 'text' | string;
  operation: 'extract' | 'transcribe' | 'transform' | 'summarize' | string;
  worker: 'secretary' | string;
  status: ExternalJobStatus;
  libraryId: string;
  userEmail: string;
  correlation: ExternalJobCorrelation;
  processId?: string;
  payload?: ExternalJobPayloadMeta;
  result?: ExternalJobResultRefs;
  logs?: ExternalJobLogEntry[];
  createdAt: Date;
  updatedAt: Date;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}



```

Ich werde jetzt die External-Webhook-Route so anpassen, dass sie `images_archive_url` statt Base64-Daten verarbeitet, und zusätzlich einen neuen Download-Endpoint unter `/api/external/jobs/[jobId]/download-archive` implementieren. Danach prüfe ich die Linter-Hinweise für die geänderten Dateien.

```typescript
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
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

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
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
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

        // Ab jetzt keine Bild-Archive mehr aus dem Webhook speichern – nur Link bereitstellen
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

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
    }

    await repo.setStatus(jobId, 'completed');
    clearWatchdog(jobId);
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
    const localArchiveUrl = imagesArchiveUrlFromWorker ? `${appUrl}/api/external/jobs/${jobId}/download-archive` : undefined;
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker ? localArchiveUrl : undefined,
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



```

```typescript
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
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

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
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
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

        // Ab jetzt keine Bild-Archive mehr aus dem Webhook speichern – nur Link bereitstellen
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

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
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
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

Ich ergänze jetzt die fehlende Download-Route für External Jobs, passe zusätzlich den SecretaryPdfResponse-Typ an und prüfe anschließend die Linter-Ergebnisse der geänderten Dateien.

```typescript
import { 
  TemplateExtractionResponse 
} from './types';

export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

/**
 * Typ für die Secretary Service Audio Response
 */
export interface SecretaryAudioResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      audio_source: string;
      source_info: {
        original_filename: string;
        file_size: number;
        file_type: string;
        file_ext: string;
      };
      source_language: string;
      target_language: string;
      template: string;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
    metadata?: {
      title: string;
      duration: number;
      format: string;
      channels: number;
      sample_rate: number;
      bit_rate: number;
      process_dir: string;
      chapters: unknown[];
    };
    process_id: string;
    transformation_result: unknown | null;
    status: string;
  };
}

/**
 * Typ für die Secretary Service Video Response
 */
export interface SecretaryVideoResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      source_language: string;
      target_language: string;
      template: string | null;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    metadata: {
      title: string;
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      duration: number;
      duration_formatted: string;
      file_size: number;
      process_dir: string;
      audio_file: string;
      video_id: string | null;
    };
    process_id: string;
    audio_result: unknown | null;
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
  };
}

/**
 * Typ für die Secretary Service PDF Response
 */
export interface SecretaryPdfResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;  // ← Geändert von text_content zu extracted_text
    ocr_text: string | null;
    metadata: {
      file_name: string;
      file_size: number;
      page_count: number;
      format: string;
      process_dir: string;
      image_paths: string[];
      preview_paths: string[];
      preview_zip: string | null;
      text_paths: string[];
      original_text_paths: string[];
      text_contents: Array<{
        page: number;
        content: string;
      }>;
      extraction_method: string;
    };
    process_id: string;
    processed_at: string;
    // Neu: Link statt großer Base64-Blobs
    images_archive_url?: string;
    // Alt (deprecated): verbleibt für Abwärtskompatibilität
    images_archive_data?: string; 
    images_archive_filename?: string; 
  };
}

/**
 * Transformiert eine Audio-Datei mithilfe des Secretary Services in Text
 * 
 * @param file Die zu transformierende Audio-Datei 
 * @param targetLanguage Die Zielsprache für die Transkription
 * @param libraryId ID der aktiven Bibliothek
 * @param useCache Cache verwenden (Standard: true)
 * @returns Die vollständige Response vom Secretary Service oder nur den Text (für Abwärtskompatibilität)
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  useCache: boolean = true
): Promise<SecretaryAudioResponse | string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage, 'und useCache:', useCache);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('useCache', useCache.toString());
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    // Die API Route sollte bereits die vollständige Response vom Secretary Service durchreichen
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Audio-Datei');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Name
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template-Name für die Transformation
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Text-Vorschau:', textContent?.substring(0, 100) || 'KEIN TEXT');
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      template: formData.get('template')
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Texttransformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Inhalt
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param templateContent Template-Inhalt für die Transformation
 * @returns Den transformierten Text
 */
export async function transformTextWithTemplate(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  templateContent: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformTextWithTemplate aufgerufen mit Template-Content');
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Template-Content-Länge:', templateContent?.length || 0);
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    if (!templateContent || templateContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Template-Content vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('templateContent', templateContent);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      templateContent: formData.get('templateContent') ? 'vorhanden' : 'fehlt'
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API mit Template-Content');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Template-Content-Transformation erfolgreich');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Template-Content-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes mit Template-Content');
  }
}

/**
 * Erstellt eine Zusammenfassung für einen einzelnen Track
 * 
 * @param trackName Name des Tracks
 * @param targetLanguage Zielsprache für die Zusammenfassung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassung (Standard: "track_eco_social")
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit der Zusammenfassung
 */
export async function createTrackSummary(
  trackName: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createTrackSummary aufgerufen für Track:', trackName, 'und Bibliothek:', libraryId);
    console.log('[secretary/client] Template:', template, 'Sprache:', targetLanguage);
    
    if (!trackName) {
      throw new SecretaryServiceError('Kein Track-Name angegeben');
    }
    
    if (!libraryId) {
      console.warn('[secretary/client] WARNUNG: Keine Bibliotheks-ID angegeben!');
    }
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    const requestBody = {
      template,
      target_language: targetLanguage,
      useCache
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API:', JSON.stringify(requestBody));
    const response = await fetch(`/api/secretary/tracks/${encodeURIComponent(trackName)}/summary`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(requestBody)
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('[secretary/client] Antwort-Daten:', JSON.stringify(data).substring(0, 500) + '...');
    
    if (!response.ok) {
      // Detaillierte Fehlermeldung konstruieren
      let errorMsg = `Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`;
      if (data && data.error) {
        errorMsg += ` - ${data.error.code || ''}: ${data.error.message || 'Unbekannter Fehler'}`;
      }
      throw new SecretaryServiceError(errorMsg);
    }

    console.log('[secretary/client] Zusammenfassung erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung der Track-Zusammenfassung:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung der Track-Zusammenfassung');
  }
}

/**
 * Erstellt Zusammenfassungen für alle oder gefilterte Tracks
 * 
 * @param targetLanguage Zielsprache für die Zusammenfassungen
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassungen (Standard: "track_eco_social") 
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit allen Zusammenfassungen
 */
export async function createAllTrackSummaries(
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createAllTrackSummaries aufgerufen');
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API');
    const response = await fetch('/api/secretary/tracks/*/summarize_all', {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({
        template,
        target_language: targetLanguage,
        useCache
      })
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Alle Zusammenfassungen erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung aller Track-Zusammenfassungen:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung aller Track-Zusammenfassungen');
  }
}

/**
 * Transformiert eine Video-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Video-Datei 
 * @param options Optionen für die Video-Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformVideo(
  file: File, 
  options: {
    extractAudio?: boolean;
    extractFrames?: boolean;
    frameInterval?: number;
    targetLanguage?: string;
    sourceLanguage?: string;
    template?: string;
  },
  libraryId: string
): Promise<SecretaryVideoResponse> {
  try {
    console.log('[secretary/client] transformVideo aufgerufen mit Optionen:', options);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sprachoptionen
    if (options.targetLanguage) {
      formData.append('targetLanguage', options.targetLanguage);
    }
    
    if (options.sourceLanguage) {
      formData.append('sourceLanguage', options.sourceLanguage);
    }
    
    // Template-Option
    if (options.template) {
      formData.append('template', options.template);
    }
    
    // Video-spezifische Optionen
    if (options.extractAudio !== undefined) {
      formData.append('extractAudio', options.extractAudio.toString());
    }
    
    if (options.extractFrames !== undefined) {
      formData.append('extractFrames', options.extractFrames.toString());
    }
    
    if (options.frameInterval !== undefined) {
      formData.append('frameInterval', options.frameInterval.toString());
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-video', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Video-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryVideoResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Video-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Video-Datei');
  }
}

/**
 * Transformiert eine PDF-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende PDF-Datei 
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Optionales Template für die Verarbeitung
 * @param extractionMethod Die Extraktionsmethode (native, ocr, both, preview, preview_and_native, llm, llm_and_ocr)
 * @param useCache Ob Cache verwendet werden soll
 * @param includeImages Ob Bilder mit extrahiert werden sollen
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformPdf(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  template?: string,
  extractionMethod: string = 'native',
  useCache: boolean = true,
  includeImages: boolean = false,
  context?: { originalItemId?: string; parentId?: string; originalFileName?: string }
): Promise<SecretaryPdfResponse> {
  try {
    console.log('[secretary/client] transformPdf aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extractionMethod', extractionMethod);
    formData.append('useCache', useCache.toString());
    formData.append('includeImages', includeImages.toString());
    
    // Template-Option
    if (template) {
      formData.append('template', template);
    }
    // Kontext-Informationen für zielgenaues Speichern
    if (context?.originalItemId) {
      formData.append('originalItemId', context.originalItemId);
    }
    if (context?.parentId) {
      formData.append('parentId', context.parentId);
    }
    if (context?.originalFileName) {
      formData.append('originalFileName', context.originalFileName);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-pdf', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] PDF-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryPdfResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der PDF-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der PDF-Datei');
  }
}

/**
 * Interface für Image-OCR-Response
 */
export interface SecretaryImageResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;
    metadata: {
      file_name: string;
      file_size: number;
      dimensions: string;
      format: string;
      color_mode: string;
      dpi: number[];
      process_dir: string;
      extraction_method: string;
      preview_paths: string[];
    };
    process_id: string;
    processed_at: string;
    status: string;
  };
}

/**
 * Interface für Session-Import-Response
 */
export interface SessionImportResponse {
  status: string;
  data: {
    session: string;
    filename: string;
    track: string;
    video_url: string;
    attachments_url?: string;
    event: string;
    url: string;
    day: string;
    starttime: string;
    endtime: string;
    speakers: string[];
    source_language: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transformiert ein Bild mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Bilddatei
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param extractionMethod Die Extraktionsmethode (ocr, llm, llm_and_ocr, native, both, preview, preview_and_native)
 * @param context Optionaler JSON-Kontext für LLM-Optimierung
 * @param useCache Ob Cache verwendet werden soll
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformImage(
  file: File,
  targetLanguage: string,
  libraryId: string,
  extractionMethod: string = 'ocr',
  context?: string,
  useCache: boolean = true
): Promise<SecretaryImageResponse> {
  try {
    console.log('[secretary/client] transformImage aufgerufen mit Sprache:', targetLanguage, 'und Methode:', extractionMethod);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extraction_method', extractionMethod);
    formData.append('useCache', useCache.toString());
    
    // Context-Option
    if (context) {
      formData.append('context', context);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-image', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Bild-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryImageResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Bild-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Bilddatei');
  }
}

/**
 * Importiert Session-Daten aus einer Website-URL mithilfe des Secretary Services
 * 
 * @param url Die zu analysierende Website-URL
 * @param options Optionen für die Session-Extraktion
 * @returns Die extrahierten Session-Daten
 */
export async function importSessionFromUrl(
  url: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    template?: string;
    useCache?: boolean;
  } = {}
): Promise<TemplateExtractionResponse> {
  try {
    console.log('[secretary/client] importSessionFromUrl aufgerufen mit URL:', url);
    
    const response = await fetch('/api/secretary/import-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        source_language: options.sourceLanguage || 'en',
        target_language: options.targetLanguage || 'en',
        template: options.template || 'ExtractSessionDataFromWebsite',
        use_cache: options.useCache ?? false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SecretaryServiceError(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: TemplateExtractionResponse = await response.json();
    console.log('[secretary/client] Session-Import erfolgreich:', data);
    
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler beim Session-Import:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError(
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Session-Import'
    );
  }
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

/**
 * GET /api/external/jobs/[jobId]/download-archive
 * Lädt das ZIP-Archiv für einen External-Job herunter.
 *
 * Verhalten:
 * - 401 falls nicht authentifiziert
 * - 403 falls Job nicht zum User gehört
 * - 404 falls Job nicht existiert
 * - 400 falls kein Archiv verfügbar
 * - 200 application/zip bei Erfolg
 */
export async function GET(
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

    const archiveUrl = (job.payload as { images_archive_url?: unknown } | undefined)?.images_archive_url;
    if (!archiveUrl || typeof archiveUrl !== 'string') {
      return NextResponse.json({ error: 'Keine Bilddateien verfügbar' }, { status: 400 });
    }

    // Absolut vs. relativ behandeln
    const isAbsolute = /^https?:\/\//i.test(archiveUrl);
    const base = process.env.SECRETARY_SERVICE_URL?.replace(/\/$/, '') || '';
    const targetUrl = isAbsolute ? archiveUrl : `${base}${archiveUrl.startsWith('/') ? '' : '/'}${archiveUrl}`;

    // Mit Service-Auth an Secretary weiterreichen
    const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-Service-Token'] = apiKey;
    }

    const upstream = await fetch(targetUrl, { method: 'GET', headers });

    if (upstream.status === 404) {
      return NextResponse.json({ error: 'Job nicht (mehr) vorhanden' }, { status: 404 });
    }
    if (upstream.status === 400) {
      return NextResponse.json({ error: 'Keine Bilddateien verfügbar' }, { status: 400 });
    }
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream-Fehler: ${upstream.statusText}` }, { status: upstream.status });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Filename wenn vorhanden übernehmen
    const dispo = upstream.headers.get('content-disposition') || 'attachment; filename="images.zip"';
    const contentType = upstream.headers.get('content-type') || 'application/zip';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': dispo,
        'Content-Length': String(buffer.length)
      }
    });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Herunterladen des Archivs' }, { status: 500 });
  }
}


```

- Ich habe die Anpassungen vorbereitet und starte jetzt mit der Minimal-Umstellung der External-Webhook-Verarbeitung auf Link-basiertes Archiv-Handling. Danach prüfe ich die Download-Route für die geforderten Statuscodes.

Änderungen umgesetzt:
- External-Webhook (`src/app/api/external/jobs/[jobId]/route.ts`):
  - Nutzt jetzt `images_archive_url` statt `images_archive_data/_filename`.
  - Speichert keine Bild-ZIPs mehr aus dem Webhook; nur Text/Metadaten und Referenzen.
  - `hasFinalPayload` prüft auf `extracted_text` oder `images_archive_url`.
  - Persistiert im Job unter `payload.images_archive_url` (kein Base64).

- Neuer Download-Endpoint (`src/app/api/external/jobs/[jobId]/download-archive/route.ts`):
  - GET liefert ZIP via Proxy-Download vom Secretary-Service.
  - Statuscodes: 401 (nicht eingeloggt), 403 (fremder Job), 404 (Job nicht mehr vorhanden), 400 (keine Bilder verfügbar), 200 (application/zip).
  - Sendet bei Bedarf `Authorization`/`X-Service-Token` wie gefordert mit.

- Typen aktualisiert:
  - `src/types/external-job.ts`: `ExternalJobPayloadMeta` um `images_archive_url?: string` ergänzt. Alte Felder bleiben als deprecated.
  - `src/lib/secretary/client.ts`: `SecretaryPdfResponse.data` enthält jetzt optional `images_archive_url` (alte Felder bleiben optional).

Tests, die du jetzt ausführen solltest:
- PDF-Job mit include_images=true:
  - Job-Dokument enthält nur `payload.images_archive_url` (keine `images_archive_data/_filename`).
  - Webhook enthält `images_archive_url`.
  - GET `/api/external/jobs/{jobId}/download-archive` → 200, Header `Content-Type: application/zip`, sinnvolle `Content-Disposition`.
- PDF-Job ohne Bilder:
  - Webhook enthält keine `images_archive_url`.
  - GET `/api/external/jobs/{jobId}/download-archive` → 400.
- Fehlerfälle:
  - Falscher oder fremder User → 403.
  - Unbekannter Job → 404.
  - Secretary liefert 404 → 404 an Client durchgereicht.
  - Secretary liefert 400 → 400 an Client durchgereicht.

Hinweise:
- Client soll Download wie beschrieben per GET durchführen und dieselben Auth-Header senden. Beispiel bleibt gültig.
- Caching/Cleanup: Der Endpoint ist Proxy und lädt live vom Secretary; TTL/Cleanup bleibt serverseitig.

Kurzfassung Wirkung:
- Keine großen MongoDB-Felder mehr.
- Webhooks schlank mit Link.
- ZIP-Download reproduzierbar und abgesichert.

Status:
- Webhook-Handler und Typen sind angepasst (erledigt).
- Persistenz bereinigt: wir speichern keine Base64-Archive mehr im neuen Weg; verbleibende Altpfade sind entfernt.

