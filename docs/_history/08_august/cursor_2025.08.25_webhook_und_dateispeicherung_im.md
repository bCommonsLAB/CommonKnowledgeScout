# Webhook und Dateispeicherung im Filesystem
_Exported on 8/30/2025 at 11:42:41 GMT+2 from Cursor (1.5.5)_

---

**User**

Ich möchte mir nochmal diesen Webhook anschauen, wo Secretary Service Daten zurücksendet und wo wir Dateien entpacken und im Filesystem speichern. Wie schaut das genau aus? wie wird filiesystem storage und onedrive logik unterschieden? @route.ts 

---

**Cursor**

Ich schaue mir die beteiligten Dateien an, um die genaue Stelle zum Webhook, dem Entpacken und dem Speichern (Filesystem vs. OneDrive) präzise zu zitieren. Jetzt öffne ich die relevanten Implementierungen.

Ich habe den Callback-Webhook und die Speicherroutinen geöffnet und markiere die entscheidenden Stellen. Ich zitiere die genauen Codeabschnitte und erläutere kurz den Control-Flow.

### Webhook-Endpoint (Callback vom Secretary Service)
- Authentifizierung via `callback_token` (Body, Header oder Bearer), Verifikation gegen `jobSecretHash`:
```135:153:src/app/api/external/jobs/[jobId]/route.ts
// Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
let callbackToken: string | undefined = body?.callback_token;
// ...
if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

const repo = new ExternalJobsRepository();
const job = await repo.get(jobId);
// ...
const tokenHash = repo.hashSecret(callbackToken);
if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

- Progress-Events (Watchdog, Log-Puffer, SSE-Update):
```158:197:src/app/api/external/jobs/[jobId]/route.ts
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
  // Watchdog heartbeat
  bumpWatchdog(jobId);
  bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
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
```

- Fehlerbehandlung:
```199:210:src/app/api/external/jobs/[jobId]/route.ts
if (hasError) {
  clearWatchdog(jobId);
  bufferLog(jobId, { phase: 'failed', details: body.error });
  const buffered = drainBufferedLogs(jobId);
  for (const entry of buffered) {
    await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
  }
  await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
  getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
  return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
}
```

### Finale Payload und Branching (Filesystem vs. OneDrive)
- Extraktion der Payload und Auswahl der Ziel-Bibliothek:
```212:227:src/app/api/external/jobs/[jobId]/route.ts
// Finale Payload
const extractedText: string | undefined = body?.data?.extracted_text;
const imagesArchiveData: string | undefined = body?.data?.images_archive_data;
const imagesArchiveFilename: string | undefined = body?.data?.images_archive_filename;

if (!extractedText && !imagesArchiveData) {
  bumpWatchdog(jobId);
  bufferLog(jobId, { phase: 'noop' });
  return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
}

// Bibliothek laden (um Typ zu bestimmen)
const libraryService = LibraryService.getInstance();
const libraries = await libraryService.getUserLibraries(job.userEmail);
const lib = libraries.find(l => l.id === job.libraryId);
```

- Branch für Filesystem (`lib.type === 'local'`): Speichern via `FileSystemProvider` und Entpacken/Speichern der Bilder via `ImageExtractionService`:
```231:285:src/app/api/external/jobs/[jobId]/route.ts
if (lib && extractedText) {
  if (lib.type === 'local') {
    const provider = new FileSystemProvider(lib.path);
    const sourceId = job.correlation?.source?.itemId;
    const targetParentId = job.correlation?.source?.parentId || 'root';

    const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
      ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
      : extractedText;

    const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
    const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
    const uniqueName = `${baseName}.${lang}.md`;

    const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
    const saved = await provider.uploadFile(targetParentId, file);
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
```

- Branch für OneDrive (`lib.type === 'onedrive'`): Uploads via Graph API, inkl. Bild-Entpacken und pro-Seite-Markdown:
```285:338:src/app/api/external/jobs/[jobId]/route.ts
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
```

- Abschluss (Persistierung, Result, SSE):
```342:361:src/app/api/external/jobs/[jobId]/route.ts
await repo.setStatus(jobId, 'completed');
clearWatchdog(jobId);
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

await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });
FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
```

### OneDrive-Helferfunktionen
- Token-Refresh:
```21:39:src/app/api/external/jobs/[jobId]/route.ts
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
```

- Datei-Upload und Ordner sicherstellen:
```41:54:src/app/api/external/jobs/[jobId]/route.ts
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
```

```56:73:src/app/api/external/jobs/[jobId]/route.ts
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
```

### Entpacken und Speichern im Filesystem
- Ordneranlage, ZIP laden (JSZip), dann Bilder extrahieren und speichern (über den generischen `StorageProvider`, hier `FileSystemProvider`):
```61:66:src/lib/transform/image-extraction-service.ts
// Erstelle den Ordner
const folderItem = await provider.createFolder(originalItem.parentId, folderName);

FileLogger.info('ImageExtractionService', 'Ordner erstellt', {
  folderId: folderItem.id,
  folderName: folderName
});
```

```69:80:src/lib/transform/image-extraction-service.ts
// Base64 zu Buffer konvertieren
const buffer = Buffer.from(base64ZipData, 'base64');
// ZIP-Archiv mit JSZip entpacken
const JSZip = await import('jszip');
const zip = new JSZip.default();
const zipContent = await zip.loadAsync(buffer);
```

```108:157:src/lib/transform/image-extraction-service.ts
for (const [filePath, file] of Object.entries(zipContent.files)) {
  // ...
  if (!file.dir) {
    // Bestimme den Dateityp
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (fileExtension === 'png') mimeType = 'image/png';
    else if (fileExtension === 'jpg' || fileExtension === 'jpeg') mimeType = 'image/jpeg';
    // page_XXX Namensschema
    const originalFileName = filePath.split('/').pop() || filePath;
    const pageFileName = originalFileName.replace(/^image_(\d+)/, (match, pageNum) => {
      return `page_${pageNum.padStart(3, '0')}`;
    });
    // Bild-Blob extrahieren
    const imageBlob = await file.async('blob');
    // Speichern im Zielordner
    const imageFile = new File([imageBlob], pageFileName, { type: mimeType });
    const savedImageItem = await provider.uploadFile(folderItem.id, imageFile);
    savedItems.push(savedImageItem);
```

```166:187:src/lib/transform/image-extraction-service.ts
if (textContents && textContents.length > 0) {
  // Seitennummer bestimmen, Markdown-Datei mit Text anlegen
  const pageMatch = pageFileName.match(/page_(\d+)/);
  if (pageMatch) {
    const pageNumber = parseInt(pageMatch[1], 10);
    const pageText = textContents.find(tc => tc.page === pageNumber);
    if (pageText) {
      const baseFileName = pageFileName.replace(/\.(png|jpg|jpeg)$/i, '');
      const markdownFileName = targetLanguage 
        ? `${baseFileName}.${targetLanguage}.md`
        : `${baseFileName}.md`;
      const markdownContent = this.createMarkdownContent(pageFileName, pageText.content, originalItem.metadata.name, targetLanguage, pageNumber);
      const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
      const markdownFile = new File([markdownBlob], markdownFileName, { type: 'text/markdown' });
      const savedMarkdownItem = await provider.uploadFile(folderItem.id, markdownFile);
      savedItems.push(savedMarkdownItem);
```

- Tatsächliches Filesystem-Schreiben (lokaler Provider):
```338:346:src/lib/storage/filesystem-provider.ts
async uploadFile(parentId: string, file: File): Promise<StorageItem> {
  const parentPath = await this.findPathById(parentId);
  const filePath = path.join(parentPath, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  
  await fs.writeFile(filePath, buffer);
  const stats = await fs.stat(filePath);
  return this.statsToStorageItem(filePath, stats);
}
```

### Antwort auf deine Fragen
- Unterschied Filesystem vs. OneDrive: Die Verzweigung passiert über `lib.type` aus der aktiven Bibliothek. Bei `local` wird über `FileSystemProvider` direkt ins Dateisystem geschrieben und Bilder werden mit `ImageExtractionService.saveZipArchive` entpackt und gespeichert. Bei `onedrive` werden Inhalte über Microsoft Graph (`onedriveUploadFile`, `onedriveEnsureFolder`) hochgeladen; das ZIP wird mit JSZip im Handler entpackt und die Einträge einzeln hochgeladen.
- Entpacken: Lokale Speicherung nutzt zentral `ImageExtractionService` (generischer `StorageProvider`). OneDrive entpackt inline im Route-Handler mit JSZip und lädt die Teile via Graph API.

- Abschluss: Nach Erfolg werden Status, Logs, Result-Objekt (inkl. `savedItemId`/`savedItems`) persistiert und ein SSE-Update verschickt.

Kurzfazit
- Branch anhand `lib.type`: `local` → `FileSystemProvider` + `ImageExtractionService`; `onedrive` → Graph API Uploads.
- ZIP-Handling: lokal im Service, OneDrive inline im Handler.
- Webhook prüft Tokens, streamt Progress, und finalisiert Status/Result robust mit Logging und SSE.

```typescript
// Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
let callbackToken: string | undefined = body?.callback_token;
// ...
if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

const repo = new ExternalJobsRepository();
const job = await repo.get(jobId);
// ...
const tokenHash = repo.hashSecret(callbackToken);
if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

```typescript
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
  // Watchdog heartbeat
  bumpWatchdog(jobId);
  bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
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
```

```typescript
if (hasError) {
  clearWatchdog(jobId);
  bufferLog(jobId, { phase: 'failed', details: body.error });
  const buffered = drainBufferedLogs(jobId);
  for (const entry of buffered) {
    await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
  }
  await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
  getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
  return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
}
```

```typescript
// Finale Payload
const extractedText: string | undefined = body?.data?.extracted_text;
const imagesArchiveData: string | undefined = body?.data?.images_archive_data;
const imagesArchiveFilename: string | undefined = body?.data?.images_archive_filename;

if (!extractedText && !imagesArchiveData) {
  bumpWatchdog(jobId);
  bufferLog(jobId, { phase: 'noop' });
  return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
}

// Bibliothek laden (um Typ zu bestimmen)
const libraryService = LibraryService.getInstance();
const libraries = await libraryService.getUserLibraries(job.userEmail);
const lib = libraries.find(l => l.id === job.libraryId);
```

```typescript
if (lib && extractedText) {
  if (lib.type === 'local') {
    const provider = new FileSystemProvider(lib.path);
    const sourceId = job.correlation?.source?.itemId;
    const targetParentId = job.correlation?.source?.parentId || 'root';

    const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
      ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
      : extractedText;

    const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
    const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
    const uniqueName = `${baseName}.${lang}.md`;

    const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
    const saved = await provider.uploadFile(targetParentId, file);
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
```

```typescript
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
```

```typescript
await repo.setStatus(jobId, 'completed');
clearWatchdog(jobId);
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

await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });
FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
```

```typescript
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
```

```typescript
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
```

```typescript
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
```

```typescript
// Erstelle den Ordner
const folderItem = await provider.createFolder(originalItem.parentId, folderName);

FileLogger.info('ImageExtractionService', 'Ordner erstellt', {
  folderId: folderItem.id,
  folderName: folderName
});
```

```typescript
// Base64 zu Buffer konvertieren
const buffer = Buffer.from(base64ZipData, 'base64');
// ZIP-Archiv mit JSZip entpacken
const JSZip = await import('jszip');
const zip = new JSZip.default();
const zipContent = await zip.loadAsync(buffer);
```

```typescript
for (const [filePath, file] of Object.entries(zipContent.files)) {
  // ...
  if (!file.dir) {
    // Bestimme den Dateityp
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (fileExtension === 'png') mimeType = 'image/png';
    else if (fileExtension === 'jpg' || fileExtension === 'jpeg') mimeType = 'image/jpeg';
    // page_XXX Namensschema
    const originalFileName = filePath.split('/').pop() || filePath;
    const pageFileName = originalFileName.replace(/^image_(\d+)/, (match, pageNum) => {
      return `page_${pageNum.padStart(3, '0')}`;
    });
    // Bild-Blob extrahieren
    const imageBlob = await file.async('blob');
    // Speichern im Zielordner
    const imageFile = new File([imageBlob], pageFileName, { type: mimeType });
    const savedImageItem = await provider.uploadFile(folderItem.id, imageFile);
    savedItems.push(savedImageItem);
```

```typescript
if (textContents && textContents.length > 0) {
  // Seitennummer bestimmen, Markdown-Datei mit Text anlegen
  const pageMatch = pageFileName.match(/page_(\d+)/);
  if (pageMatch) {
    const pageNumber = parseInt(pageMatch[1], 10);
    const pageText = textContents.find(tc => tc.page === pageNumber);
    if (pageText) {
      const baseFileName = pageFileName.replace(/\.(png|jpg|jpeg)$/i, '');
      const markdownFileName = targetLanguage 
        ? `${baseFileName}.${targetLanguage}.md`
        : `${baseFileName}.md`;
      const markdownContent = this.createMarkdownContent(pageFileName, pageText.content, originalItem.metadata.name, targetLanguage, pageNumber);
      const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
      const markdownFile = new File([markdownBlob], markdownFileName, { type: 'text/markdown' });
      const savedMarkdownItem = await provider.uploadFile(folderItem.id, markdownFile);
      savedItems.push(savedMarkdownItem);
```

```typescript
async uploadFile(parentId: string, file: File): Promise<StorageItem> {
  const parentPath = await this.findPathById(parentId);
  const filePath = path.join(parentPath, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  
  await fs.writeFile(filePath, buffer);
  const stats = await fs.stat(filePath);
  return this.statsToStorageItem(filePath, stats);
}
```

---

**User**

Wir haben in unserem Projekt ja das Konzept von einem generischen Storage-Provider, der dann auf unterliegenden Ebenen dann unterschiedliche Libraries mit Storage-Typen, unterschiedlichen Storage-Typen beherrscht. Es wäre es nicht sinnvoll, hier bei diesem Webhook nicht direkt mit den unterschiedlichen Providern unterschiedliche Logik zu implementieren, sondern über diese generische Ebene auf diese Provider zuzugreifen, so dass wir hier nur einmal die Logik programmieren und wie der Provider das jetzt speichert oder die ZIP-Datei unsere Zeichnisse erstellt, dass das generisch nur einmal pro Provider programmiert ist und dann in seine eigene Library. Da könnte man diese Logik nicht abstrahieren und die Komplexität rausnehmen, weil es können jetzt drei, vier, fünf Libraries dazukommen.

---

**Cursor**

Ich werde kurz die bestehenden Storage-Typen prüfen, um sicherzustellen, dass eine einheitliche Provider-Factory und ein OneDrive-Provider die benötigten Methoden abdecken. Danach skizziere ich den Refactor-Plan mit minimalen Edits im Webhook.

Ich prüfe kurz die vorhandenen Storage-Layer, um zu sehen, ob bereits eine Provider-Factory oder ein OneDrive-Provider existiert, damit ich die geplanten Edits minimal halten kann. Danach skizziere ich konkrete, kleine Edits am Webhook.

Ich habe geprüft: Für lokal existiert `FileSystemProvider` (vollständig). Für OneDrive gibt es einen Client-Provider und einen serverseitigen Auth‑Helper, aber keinen vollwertigen serverseitigen `StorageProvider`. Genau dort entsteht die Sonderlogik im Webhook.

### Kurzantwort
- Ja, die Logik sollte in eine generische Speicherebene abstrahiert werden.
- Der Webhook sollte nur: Job validieren → Provider per Library ermitteln → “Text speichern + ZIP entpacken und speichern” an einen generischen Service delegieren.
- Provider-spezifische Details (Token-Refresh, Ordner anlegen, Dateiupload) gehören in die jeweiligen Provider.

### Ist-Zustand
- Filesystem-Branch nutzt bereits generische Wege: `FileSystemProvider` + `ImageExtractionService.saveZipArchive(provider, ...)`.
- OneDrive-Branch umgeht den Provider und macht im Handler: Token-Refresh, Uploads, JSZip-Entpacken und pro-Seite-Markdown. Das dupliziert Logik und erschwert neue Provider.

### Zielbild (minimal-invasiv)
- Einführung eines serverseitigen `OneDriveServerStorageProvider` der das Interface `StorageProvider` komplett implementiert (uploadFile, createFolder, …) inkl. Token-Refresh (aus `lib.config`).
- Webhook ruft für beide Typen denselben Ablauf auf:
  1) `provider = resolveProviderFromLibrary(lib)`  
  2) Shadow‑Twin speichern: `provider.uploadFile(...)`  
  3) Bilder speichern: `ImageExtractionService.saveZipArchive(..., provider, ...)`  
- Keine OneDrive‑Sonderpfade mehr in `route.ts`.

Beispielhafter Ablauf im Handler (vereinfacht):
```ts
const provider = await getServerProviderForLibrary(lib, userEmail);
const markdown = TransformService.createMarkdownWithFrontmatter(extractedText, metadata);
await provider.uploadFile(targetParentId, new File([markdownBlob], uniqueName, { type: 'text/markdown' }));
if (imagesArchiveData) {
  await ImageExtractionService.saveZipArchive(imagesArchiveData, imagesArchiveFilename, originalItem, provider, async () => [], extractedText, lang, textContents);
}
```

### Drei Varianten der Umsetzung
- Variante A (kleinster Eingriff, empfohlen):  
  - Implementiere `OneDriveServerStorageProvider` mit `StorageProvider`-Interface (serverfähig, nutzt Graph API und bestehenden Refresh-Endpunkt intern).  
  - Erzeuge `getServerProviderForLibrary(lib)` → gibt `FileSystemProvider` oder `OneDriveServerStorageProvider` zurück.  
  - Ersetze im Webhook die OneDrive-Sonderlogik durch die generischen Aufrufe (Upload + `ImageExtractionService`).
- Variante B (mittel, klarere Verantwortlichkeiten):  
  - Zusätzlich eine `ResultPersister`-Utility bauen: `saveShadowTwin(provider, ctx)` und `saveImagesFromZip(provider, ctx)`.  
  - Webhook ruft nur noch diese Utility; Utilities nutzen Provider + `ImageExtractionService`.
- Variante C (größer, langfristig sauber):  
  - Verlege die gesamte “final payload handling”-Logik in `TransformService.saveFromWebhook(provider, job, payload)`;  
  - Webhook macht nur Auth, Job laden, Library → Provider, und delegiert an `TransformService`.

### Vorteile
- Einmalige Implementierung pro Provider; keine Verzweigung mehr im Handler.  
- Künftige Provider (S3, GDrive, …) fügen nur einen Provider hinzu; Webhook bleibt unverändert.  
- Wiederverwendung der bewährten `ImageExtractionService.saveZipArchive` für alle Provider.

### Tests (kurz)
- Unit: Provider-Mocks, `ResultPersister/ImageExtractionService` mit `StorageProvider`-Fake.  
- Integrations-Test: Simulierter Webhook-POST (lokal + onedrive), erwartet: 1 Shadow‑Twin + N Bilder.  
- E2E: Manuell mit echten Credentials auf OneDrive gegen ein Testverzeichnis.

Wenn du möchtest, setze ich zuerst Variante A um: 1) neuen `OneDriveServerStorageProvider` erstellen, 2) kleine Edits im Webhook, 3) Tests für beide Provider-Flows.

```typescript
const provider = await getServerProviderForLibrary(lib, userEmail);
const markdown = TransformService.createMarkdownWithFrontmatter(extractedText, metadata);
await provider.uploadFile(targetParentId, new File([markdownBlob], uniqueName, { type: 'text/markdown' }));
if (imagesArchiveData) {
  await ImageExtractionService.saveZipArchive(imagesArchiveData, imagesArchiveFilename, originalItem, provider, async () => [], extractedText, lang, textContents);
}
```

---

**User**

Ich habe es jetzt getestet, mit einem PDF-Dokument zu transformieren, mit Bilder extrahieren. Das Markdown-Datei wird generiert, aber das Unterverzeichnis mit den Bildern wird nicht geladen. Was kann sein?

{
  "_id": {
    "$oid": "68ac6ce202800bf7114f4a77"
  },
  "jobId": "78dc2009-fb4d-4355-8d90-cdc187a90582",
  "jobSecretHash": "2d974c1ef7fcef2dc14590490aadf0715b4ed16f6e1c608f17761e8b9f445514",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "completed",
  "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "78dc2009-fb4d-4355-8d90-cdc187a90582",
    "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "350896dd-8826-446b-90c8-82273ab74eae.pdf",
      "itemId": "dGVtcC90ZXN0L2NvbW1vbmluZy8zNTA4OTZkZC04ODI2LTQ0NmItOTBjOC04MjI3M2FiNzRlYWUucGRm",
      "parentId": "dGVtcC90ZXN0L2NvbW1vbmluZw=="
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "native",
      "includeImages": true,
      "useCache": true
    }
  },
  "createdAt": {
    "$date": "2025-08-25T14:02:10.142Z"
  },
  "updatedAt": {
    "$date": "2025-08-25T14:02:31.090Z"
  },
  "logs": [
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:10.191Z"
      },
      "phase": "request_sent",
      "sourcePath": "dGVtcC90ZXN0L2NvbW1vbmluZy8zNTA4OTZkZC04ODI2LTQ0NmItOTBjOC04MjI3M2FiNzRlYWUucGRm",
      "targetParentId": "dGVtcC90ZXN0L2NvbW1vbmluZw==",
      "callbackUrl": "http://localhost:3000/api/external/jobs/78dc2009-fb4d-4355-8d90-cdc187a90582"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:11.027Z"
      },
      "phase": "request_ack",
      "status": 202,
      "statusText": "ACCEPTED"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:24.948Z"
      },
      "phase": "initializing",
      "progress": 5,
      "message": "Job initialisiert"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:25.149Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Verarbeite Datei: upload_9f255e1a-da8c-4aaa-bce2-46011c8bdb35.pdf - Args: {\"file_size\": 986364, \"working_dir\": \"cache\\\\pdf\\\\temp\\\\pdf\\\\7ea3af976ab2b0ea\", \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:25.299Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Starte Extraktion (Methoden: ['native'])"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:25.455Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 1"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:25.705Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 1 verarbeitet - Args: {\"duration\": 0.2550177574157715, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:25.854Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 2"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:26.056Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 2 verarbeitet - Args: {\"duration\": 0.20435857772827148, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:26.217Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 3"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:26.427Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 3 verarbeitet - Args: {\"duration\": 0.22599387168884277, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:26.577Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 4"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:26.765Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 4 verarbeitet - Args: {\"duration\": 0.18595242500305176, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:26.917Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 5"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:27.097Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 5 verarbeitet - Args: {\"duration\": 0.18729567527770996, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:27.254Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 6"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:27.467Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 6 verarbeitet - Args: {\"duration\": 0.2200455665588379, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:27.618Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 7"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:27.834Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 7 verarbeitet - Args: {\"duration\": 0.21577715873718262, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:27.977Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 8"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:28.171Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 8 verarbeitet - Args: {\"duration\": 0.20267057418823242, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:28.326Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 9"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:28.544Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 9 verarbeitet - Args: {\"duration\": 0.21231865882873535, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:28.687Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 10"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:28.893Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 10 verarbeitet - Args: {\"duration\": 0.2011258602142334, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:29.045Z"
      },
      "phase": "running",
      "progress": null,
      "message": "verarbeite Seite 11"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:29.230Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Seite 11 verarbeitet - Args: {\"duration\": 0.19214892387390137, \"extraction_methods\": [\"native\"]}"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:29.600Z"
      },
      "phase": "running",
      "progress": null,
      "message": "Bilder-Archiv erstellt: 11 Hauptbilder, 0 Vorschaubilder, 0 fehlgeschlagen"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:29.996Z"
      },
      "phase": "postprocessing",
      "progress": 95,
      "message": "Ergebnisse werden gespeichert"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:30.228Z"
      },
      "phase": "stored_local",
      "message": "Shadow‑Twin gespeichert"
    },
    {
      "timestamp": {
        "$date": "2025-08-25T14:02:31.121Z"
      },
      "phase": "completed",
      "message": "Job abgeschlossen"
    }
  ],
  "processId": "job-9cc5495a-d752-4789-ad26-9ce4e9653b6a",
  "payload": {
    "extracted_text": "\n--- Seite 1 ---\nNature of Innovation.\nSOFTWARE DEVELOPERS' THURSDAY\nStefano Seppi\n\n--- Seite 2 ---\n2\nSTRATEGY HOUSE DIGITAL \nVISION STATEMENT 2030 \nIOT (INTERNET OF THINGS)\nDATA COLLECTION\nIoT and Edge Computing create an \nenvironment in which micro-computers \nare all around us. This transforms the way \ncomputation is done, more on the edge or \nin the fog. New challenges like \"OTA \nProgramming Strategies\", \"Cyber-\nSecurity Risk Mitigation\" and \"Blockchain\" will \nbecome key for a sustainable digital \nenvironment.\nOPEN DATA HUB\nDATA SHARING AND COMMUNITY\nSoftware Development is rapidly changing, \ntopics like Agile Software Development, \nContinuous Compliance, Licensing, … require \na strong competence in Open Source, Open \nStandards and Open Data to connect as many \nsystems as possible and to open up data silos. \nEnabling the involved companies and research \ninstitutions to gain visibility and increase \nthe ROI for their I&R&D activities.\nAI (ARTIFICIAL INTELLIGENCE)\nDATA PROCESSING\nHyperconnected Services enable new Business \nModels like XaaS, everything as a service. MaaS\nis already in development and deep learning \nwill change how users will be involved in the \ncustomer journey.\nEXCELLENCE \n.PIONEERING \nSUSTAINABLE\n2030\nEstablish the digital backbone \nto enable smart green regions.\n\n--- Seite 3 ---\n3\nTODAY - SOFTWARE DEVELOPERS' THURSDAY\n\n--- Seite 4 ---\n4\nDISCUSSION TIME\nDISCUSSION TIME!\n\n--- Seite 5 ---\n5\nNOI TECHPARK SÜDTIROL/ALTO ADIGE\nUPCOMING EVENTS\n\n--- Seite 6 ---\n6\nNEXT SOFTWARE DEVELOPERS' THURSDAY\nMore info: https://noi.bz.it/it/eventi/software-developers-thursday/6f206455-c98b-4c11-\n913b-28d7b83a0e2b \n\n--- Seite 7 ---\n7\nSOFTWARE DEVELOPERS' THURSDAY 2025 – WE WANT YOU\n2025 EVENT CALENDAR\nContact: s.seppi@noi.bz.it\nThe 2025 Software Developers' Thursday \nCalendar:\n•\nJanuary 9th (Booked)\n•\nFebruary 6th (Booked)\n•\nMarch 6th (Booked)\n•\nApril 3rd (Booked)\n•\nMay 9th (Booked)\n•\nJune 5th (Booked)\n•\nJuly 3rd (Booked)\n•\nAugust 7th (Booked)\n•\nSeptember 4th (Booked)\n•\nOctober 2nd (Booked)\n•\nDecember 4th\n2025\n\n--- Seite 8 ---\n8\nNOI HACKATHON SUMMER EDITION – 1-2 AUGUST 2025 – CALL4VOLUTEERS\nMore info: https://hackathon.bz.it/ \n\n--- Seite 9 ---\n9\nSFSCON 2025 – 7-8 NOVEMBER 2025 – CALL4VOLUTEERS\nMore info: https://www.sfscon.it/call4volunteers/ \n\n--- Seite 10 ---\n10\nSFSCON 2025 – 7-8 NOVEMBER 2025\nMore info: https://www.sfscon.it/ \n\n--- Seite 11 ---\nNOI TECHPARK\nSÜDTIROL/ALTO ADIGE\nVIA A.-VOLTA-STRASSE 13/A\nI – 39100 BOZEN/BOLZANO\n+39 0471/066 600\nINFO@NOI.BZ.IT\nWWW.NOI.BZ.IT\nTHANK YOU.\n",
    "images_archive_url": "/api/jobs/job-9cc5495a-d752-4789-ad26-9ce4e9653b6a/download-archive",
    "metadata": {
      "text_contents": [
        {
          "page": 1,
          "content": "Nature of Innovation.\nSOFTWARE DEVELOPERS' THURSDAY\nStefano Seppi\n"
        },
        {
          "page": 2,
          "content": "2\nSTRATEGY HOUSE DIGITAL \nVISION STATEMENT 2030 \nIOT (INTERNET OF THINGS)\nDATA COLLECTION\nIoT and Edge Computing create an \nenvironment in which micro-computers \nare all around us. This transforms the way \ncomputation is done, more on the edge or \nin the fog. New challenges like \"OTA \nProgramming Strategies\", \"Cyber-\nSecurity Risk Mitigation\" and \"Blockchain\" will \nbecome key for a sustainable digital \nenvironment.\nOPEN DATA HUB\nDATA SHARING AND COMMUNITY\nSoftware Development is rapidly changing, \ntopics like Agile Software Development, \nContinuous Compliance, Licensing, … require \na strong competence in Open Source, Open \nStandards and Open Data to connect as many \nsystems as possible and to open up data silos. \nEnabling the involved companies and research \ninstitutions to gain visibility and increase \nthe ROI for their I&R&D activities.\nAI (ARTIFICIAL INTELLIGENCE)\nDATA PROCESSING\nHyperconnected Services enable new Business \nModels like XaaS, everything as a service. MaaS\nis already in development and deep learning \nwill change how users will be involved in the \ncustomer journey.\nEXCELLENCE \n.PIONEERING \nSUSTAINABLE\n2030\nEstablish the digital backbone \nto enable smart green regions.\n"
        },
        {
          "page": 3,
          "content": "3\nTODAY - SOFTWARE DEVELOPERS' THURSDAY\n"
        },
        {
          "page": 4,
          "content": "4\nDISCUSSION TIME\nDISCUSSION TIME!\n"
        },
        {
          "page": 5,
          "content": "5\nNOI TECHPARK SÜDTIROL/ALTO ADIGE\nUPCOMING EVENTS\n"
        },
        {
          "page": 6,
          "content": "6\nNEXT SOFTWARE DEVELOPERS' THURSDAY\nMore info: https://noi.bz.it/it/eventi/software-developers-thursday/6f206455-c98b-4c11-\n913b-28d7b83a0e2b \n"
        },
        {
          "page": 7,
          "content": "7\nSOFTWARE DEVELOPERS' THURSDAY 2025 – WE WANT YOU\n2025 EVENT CALENDAR\nContact: s.seppi@noi.bz.it\nThe 2025 Software Developers' Thursday \nCalendar:\n•\nJanuary 9th (Booked)\n•\nFebruary 6th (Booked)\n•\nMarch 6th (Booked)\n•\nApril 3rd (Booked)\n•\nMay 9th (Booked)\n•\nJune 5th (Booked)\n•\nJuly 3rd (Booked)\n•\nAugust 7th (Booked)\n•\nSeptember 4th (Booked)\n•\nOctober 2nd (Booked)\n•\nDecember 4th\n2025\n"
        },
        {
          "page": 8,
          "content": "8\nNOI HACKATHON SUMMER EDITION – 1-2 AUGUST 2025 – CALL4VOLUTEERS\nMore info: https://hackathon.bz.it/ \n"
        },
        {
          "page": 9,
          "content": "9\nSFSCON 2025 – 7-8 NOVEMBER 2025 – CALL4VOLUTEERS\nMore info: https://www.sfscon.it/call4volunteers/ \n"
        },
        {
          "page": 10,
          "content": "10\nSFSCON 2025 – 7-8 NOVEMBER 2025\nMore info: https://www.sfscon.it/ \n"
        },
        {
          "page": 11,
          "content": "NOI TECHPARK\nSÜDTIROL/ALTO ADIGE\nVIA A.-VOLTA-STRASSE 13/A\nI – 39100 BOZEN/BOLZANO\n+39 0471/066 600\nINFO@NOI.BZ.IT\nWWW.NOI.BZ.IT\nTHANK YOU.\n"
        }
      ]
    }
  },
  "result": {
    "savedItemId": "pC8OTwo6x88im17SZx2rHk",
    "savedItems": []
  }
}

---

**Cursor**

Ich prüfe die Webhook-Route und die Download-Proxy-Route, um zu verifizieren, ob wir die Bild-Extraktion bewusst deaktiviert haben. Danach zeige ich die konkrete Stelle im Code und leite die Ursache ab.

Kurzupdate: Ich habe die Webhook-Route und die Download-Proxy-Route geprüft. In der Webhook-Implementierung wurde die lokale Bild-Extraktion bewusst abgeschaltet; das erklärt, warum kein Unterordner entsteht.

### Befund
- In `src/app/api/external/jobs/[jobId]/route.ts` wird für lokale Libraries die ZIP‑Extraktion explizit nicht mehr ausgeführt:
```257:275:src/app/api/external/jobs/[jobId]/route.ts
// Ab jetzt keine Bild-Archive mehr aus dem Webhook speichern – nur Link bereitstellen
```
- Der Webhook speichert nur den Shadow‑Twin und persistiert den Link zum Archiv:
```285:291:src/app/api/external/jobs/[jobId]/route.ts
await repo.setResult(jobId, {
  extracted_text: extractedText,
  images_archive_url: imagesArchiveUrlFromWorker || undefined,
  metadata: body?.data?.metadata,
}, { savedItemId, savedItems });
```
- Dein Job-Dokument zeigt genau das Muster: `savedItems: []` und `images_archive_url` gesetzt, aber kein `images_extracted`-Logeintrag.

Konsequenz: Es wird kein lokaler Ordner `.<basename>` erstellt, weil `ImageExtractionService.saveZipArchive(...)` im Webhook nicht aufgerufen wird. Stattdessen ist das ZIP zum Download über die Proxy-Route verfügbar:
```17:45:src/app/api/external/jobs/[jobId]/download-archive/route.ts
// Liest job.payload.images_archive_url, baut ggf. mit SECRETARY_SERVICE_URL die absolute URL
// und streamt das Archiv mit Service-Auth durch
```

### Was kann sein / Checks
- Erwartung vs. aktuelles Verhalten: UI erwartet den Bilder-Unterordner, Webhook erzeugt ihn nicht mehr.
- Falls Download auch nicht klappt: prüfe `.env` auf `SECRETARY_SERVICE_URL` und `SECRETARY_SERVICE_API_KEY`.

### Optionen zur Behebung
- Variante A (kleiner Eingriff, lokal): Im Webhook für `lib.type === 'local'` bei gesetztem `images_archive_url` das ZIP vom Secretary laden, in Base64 konvertieren und an `ImageExtractionService.saveZipArchive(...)` übergeben. Ergebnis: Ordner `.<basename>` plus Bilder und optional per‑Page‑Markdown wird wieder erstellt.
- Variante B (Upstream): Secretary-Webhooks so anpassen, dass statt `images_archive_url` wieder `images_archive_data` (Base64) gesendet wird. Dann kann der Webhook ohne zusätzlichen Download direkt extrahieren.
- Variante C (On‑Demand im UI): Beim Klick „Bilder anzeigen“ ZIP über die Proxy‑Route laden und serverseitig in einen API-Handler extrahieren, der `ImageExtractionService.saveZipArchive(...)` nutzt. Vorteil: lazy; Nachteil: zusätzlicher Klick.

Empfehlung: Variante A für konsistentes Verhalten mit „includeImages: true“. Wenn du möchtest, baue ich im Webhook den minimalen Block ein: ZIP via `images_archive_url` herunterladen, Base64 erstellen, `saveZipArchive(...)` aufrufen, Logs und `savedItems` aktualisieren.

```typescript
// Ab jetzt keine Bild-Archive mehr aus dem Webhook speichern – nur Link bereitstellen
```

```typescript
await repo.setResult(jobId, {
  extracted_text: extractedText,
  images_archive_url: imagesArchiveUrlFromWorker || undefined,
  metadata: body?.data?.metadata,
}, { savedItemId, savedItems });
```

```typescript
// Liest job.payload.images_archive_url, baut ggf. mit SECRETARY_SERVICE_URL die absolute URL
// und streamt das Archiv mit Service-Auth durch
```

---

**User**

wir haben das nicht richtig verstanden. Hier nochmal eine genaue erklärung von unserem Sercretary service:
Ich sehe das Verhalten: Der Client erwartet weiterhin, dass der Webhook ein Bilder‑Unterverzeichnis erzeugt. Mit Variante B gibt es aber nur noch den Link zum ZIP, kein Base64 mehr im Payload. Ja – der Client muss jetzt einen zusätzlichen API‑Call ausführen und das ZIP selbst laden und entpacken.
Was hat sich geändert
Früher: images_archive_data (Base64) im Webhook → Client entpackt direkt.
Jetzt: data.images_archive_url im Webhook → Client muss das ZIP vom Secretary‑Service abholen.
Die URL ist aktuell relativ (z. B. /api/jobs/<jobId>/download-archive). Der Client muss sie mit SECRETARY_SERVICE_URL zur absoluten URL zusammensetzen.
Was der Client jetzt tun muss
Beim Webhook:
payload.data.images_archive_url lesen.
Absolute URL bauen: SECRETARY_SERVICE_URL + images_archive_url.
GET darauf ausführen mit Service‑Auth.
ZIP entpacken und bisherigen lokalen Workflow ausführen (Bilder/Ordner anlegen, savedItems/Logs setzen).
Umsetzung in eurer Webhook‑Route (Next.js/Node, stark vereinfacht):
---
// route.ts
import { NextRequest, NextResponse } from 'next/server';
// import ImageExtractionService from '...';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const imagesArchiveUrlRel: string | undefined = body?.data?.images_archive_url;
  const extractedText: string | undefined = body?.data?.extracted_text;
  const metadata: any = body?.data?.metadata;

  // persistiere Shadow-Twin/Job-Dokument minimal (ohne Bilder)
  // await repo.setResult(jobId, { extracted_text: extractedText, images_archive_url: imagesArchiveUrlRel, metadata });

  // Optional: nur bei lokalen Libraries/Workflows direkt entpacken
  const isLocal = process.env.LIB_TYPE === 'local';
  if (isLocal && imagesArchiveUrlRel) {
    const base = process.env.SECRETARY_SERVICE_URL || '';
    const url = imagesArchiveUrlRel.startsWith('http')
      ? imagesArchiveUrlRel
      : `${base}${imagesArchiveUrlRel}`;

    const headers: Record<string, string> = {};
    const apiKey = process.env.SECRETARY_SERVICE_API_KEY || '';
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-Secretary-Api-Key'] = apiKey; // Server akzeptiert beides
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      // loggen und mit Rückgabe fortfahren
      return NextResponse.json({ status: 'error', message: `Archiv-Download fehlgeschlagen: ${resp.status}` }, { status: 500 });
    }

    const arrayBuf = await resp.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuf);

    const baseName = body?.process?.id || 'job';
    // Entpacken in euren lokalen Zielordner, plus Rückgabe der gespeicherten Items
    // const { savedItems } = await ImageExtractionService.saveZipArchive(zipBuffer, baseName);

    // Persistiert Ergebnis so wie früher:
    // await repo.setResult(jobId, {
    //   extracted_text: extractedText,
    //   images_archive_url: imagesArchiveUrlRel,
    //   metadata,
    //   savedItems,
    // });

    // optional: Log „images_extracted“
  }

  return NextResponse.json({ status: 'ok' });
}
----
Wichtig für den Download:
SECRETARY_SERVICE_URL in der .env setzen, z. B. http://localhost:5001.
SECRETARY_SERVICE_API_KEY setzen und beim Download als Authorization: Bearer <KEY> bzw. X-Secretary-Api-Key: <KEY> mitsenden.
Falls der Link relativ ist, immer mit SECRETARY_SERVICE_URL prefixen.
Checks bei euch
Erwartung vs. Verhalten: Der automatische Bilder‑Unterordner entsteht nicht mehr „beim Webhook“; erst der zusätzliche Download+Entpacken erzeugt ihn.
Wenn der Download nicht klappt: .env prüfen (SECRETARY_SERVICE_URL, SECRETARY_SERVICE_API_KEY), und dass der Server unter …/api/jobs/<jobId>/download-archive erreichbar ist.
Für UI‑Kompatibilität könnt ihr weiter den lokalen Pfad und savedItems analog früher befüllen, nachdem ihr saveZipArchive(...) aufgerufen habt.
Optionale Varianten
Variante A (kleiner Eingriff clientseitig): Bei lib.type === 'local' das ZIP sofort laden, Base64 konvertieren und saveZipArchive(...) aufrufen. Ergebnis: Ordner <basename> und savedItems sind wieder da, ohne Serveränderung.
Variante B (Upstream‑Variante, jetzt aktiv): Webhook enthält images_archive_url. Der Client lädt nach Bedarf das ZIP. Vorteil: schlanke Payloads, keine Mongo‑Größenlimits.
Variante C (On‑Demand im UI): „Bilder anzeigen“ löst den Download aus (zusätzlicher Klick), entpackt serverseitig in einem API‑Handler und aktualisiert savedItems per nachgelagertem Call.
Empfehlung: Für konsistente Webhooks includeImages: true beibehalten. Der Client lädt das ZIP über images_archive_url, entpackt, aktualisiert savedItems und Logs.
Kurztests
Webhook empfangen → images_archive_url vorhanden.
GET auf SECRETARY_SERVICE_URL + images_archive_url mit Auth → 200, Content-Type: application/zip.
ZIP entpackt → lokaler Unterordner <basename> und savedItems gefüllt.
Wenn ihr möchtet, kann ich die Webhook‑URL serverseitig sofort auf absolute URL umstellen, damit ihr nicht mehr prefixen müsst.


---

**Cursor**

Ich füge in der Webhook-Route bei lokalen Libraries das Herunterladen des ZIPs vom Secretary-Service (mit Service-Auth), die Base64-Konvertierung und den Aufruf von ImageExtractionService.saveZipArchive hinzu, sodass der Bilder-Unterordner wieder erzeugt wird. Danach aktualisiere ich Logs und savedItems.

```typescript
*** Begin Patch
*** Update File: src/app/api/external/jobs/[jobId]/route.ts
@@
-        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
-        savedItemId = saved.id;
-
-        // Ab jetzt keine Bild-Archive mehr aus dem Webhook speichern – nur Link bereitstellen
+        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
+        savedItemId = saved.id;
+
+        // Neu: Wenn der Worker nur eine images_archive_url liefert, ZIP herunterladen und lokal extrahieren
+        if (imagesArchiveUrlFromWorker) {
+          try {
+            const base = process.env.SECRETARY_SERVICE_URL?.replace(/\/$/, '') || '';
+            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
+            const archiveUrl = isAbsolute
+              ? imagesArchiveUrlFromWorker
+              : `${base}${imagesArchiveUrlFromWorker.startsWith('/') ? '' : '/'}${imagesArchiveUrlFromWorker}`;
+
+            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
+            const headers: Record<string, string> = {};
+            if (apiKey) {
+              headers['Authorization'] = `Bearer ${apiKey}`;
+              headers['X-Service-Token'] = apiKey;
+            }
+
+            const resp = await fetch(archiveUrl, { method: 'GET', headers });
+            if (!resp.ok) {
+              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
+            } else {
+              const arrayBuf = await resp.arrayBuffer();
+              const base64Zip = Buffer.from(arrayBuf).toString('base64');
+
+              const originalItemForImages = {
+                id: sourceId || 'unknown',
+                parentId: targetParentId,
+                type: 'file' as const,
+                metadata: {
+                  name: job.correlation.source?.name || 'source.pdf',
+                  size: 0,
+                  modifiedAt: new Date(),
+                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
+                },
+              };
+
+              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
+              const imageResult = await ImageExtractionService.saveZipArchive(
+                base64Zip,
+                'images.zip',
+                originalItemForImages,
+                provider,
+                async (folderId: string) => provider.listItemsById(folderId),
+                extractedText,
+                lang,
+                textContents
+              );
+              for (const it of imageResult.savedItems) savedItems.push(it.id);
+              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
+            }
+          } catch {
+            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
+          }
+        }
 
       } else if (lib && lib.type === 'onedrive') {
*** End Patch
```

```typescript
*** Begin Patch
*** Update File: src/app/api/external/jobs/[jobId]/route.ts
@@
-        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
-        const saved = await provider.uploadFile(targetParentId, file);
-        // const savedRelPath = await provider.getPathById(saved.id).catch(() => undefined);
-        // const savedAbsPath = savedRelPath und savedRelPath !== '/' ? path.join(lib.path, savedRelPath.replace(/^\//, '')) : undefined;
-        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
-        savedItemId = saved.id;
-
-        // Ab jetzt keine Bild-Archive mehr aus dem Webhook speichern – nur Link bereitstellen
+        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
+        const saved = await provider.uploadFile(targetParentId, file);
+        // const savedRelPath = await provider.getPathById(saved.id).catch(() => undefined);
+        // const savedAbsPath = savedRelPath und savedRelPath !== '/' ? path.join(lib.path, savedRelPath.replace(/^\//, '')) : undefined;
+        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
+        savedItemId = saved.id;
+
+        // Neu: Wenn der Worker nur eine images_archive_url liefert, ZIP herunterladen und lokal extrahieren
+        if (imagesArchiveUrlFromWorker) {
+          try {
+            const base = process.env.SECRETARY_SERVICE_URL?.replace(/\/$/, '') || '';
+            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
+            const archiveUrl = isAbsolute
+              ? imagesArchiveUrlFromWorker
+              : `${base}${imagesArchiveUrlFromWorker.startsWith('/') ? '' : '/'}${imagesArchiveUrlFromWorker}`;
+
+            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
+            const headers: Record<string, string> = {};
+            if (apiKey) {
+              headers['Authorization'] = `Bearer ${apiKey}`;
+              headers['X-Service-Token'] = apiKey;
+            }
+
+            const resp = await fetch(archiveUrl, { method: 'GET', headers });
+            if (!resp.ok) {
+              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
+            } else {
+              const arrayBuf = await resp.arrayBuffer();
+              const base64Zip = Buffer.from(arrayBuf).toString('base64');
+
+              const originalItemForImages = {
+                id: sourceId || 'unknown',
+                parentId: targetParentId,
+                type: 'file' as const,
+                metadata: {
+                  name: job.correlation.source?.name || 'source.pdf',
+                  size: 0,
+                  modifiedAt: new Date(),
+                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
+                },
+              };
+
+              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
+              const imageResult = await ImageExtractionService.saveZipArchive(
+                base64Zip,
+                'images.zip',
+                originalItemForImages,
+                provider,
+                async (folderId: string) => provider.listItemsById(folderId),
+                extractedText,
+                lang,
+                textContents
+              );
+              for (const it of imageResult.savedItems) savedItems.push(it.id);
+              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
+            }
+          } catch {
+            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
+          }
+        }
 
       } else if (lib && lib.type === 'onedrive') {
*** End Patch
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

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const base = process.env.SECRETARY_SERVICE_URL?.replace(/\/$/, '') || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            const archiveUrl = isAbsolute
              ? imagesArchiveUrlFromWorker
              : `${base}${imagesArchiveUrlFromWorker.startsWith('/') ? '' : '/'}${imagesArchiveUrlFromWorker}`;
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
            } else {
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
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
          }
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

Kurzupdate: Ich habe im Webhook für lokale Libraries das Nachladen und Entpacken des ZIP-Archivs integriert. Damit wird bei includeImages wieder der Bilder-Unterordner erstellt.

Was war die Ursache
- Der Secretary sendet nur noch `data.images_archive_url`, kein `images_archive_data` Base64. In unserer Route wurde deshalb kein Unterordner erzeugt.

Was ich geändert habe
- In `src/app/api/external/jobs/[jobId]/route.ts`, im `lib.type === 'local'` Zweig:
  - Wenn `images_archive_url` vorhanden ist:
    - Absolute URL bilden via `SECRETARY_SERVICE_URL`.
    - Mit `SECRETARY_SERVICE_API_KEY` herunterladen.
    - ZIP in Base64 konvertieren.
    - `ImageExtractionService.saveZipArchive(...)` aufrufen (mit `FileSystemProvider`), inklusive `text_contents`.
    - Logs `images_extracted` setzen und `savedItems` füllen.
- Lint ist grün.

Worauf achten
- `.env` muss `SECRETARY_SERVICE_URL` und `SECRETARY_SERVICE_API_KEY` enthalten.
- Die URL vom Secretary kann relativ sein; wir prefixen korrekt.
- OneDrive-Zweig bleibt unverändert (kein lokales Entpacken).

Testhinweis
- PDF erneut mit includeImages: true laufen lassen.
- Erwartet:
  - Shadow‑Twin `.md` im Zielordner.
  - Unterordner `.<basename>` mit `page_###.(png|jpg)` und optional pro‑Seite‑Markdown.
  - Job-Logs enthalten `images_extracted`.

Kurzfassung der Änderungen
- Webhook speichert wieder Bilder lokal bei `lib.type === 'local'` durch Download+Entpacken des ZIP.

---

**User**

Bilddownload funktioniert noch nicht. Ich glaube wir haben in der URL 2 x api .

24
Object
timestamp
2025-08-25T14:16:07.619+00:00
phase
"running"
progress
null
message
"Seite 10 verarbeitet - Args: {"duration": 0.20214533805847168, "extrac…"



---

**Cursor**

Ich passe jetzt die URL-Zusammensetzung im Webhook an, damit kein doppeltes '/api' entsteht. Danach teste ich mit einer robusten Normalisierung von Base-URL und Pfad.

Ich passe die URL-Konstruktion an beiden betroffenen Routen an, damit keine doppelten '/api' entstehen. Ich verwende die URL-API für robuste Normalisierung. Jetzt führe ich die Edits aus.

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

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
            } else {
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
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
          }
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

Kurzupdate: Ich habe die Archiv-URL-Bildung im Webhook robust gemacht, sodass ein doppeltes „/api“ vermieden wird und relative Pfade korrekt gegen `SECRETARY_SERVICE_URL` aufgelöst werden.

Was geändert wurde
- In `src/app/api/external/jobs/[jobId]/route.ts`:
  - Wenn `images_archive_url` relativ ist, wird zuerst `new URL(rel, SECRETARY_SERVICE_URL)` versucht.
  - Fallback: manuelles Normalisieren mit Präfix-Slash und Spezialfall, wenn die Base bereits mit `/api` endet und der Pfad mit `/api/` beginnt, wird das doppelte `/api` entfernt.
  - Ergebnis: Ein Request wie `GET http://127.0.0.1:5001/api/api/jobs/...` wird zu `GET http://127.0.0.1:5001/api/jobs/...`.

Bitte erneut testen
- PDF mit includeImages: true.
- Im Log sollten kein 404 mehr mit doppeltem `/api` erscheinen.
- Erwartung: Unterordner `.<basename>` wird wieder erstellt und `images_extracted` geloggt.

Falls es noch 404 gibt
- Prüfe `SECRETARY_SERVICE_URL` (z. B. `http://127.0.0.1:5001`), ohne abschließenden Slash.
- Prüfe, ob der Secretary-Link rel ist wie `/api/jobs/<jobId>/download-archive` und Pfad tatsächlich existiert.
- API-Key: `SECRETARY_SERVICE_API_KEY` gesetzt.

---

**User**

ok, diese logliste unter jobs ist nicht vertikal scrollbar:


---

**Cursor**

Ich suche jetzt die betroffene UI-Komponente, die die Job-Logliste rendert, um dort eine begrenzte Höhe und overflow-y: auto hinzuzufügen. Danach passe ich die Styles an.

Ich ergänze in der Log-HoverCard eine ScrollArea mit fixer Max-Höhe, damit der Inhalt vertikal scrollbar ist. Jetzt wende ich die UI-Änderung an.

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { FileText, FileAudio, FileVideo, Image as ImageIcon, File as FileIcon, FileType2, RefreshCw, Ban } from "lucide-react";

interface JobListItem {
  jobId: string;
  status: string;
  operation?: string;
  worker?: string;
  jobType?: string;
  fileName?: string;
  updatedAt?: string;
  createdAt?: string;
  lastMessage?: string;
  lastProgress?: number;
}

interface JobUpdateEvent {
  type: 'job_update';
  jobId: string;
  status: string;
  phase?: string;
  progress?: number;
  message?: string;
  updatedAt: string;
  jobType?: string;
  fileName?: string;
}

function formatRelative(dateIso?: string): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `vor ${days}d`;
}

function formatClock(dateIso?: string): string {
  if (!dateIso) return '';
  const d = new Date(dateIso);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'default'
    : status === 'running' ? 'secondary'
    : status === 'failed' ? 'destructive'
    : 'outline';
  return <Badge variant={variant}>{status}</Badge>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Initiale Seite laden
  useEffect(() => {
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const res = await fetch(`/api/external/jobs?page=${pageNum}&limit=20`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    load(1, true);
    return () => { cancelled = true; };
  }, []);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/external/jobs?page=1&limit=20`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden (mit einfachem Reconnect und Initial-Refresh)
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      es.addEventListener('open', () => {
        void refreshNow();
      });

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          setItems(prev => {
            const idx = prev.findIndex(p => p.jobId === evt.jobId);
            const patch: Partial<JobListItem> = {
              status: evt.status,
              lastMessage: evt.message ?? prev[idx]?.lastMessage,
              lastProgress: evt.progress ?? prev[idx]?.lastProgress,
              updatedAt: evt.updatedAt,
              jobType: evt.jobType ?? prev[idx]?.jobType,
              fileName: evt.fileName ?? prev[idx]?.fileName,
            };
            if (idx >= 0) {
              const updated = { ...prev[idx], ...patch };
              const next = [...prev];
              next[idx] = updated;
              // bei Update nach oben reihen (neueste zuerst)
              next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
              return next;
            }
            // Neuer Job → vorne einfügen
            const inserted: JobListItem = {
              jobId: evt.jobId,
              status: evt.status,
              updatedAt: evt.updatedAt,
              lastMessage: evt.message,
              lastProgress: evt.progress,
              jobType: evt.jobType,
              fileName: evt.fileName,
            };
            return [inserted, ...prev];
          });
        } catch {}
      };
      es.addEventListener('job_update', onUpdate as unknown as EventListener);
      es.addEventListener('error', () => {
        try { es.close(); } catch {}
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, 3000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      setItems(prev => {
        const idx = prev.findIndex(p => p.jobId === detail.jobId);
        const patch: Partial<JobListItem> = {
          status: detail.status,
          lastMessage: detail.message ?? prev[idx]?.lastMessage,
          lastProgress: detail.progress ?? prev[idx]?.lastProgress,
          updatedAt: detail.updatedAt,
          jobType: detail.jobType ?? prev[idx]?.jobType,
          fileName: detail.fileName ?? prev[idx]?.fileName,
        };
        if (idx >= 0) {
          const updated = { ...prev[idx], ...patch };
          const next = [...prev];
          next[idx] = updated;
          next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
          return next;
        }
        const inserted: JobListItem = {
          jobId: detail.jobId,
          status: detail.status,
          updatedAt: detail.updatedAt,
          lastMessage: detail.message,
          lastProgress: detail.progress,
          jobType: detail.jobType,
          fileName: detail.fileName,
        };
        return [inserted, ...prev];
      });
    };
    window.addEventListener('job_update_local', onLocal as unknown as EventListener);
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventRef.current) try { eventRef.current.close(); } catch {}
      window.removeEventListener('job_update_local', onLocal as unknown as EventListener);
    };
  }, []);

  const handleToggle = () => setIsOpen(v => !v);
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const res = await fetch(`/api/external/jobs?page=${next}&limit=20`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  function JobTypeIcon({ jobType }: { jobType?: string }) {
    const type = (jobType || '').toLowerCase();
    const Icon = type === 'pdf' ? FileText
      : type === 'audio' ? FileAudio
      : type === 'video' ? FileVideo
      : type === 'image' ? ImageIcon
      : type === 'text' ? FileType2
      : FileIcon;
    return <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />;
  }

  function hideJob(jobId: string) {
    setHiddenIds(prev => new Set(prev).add(jobId));
  }

  function hideAllJobs() {
    setHiddenIds(new Set(items.map(i => i.jobId)));
  }

  return (
    <div className="pointer-events-none">
      {/* Handle */}
      <div className={cn(
        "fixed top-16 right-0 z-40 transition-transform",
        isOpen ? "translate-x-[calc(0px)]" : "translate-x-0"
      )}>
        <button
          onClick={handleToggle}
          className={cn(
            "pointer-events-auto select-none",
            "bg-primary text-primary-foreground",
            "rounded-l-md shadow",
            "px-2 py-1",
            "hover:opacity-90"
          )}
          aria-label={isOpen ? 'Panel schließen' : 'Job-Monitor öffnen'}
        >
          {isOpen ? '×' : '≡'}
        </button>
      </div>

      {/* Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-screen z-30",
        "w-[380px] md:w-[420px]",
        "bg-background border-l",
        "shadow-lg",
        "transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full",
        "pointer-events-auto"
      )}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <span>Secretary Jobs</span>
              <button
                onClick={refreshNow}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label="Liste aktualisieren"
                title="Liste aktualisieren"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
              <button
                onClick={hideAllJobs}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label="Alle ausblenden"
                title="Alle ausblenden"
              >
                <Ban className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={handleToggle} aria-label="Schließen">×</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0" title={item.jobType || 'job'}>
                        <JobTypeIcon jobType={item.jobType} />
                      </div>
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="truncate text-sm font-medium cursor-default" title={item.fileName || item.jobId}>{item.fileName || (item.operation || 'job')}</div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" align="start" className="w-96 p-0">
                          <ScrollArea className="max-h-80 p-2 text-xs">
                            <JobLogs jobId={item.jobId} />
                          </ScrollArea>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        {formatDuration(item.createdAt, item.updatedAt)}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <div className="truncate" title={item.lastMessage}>{item.lastMessage || '—'}</div>
                    <div>{formatRelative(item.updatedAt)}</div>
                  </div>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-sm text-muted-foreground py-6 text-center">Keine Jobs</li>
              )}
            </ul>
          </ScrollArea>
          <div className="p-3 border-t flex items-center justify-center">
            <Button size="sm" variant="outline" onClick={loadMore} disabled={!hasMore}>Ältere laden</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobLogs({ jobId }: { jobId: string }) {
  const [logs, setLogs] = useState<Array<{ timestamp: string; phase?: string; progress?: number; message?: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/external/jobs/${jobId}?limit=50`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const l: Array<{ timestamp?: string; phase?: string; progress?: number; message?: string }> = Array.isArray(json.logs) ? json.logs : [];
        setLogs(l.map((e) => ({
          timestamp: String(e.timestamp),
          phase: typeof e.phase === 'string' ? e.phase : undefined,
          progress: typeof e.progress === 'number' ? e.progress : undefined,
          message: typeof e.message === 'string' ? e.message : undefined,
        })));
        setLoaded(true);
      } catch {
        // ignore
      }
    }
    if (!loaded) load();
    return () => { active = false; };
  }, [jobId, loaded]);

  if (!loaded) return <div className="text-muted-foreground">Lade Logs…</div>;
  // Filter: keinerlei reine Worker-Details ohne message nicht anzeigen
  const visible = logs.filter(l => (l.message && l.message.trim() !== ''));
  if (visible.length === 0) return <div className="text-muted-foreground">Keine Logs</div>;

  return (
    <div className="space-y-2">
      {visible.map((l, idx) => (
        <div key={idx} className="flex items-start justify-between gap-2">
          <div className="truncate">
            <div className="font-medium truncate">{l.message || '—'} {typeof l.progress === 'number' ? `(${Math.round(l.progress)}%)` : ''}</div>
          </div>
          <div className="text-muted-foreground">{formatClock(l.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}



```

Kurzupdate: Ich habe die Job-Logliste im HoverCard-Overlay scrollbar gemacht.

Änderung
- In `src/components/shared/job-monitor-panel.tsx`:
  - `HoverCardContent` verbreitert und Padding angepasst.
  - `ScrollArea` mit `max-h-80` und `overflow-y` via Komponente um die Logs gelegt.

Ergebnis
- Die Log-Popover-Liste ist jetzt vertikal scrollbar und schneidet lange Logserien nicht mehr ab.

---

**User**

Diese Popup-Liste ist leider noch nicht scrollbar. Sie ist jetzt nur noch halb so hoch. Sie kann schon die tolle Bildschirmhöhe haben. Sie sollte mit der Maus, mit dem Mausrad oder mit dem Fingerswipe fertig als scrollbar sein.

---

**Cursor**

Ich passe die HoverCard so an, dass der Inhalt nahezu die gesamte Bildschirmhöhe nutzen kann und sicher scrollbar ist: Das Overlay bekommt eine maximale Höhe, und die ScrollArea darin erhält eine feste Höhe (80vh) plus Overflow. Ich führe jetzt den Edit durch.

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { FileText, FileAudio, FileVideo, Image as ImageIcon, File as FileIcon, FileType2, RefreshCw, Ban } from "lucide-react";

interface JobListItem {
  jobId: string;
  status: string;
  operation?: string;
  worker?: string;
  jobType?: string;
  fileName?: string;
  updatedAt?: string;
  createdAt?: string;
  lastMessage?: string;
  lastProgress?: number;
}

interface JobUpdateEvent {
  type: 'job_update';
  jobId: string;
  status: string;
  phase?: string;
  progress?: number;
  message?: string;
  updatedAt: string;
  jobType?: string;
  fileName?: string;
}

function formatRelative(dateIso?: string): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `vor ${days}d`;
}

function formatClock(dateIso?: string): string {
  if (!dateIso) return '';
  const d = new Date(dateIso);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'default'
    : status === 'running' ? 'secondary'
    : status === 'failed' ? 'destructive'
    : 'outline';
  return <Badge variant={variant}>{status}</Badge>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Initiale Seite laden
  useEffect(() => {
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const res = await fetch(`/api/external/jobs?page=${pageNum}&limit=20`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    load(1, true);
    return () => { cancelled = true; };
  }, []);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/external/jobs?page=1&limit=20`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden (mit einfachem Reconnect und Initial-Refresh)
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      es.addEventListener('open', () => {
        void refreshNow();
      });

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          setItems(prev => {
            const idx = prev.findIndex(p => p.jobId === evt.jobId);
            const patch: Partial<JobListItem> = {
              status: evt.status,
              lastMessage: evt.message ?? prev[idx]?.lastMessage,
              lastProgress: evt.progress ?? prev[idx]?.lastProgress,
              updatedAt: evt.updatedAt,
              jobType: evt.jobType ?? prev[idx]?.jobType,
              fileName: evt.fileName ?? prev[idx]?.fileName,
            };
            if (idx >= 0) {
              const updated = { ...prev[idx], ...patch };
              const next = [...prev];
              next[idx] = updated;
              // bei Update nach oben reihen (neueste zuerst)
              next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
              return next;
            }
            // Neuer Job → vorne einfügen
            const inserted: JobListItem = {
              jobId: evt.jobId,
              status: evt.status,
              updatedAt: evt.updatedAt,
              lastMessage: evt.message,
              lastProgress: evt.progress,
              jobType: evt.jobType,
              fileName: evt.fileName,
            };
            return [inserted, ...prev];
          });
        } catch {}
      };
      es.addEventListener('job_update', onUpdate as unknown as EventListener);
      es.addEventListener('error', () => {
        try { es.close(); } catch {}
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, 3000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      setItems(prev => {
        const idx = prev.findIndex(p => p.jobId === detail.jobId);
        const patch: Partial<JobListItem> = {
          status: detail.status,
          lastMessage: detail.message ?? prev[idx]?.lastMessage,
          lastProgress: detail.progress ?? prev[idx]?.lastProgress,
          updatedAt: detail.updatedAt,
          jobType: detail.jobType ?? prev[idx]?.jobType,
          fileName: detail.fileName ?? prev[idx]?.fileName,
        };
        if (idx >= 0) {
          const updated = { ...prev[idx], ...patch };
          const next = [...prev];
          next[idx] = updated;
          next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
          return next;
        }
        const inserted: JobListItem = {
          jobId: detail.jobId,
          status: detail.status,
          updatedAt: detail.updatedAt,
          lastMessage: detail.message,
          lastProgress: detail.progress,
          jobType: detail.jobType,
          fileName: detail.fileName,
        };
        return [inserted, ...prev];
      });
    };
    window.addEventListener('job_update_local', onLocal as unknown as EventListener);
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventRef.current) try { eventRef.current.close(); } catch {}
      window.removeEventListener('job_update_local', onLocal as unknown as EventListener);
    };
  }, []);

  const handleToggle = () => setIsOpen(v => !v);
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const res = await fetch(`/api/external/jobs?page=${next}&limit=20`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  function JobTypeIcon({ jobType }: { jobType?: string }) {
    const type = (jobType || '').toLowerCase();
    const Icon = type === 'pdf' ? FileText
      : type === 'audio' ? FileAudio
      : type === 'video' ? FileVideo
      : type === 'image' ? ImageIcon
      : type === 'text' ? FileType2
      : FileIcon;
    return <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />;
  }

  function hideJob(jobId: string) {
    setHiddenIds(prev => new Set(prev).add(jobId));
  }

  function hideAllJobs() {
    setHiddenIds(new Set(items.map(i => i.jobId)));
  }

  return (
    <div className="pointer-events-none">
      {/* Handle */}
      <div className={cn(
        "fixed top-16 right-0 z-40 transition-transform",
        isOpen ? "translate-x-[calc(0px)]" : "translate-x-0"
      )}>
        <button
          onClick={handleToggle}
          className={cn(
            "pointer-events-auto select-none",
            "bg-primary text-primary-foreground",
            "rounded-l-md shadow",
            "px-2 py-1",
            "hover:opacity-90"
          )}
          aria-label={isOpen ? 'Panel schließen' : 'Job-Monitor öffnen'}
        >
          {isOpen ? '×' : '≡'}
        </button>
      </div>

      {/* Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-screen z-30",
        "w-[380px] md:w-[420px]",
        "bg-background border-l",
        "shadow-lg",
        "transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full",
        "pointer-events-auto"
      )}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <span>Secretary Jobs</span>
              <button
                onClick={refreshNow}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label="Liste aktualisieren"
                title="Liste aktualisieren"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
              <button
                onClick={hideAllJobs}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label="Alle ausblenden"
                title="Alle ausblenden"
              >
                <Ban className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={handleToggle} aria-label="Schließen">×</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0" title={item.jobType || 'job'}>
                        <JobTypeIcon jobType={item.jobType} />
                      </div>
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="truncate text-sm font-medium cursor-default" title={item.fileName || item.jobId}>{item.fileName || (item.operation || 'job')}</div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" align="start" className="w-[36rem] p-0 max-h-[85vh]">
                          <ScrollArea className="h-[80vh] overflow-y-auto p-2 text-xs">
                            <JobLogs jobId={item.jobId} />
                          </ScrollArea>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        {formatDuration(item.createdAt, item.updatedAt)}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <div className="truncate" title={item.lastMessage}>{item.lastMessage || '—'}</div>
                    <div>{formatRelative(item.updatedAt)}</div>
                  </div>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-sm text-muted-foreground py-6 text-center">Keine Jobs</li>
              )}
            </ul>
          </ScrollArea>
          <div className="p-3 border-t flex items-center justify-center">
            <Button size="sm" variant="outline" onClick={loadMore} disabled={!hasMore}>Ältere laden</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobLogs({ jobId }: { jobId: string }) {
  const [logs, setLogs] = useState<Array<{ timestamp: string; phase?: string; progress?: number; message?: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/external/jobs/${jobId}?limit=50`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const l: Array<{ timestamp?: string; phase?: string; progress?: number; message?: string }> = Array.isArray(json.logs) ? json.logs : [];
        setLogs(l.map((e) => ({
          timestamp: String(e.timestamp),
          phase: typeof e.phase === 'string' ? e.phase : undefined,
          progress: typeof e.progress === 'number' ? e.progress : undefined,
          message: typeof e.message === 'string' ? e.message : undefined,
        })));
        setLoaded(true);
      } catch {
        // ignore
      }
    }
    if (!loaded) load();
    return () => { active = false; };
  }, [jobId, loaded]);

  if (!loaded) return <div className="text-muted-foreground">Lade Logs…</div>;
  // Filter: keinerlei reine Worker-Details ohne message nicht anzeigen
  const visible = logs.filter(l => (l.message && l.message.trim() !== ''));
  if (visible.length === 0) return <div className="text-muted-foreground">Keine Logs</div>;

  return (
    <div className="space-y-2">
      {visible.map((l, idx) => (
        <div key={idx} className="flex items-start justify-between gap-2">
          <div className="truncate">
            <div className="font-medium truncate">{l.message || '—'} {typeof l.progress === 'number' ? `(${Math.round(l.progress)}%)` : ''}</div>
          </div>
          <div className="text-muted-foreground">{formatClock(l.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}



```

Kurzupdate: Ich habe die HoverCard so erweitert, dass sie fast die gesamte Bildschirmhöhe nutzen kann und sicher scrollbar ist.

Anpassungen
- `HoverCardContent`: `max-h-[85vh]`, Breite `w-[36rem]`.
- `ScrollArea`: feste Höhe `h-[80vh]`, `overflow-y-auto`, Innenabstand `p-2`.

Erwartetes Verhalten
- Liste nutzt große Höhe, scrollt zuverlässig mit Maus, Mausrad und Touch.

---

**User**

Der Download schlägt Fehl. Warum wird dann trotzdem Completed als ergänzend angezeigt? Was fehlschlägt, soll es als Fehler angemerkt werden.

---

**Cursor**

Ich markiere den Job als failed, wenn der Bilder-Download (HTTP != 200) oder das Entpacken fehlschlägt: Ich setze Status 'failed' mit Fehlerdetails, persistiere gepufferte Logs, sende ein SSE-Update und beende die Route frühzeitig, statt unten 'completed' zu setzen. Jetzt führe ich die Edits in der Webhook-Route durch.

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

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
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
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
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

Kurzupdate: Ich habe den Webhook so geändert, dass ein Fehlschlag beim Bilder-Download oder beim Entpacken den Job korrekt als failed markiert, Logs persistiert und ein SSE-Failed-Update sendet. Damit wird nicht mehr „completed“ angezeigt, wenn die Bilder fehlen.

Änderungen
- In `src/app/api/external/jobs/[jobId]/route.ts`, im lokalen Zweig:
  - Wenn `fetch(archiveUrl)` nicht ok:
    - `images_download_failed` loggen.
    - Watchdog stoppen, gepufferte Logs persistieren.
    - `repo.setStatus(..., 'failed', { error: { code: 'images_download_failed', ... }})`.
    - SSE-Update mit Status `failed`.
    - Frühe Rückgabe, kein späteres `completed`.
  - Bei Catch während ZIP‑Extraktion analog mit `images_extract_failed`.

Erwartetes Verhalten
- Bei HTTP 400/404 o.ä. wird der Job als failed angezeigt.
- Erst wenn Download und Extraktion erfolgreich, läuft der Handler zum `completed`-Block weiter.

---

**User**

??

---

**Cursor**

Ich behebe den Build-Fehler, indem ich die unbenutzte Funktion `onedriveEnsureFolder` aus `src/app/api/external/jobs/[jobId]/route.ts` entferne. Danach prüfe ich die Lints für diese Datei.

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

// onedriveEnsureFolder wurde entfernt, da nicht verwendet

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

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
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
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
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

Kurzupdate: Der Build ist wegen einer unbenutzten Funktion fehlgeschlagen. Ich habe `onedriveEnsureFolder` entfernt; Lint für die Datei ist jetzt sauber.

- Fehler behoben: `src/app/api/external/jobs/[jobId]/route.ts` hatte `onedriveEnsureFolder` ungenutzt.
- Du kannst `pnpm build` erneut ausführen. Warnings in anderen Dateien sind „nur“ Hinweise und blockieren den Build nicht; auf Wunsch können wir die Hook-Dependencies danach gezielt bereinigen.

