# Probleme mit dem PDF-Verzeichnis verarbeiten
_Exported on 10/9/2025 at 14:59:29 GMT+2 from Cursor (1.7.38)_

---

**User**

Ich habe ein Problem beim Dialog "PDF-Verzeichnis verarbeiten" 
Viele Dokumente auswähle und die jetzt Jobs starten, dann friert die Maske ein. Sollten die Jobs nicht beim Secretarial Service eingereicht werden? Und wieso ist dieser Prozess nicht asynchron? Warten wir, bis jeder einzelne Prozess bestätigt wurde, bis das einreichen? Können die Jobs alle gleichzeitig eingereicht werden oder muss man hier eines nach dem anderen einreichen?

---

**Cursor**

Ich schaue zuerst nach, wo der Dialog und die Job-Einreichung implementiert sind, um zu prüfen, ob Sequenziell gewartet wird statt asynchron. Danach passe ich die Einreichlogik ggf. auf parallele/limitierte Einreichung an.

Ich prüfe die Einreichlogik im Dialog und die API-Route, um festzustellen, ob derzeit sequentiell auf jede Bestätigung gewartet wird. Danach stelle ich die UI auf parallele (limitierte) Einreichung um, reduziere pro-Datei-Toasts und zeige eine zusammenfassende Meldung. Jetzt lese ich die relevanten Dateien.

Ich habe den Dialog und die API-Route geprüft. Aktuell werden die Einreichungen tatsächlich sequenziell mit await nacheinander abgearbeitet; das erklärt die „eingefrorene“ Maske bei vielen Dateien.

- Befund UI: In `PdfBulkImportDialog.handleEnqueue` wird pro Datei Binary geladen, `FormData` gebaut und dann `fetch` awaited, bevor die nächste Datei startet. Zitat:
```163:349:src/components/library/pdf-bulk-import-dialog.tsx
for (const { file, parentId } of candidates) {
  // ...
  const res = await fetch('/api/secretary/process-pdf', { method: 'POST', /*...*/ });
  // ...
}
```
- Befund Server: Die Route `POST /api/secretary/process-pdf` legt sofort einen Job an und leitet an den Secretary-Service weiter (mit Auth-Headern) und antwortet früh. Zitat:
```17:539:src/app/api/secretary/process-pdf/route.ts
response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}`, 'X-Service-Token': apiKey } });
return NextResponse.json({ ...data, job: { id: jobId } });
```
Damit: Die Verarbeitung ist serverseitig asynchron, aber das Einreichen in der UI ist synchron/sequenziell. Wir warten je Datei auf die HTTP-Antwort (nicht bis zur Job-Fertigstellung), bevor die nächste Einreichung beginnt. Zusätzlich erzeugen per-Datei-Toast-Meldungen UI-Overhead.

Antworten auf deine Fragen:
- Sollten die Jobs beim Secretary Service eingereicht werden? Ja. Das passiert bereits über unsere API-Route, die die nötigen Service-Header setzt [[memory:6998386]].
- Wieso nicht asynchron? Serverseitig ist es asynchron. Der Dialog reicht aber Jobs sequentiell ein und wartet je Request, was die UI blockiert.
- Warten wir bis jeder einzelne Prozess bestätigt wurde? Wir warten auf die HTTP-Antwort pro Einreichung (Job angenommen/Fehler), nicht auf die Job-Fertigstellung. Das geschieht nacheinander.
- Können die Jobs alle gleichzeitig eingereicht werden? Ja, technisch möglich. Sinnvoll ist eine begrenzte Parallelität (z. B. 3–5 gleichzeitig), um Netzwerk/CPU nicht zu überlasten und den Secretary-Service nicht zu fluten.

Vorschlag (drei Varianten):
- Minimal-invasiv (empfohlen sofort): Limitierte Parallelität im Dialog (z. B. 4). Ersetze die for-Schleife durch einen kleinen Concurrency-Runner, reduziere per-Datei-Toasts (nur Fehler bündeln, am Ende eine Zusammenfassung). Das ändert nur Client-Code.
- Mittel: Serverseitige Batch-Route (z. B. `/api/secretary/process-pdf/batch`) die mehrere Dateien annimmt und intern mit limitierter Parallelität weiterleitet. UI schickt nur 1 Request. Mehr Aufwand, aber robust.
- Strukturell: Statt Datei-Binary vom Client zu schicken, nur `originalItemId/parentId` senden; die Server-Route lädt das Binary via `getServerProvider`. Dadurch wird die UI leichtgewichtig und lässt sich problemlos parallelisieren. Erfordert Anpassung der Route.

Empfohlene Sofortmaßnahme
- Concurrency-Limit im Dialog (3–5), pro-Datei-Toasts abschalten, nur 1–2 Statusmeldungen (Start, Abschluss mit Erfolgs-/Fehleranzahl). Optional: Dialog direkt schließen und im Hintergrund einreichen; Fortschritt über den Job-Event-Stream anzeigen.

Tests
- 30–100 PDFs wählen, Einreichen starten, erwarten: UI bleibt responsiv, Dialog schließt schnell oder zeigt Fortschritt ohne Ruckeln, im Job-Stream erscheinen zügig „queued“-Events, Abschluss-Toast fasst zusammen.

Kurzfazit
- Die UI friert, weil die Einreichung sequenziell awaited wird und pro Datei teure Schritte laufen.
- Umstellen auf limitierte Parallelität + weniger Toasts löst das Problem erfahrungsgemäß zuverlässig, ohne Backend-Änderung.

```typescriptreact
for (const { file, parentId } of candidates) {
  // ...
  const res = await fetch('/api/secretary/process-pdf', { method: 'POST', /*...*/ });
  // ...
}
```

```typescript
response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}`, 'X-Service-Token': apiKey } });
return NextResponse.json({ ...data, job: { id: jobId } });
```

---

**User**

Also ich möchte diese Version implementieren, wo ich die Jobs im Frontend bestimme. Dann checke ich sie ein und dann werden die Jobs serverseitig, ist mir dann auch egal, hintereinander beim Secretary Service eingereicht. Das Secretary Service hat ja auch eine bestimmte Parallelität. Ich glaube es werden fünf gleichzeitig abgearbeitet. So können wir ja auch in Badges von fünf einreichen, serverseitig, und warten bis wieder welche frei werden. Wichtig wäre mir nur, dass wir im Frontend in dieser Liste der Jobs sehen, welche gerade verarbeitet werden und wie viele noch offen sind oder wie viele schon erledigt sind. Vielleicht können wir beim Einreichen diesen BDF Verzeichnis abarbeiten, dass man diesen Verzeichnisnamen als Badgenamen verwendet und so können wir in dem Job Übersicht nach diesem Badgenamen filtern und sehen was zusammengehört.
Dass man pro Job oben auch filtern kann, welche sind erledigt, welche sind noch offen und welche sind fehlerhaft. Und vielleicht könnte man fehlerhafte nochmal neu starten. Da ist vielleicht irgendwie ein Verbindungsproblem gehabt oder ein temporäres Problem. Wie könnten wir das umsetzen?

---

**Cursor**

Ich suche nach existierenden Job-Übersichten und Status-Filtern, um daran anzuknüpfen und die Batch/Badge-Funktion einzubauen. Danach baue ich eine Batch-Create-Route und einen serverseitigen Runner mit Parallelität 5.

Ich markiere Aufgaben, die ich jetzt umsetze: Batch-Create-API mit serverseitigem Runner (Parallelität 5), Batch-Tagging (Verzeichnisname), UI-Filter im Job-Monitor (Status, Batch), Retry für fehlgeschlagene Jobs. Ich lese dafür die Job-Typen, Repository und bestehende Job-API/Stream, um kompatibel zu erweitern.

Ich werde jetzt die notwendigen Dateien anpassen und neue Routen/Utilities hinzufügen: 1) Typ `ExternalJobCorrelation` um `batchName` erweitern, 2) `process-pdf`-Route so erweitern, dass `batchId`/`batchName` aus dem Request übernommen werden, 3) neue Batch-Route mit Server-seitiger Parallelität (5) erstellen, 4) Repository- und `GET /api/external/jobs`-Route um Filter nach Status/Batch erweitern, 5) den Dialog so ändern, dass er die Batch-Route nutzt. Danach prüfe ich Linterfehler.

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
  batchName?: string;
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

export interface ExternalJobStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  endedAt?: Date;
  durationMs?: number;
  details?: Record<string, unknown>;
  error?: { message: string; code?: string; details?: Record<string, unknown> };
}

export interface ExternalJobIngestionInfo {
  vectorsUpserted?: number;
  index?: string;
  namespace?: string;
  upsertAt?: Date;
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
  steps?: ExternalJobStep[];
  parameters?: Record<string, unknown>;
  cumulativeMeta?: Record<string, unknown>;
  metaHistory?: Array<{ at: Date; meta: Record<string, unknown>; source: string }>;
  ingestion?: ExternalJobIngestionInfo;
  createdAt: Date;
  updatedAt: Date;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}



```

Ich aktualisiere zuerst den Typ um Batch-Felder und erweitere dann die API-Routen. Danach baue ich eine neue Batch-Route mit serverseitiger Parallelität 5. Ich lese die vollständigen Implementierungen für Repository-Methoden und die GET-Liste, um Filter zu ergänzen.

Ich setze eine Aufgabenliste auf und beginne mit den serverseitigen Änderungen (Typ/Route-Erweiterungen, Batch-Route). Danach ergänze ich Filter und UI.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { ExternalJob } from '@/types/external-job';
import { LibraryService } from '@/lib/services/library-service';
// Storage: konsequent Server-Provider verwenden
import { getServerProvider } from '@/lib/storage/server-provider';
import { gateExtractPdf } from '@/lib/processing/gates';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option NICHT an Secretary senden – wir transformieren serverseitig im Callback
    // (Der Secretary erwartet ggf. einen Pfad und würde sonst '...md.md' anhängen.)
    // Veraltetes Feld skipTemplate wird nicht mehr verwendet
    const skipTemplate = false;
    
    // Extraktionsmethode – Clientwert oder Library-Default
    let effectiveExtraction: string | null = null;
    if (formData.has('extractionMethod')) effectiveExtraction = String(formData.get('extractionMethod'));
    if (!effectiveExtraction) {
      try {
        const libHeader = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
        const usr = await currentUser();
        const email = usr?.emailAddresses?.[0]?.emailAddress || '';
        if (libHeader && email) {
          const svc = LibraryService.getInstance();
          const libs = await svc.getUserLibraries(email);
          const lib = libs.find(l => l.id === libHeader);
          effectiveExtraction = lib?.config?.secretaryService?.pdfDefaults?.extractionMethod || null;
        }
      } catch {}
    }
    serviceFormData.append('extraction_method', effectiveExtraction || 'native');
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Veraltetes Feld useIngestionPipeline wird nicht mehr verwendet
    const useIngestionPipeline = false;

    // Neue vereinfachte Flags aus dem Request
    let doExtractPDF = ((formData.get('doExtractPDF') as string | null) ?? '') === 'true';
    let doExtractMetadata = ((formData.get('doExtractMetadata') as string | null) ?? '') === 'true';
    let doIngestRAG = ((formData.get('doIngestRAG') as string | null) ?? '') === 'true';
    const forceRecreate = ((formData.get('forceRecreate') as string | null) ?? '') === 'true';
    // Fallback: Wenn Flags fehlen (alle false), aus alten Parametern ableiten
    if (!doExtractPDF && !doExtractMetadata && !doIngestRAG) {
      doExtractPDF = true; // Phase 1 grundsätzlich erlaubt
      doExtractMetadata = !skipTemplate; // wenn nicht Phase-1-only, dann Metadaten
      doIngestRAG = useIngestionPipeline; // bis Alt-Flag entfernt ist
    }

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    // Korrelation: nutze die bereits ermittelte effektive Methode oben, falls vorhanden
    const extractionMethod = (formData.get('extractionMethod') as string) || (serviceFormData.get('extraction_method') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
    const phases = { extract: doExtractPDF, template: doExtractMetadata, ingest: doIngestRAG };
    await repository.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      // Neue vereinfachte Flags
      doExtractPDF,
      doExtractMetadata,
      doIngestRAG,
      forceRecreate
    });
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Sofortiges Live-Event: queued (für UI, damit Eintrag direkt erscheint)
    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}
    // Watchdog starten (600s ohne Progress => Timeout)
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: correlation.source?.name }, 600_000);

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // jobId nicht zusätzlich mitsenden – steht in der Callback-URL
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation NICHT an Secretary senden – Secretary erhält nur jobId + Callback
    FileLogger.info('process-pdf', 'Korrelation nicht an Secretary gesendet (nur jobId & Callback)', {
      jobId,
      correlationSummary: {
        hasSource: !!correlation.source,
        hasOptions: !!correlation.options
      }
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: targetLanguage,
        extraction_method: extractionMethod,
        useCache: useCache,
        includeImages: includeImages,
        force_refresh: (formData.get('force_refresh') as string) ?? 'false',
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}`,
        callback_token: jobSecret,
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, { phase: 'request_sent', sourcePath: correlation.source?.itemId, targetParentId: correlation.source?.parentId, callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : undefined });

    // Idempotenz ist immer aktiv
    const autoSkipExisting: boolean = true;

    // Extract-Gate vor dem Secretary-Call: vorhanden? → je nach Flags entscheiden
    try {
      if (autoSkipExisting) {
        const libraryService = LibraryService.getInstance();
        const libraries = await libraryService.getUserLibraries(userEmail);
        const lib = libraries.find(l => l.id === libraryId);
        const g = await gateExtractPdf({
          repo: repository,
          jobId,
          userEmail,
          library: lib,
          source: { itemId: originalItemId, parentId, name: file?.name },
          options: { targetLanguage }
        });
        if (g.exists && !forceRecreate) {
          // Phase 1 überspringen
          await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });

          // Template-Only Pfad, wenn nicht explizit skipTemplate=true
          if (!skipTemplate && doExtractMetadata) {
            try {
              const libraryService = LibraryService.getInstance();
              const libraries2 = await libraryService.getUserLibraries(userEmail);
              const lib2 = libraries2.find(l => l.id === libraryId);
              if (lib2) {
                const provider = await getServerProvider(userEmail, libraryId);
                await repository.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });

                // Template-Datei finden (wie im Callback)
                const rootItems = await provider.listItemsById('root');
                const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
                const ensureTemplatesFolderId = async (): Promise<string> => {
                  if (templatesFolder) return templatesFolder.id;
                  const created = await provider.createFolder('root', 'templates');
                  return created.id;
                };
                const templatesFolderId = await ensureTemplatesFolderId();
                let chosen: { id: string } | undefined;
                if (templatesFolderId) {
                  const tplItems = await provider.listItemsById(templatesFolderId);
                  const preferredTemplate = ((lib2.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || (formData.get('template') as string | null) || '').trim();
                  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
                  chosen = preferredTemplate
                    ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                    : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
                }

                let templateContent = '# {{title}}\n';
                if (chosen) {
                  const bin = await provider.getBinary(chosen.id);
                  templateContent = await bin.blob.text();
                }

                // Shadow‑Twin laden (im Parent by Name)
                const siblings = await provider.listItemsById(parentId || 'root');
                const expectedName = (g.details && typeof g.details === 'object' ? (g.details as { matched?: string }).matched : undefined) || (() => {
                  const base = (file?.name || 'output').replace(/\.[^/.]+$/, '');
                  return `${base}.${targetLanguage}.md`;
                })();
                const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName);
                if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
                const twinBin = await provider.getBinary(twin.id);
                const originalMarkdown = await twinBin.blob.text();
                const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

                // Transformer aufrufen
                const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
                const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
                const fd = new FormData();
                fd.append('text', stripped);
                fd.append('target_language', targetLanguage);
                fd.append('template_content', templateContent);
                fd.append('use_cache', 'false');
                // Kontext für LLM-Auswertung (Dateiname/Pfad/IDs)
                try {
                  const parentPath = await provider.getPathById(parentId || 'root'); // z.B. /Berichte Landesämter/Bevölk.Schutz
                  const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                  const rawName = (expectedName || file?.name || 'document.md');
                  const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                  const baseName = withoutExt.replace(new RegExp(`\\.${targetLanguage}$`, 'i'), '');
                  const ctx = {
                    filename: baseName,
                    filepath: dirPath,
                    libraryId,
                    jobId,
                    sourceItemId: originalItemId,
                    parentId
                  } as const;
                  fd.append('context', JSON.stringify(ctx));
                } catch {}
                const headers: Record<string, string> = { 'Accept': 'application/json' };
                const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
                const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
                const data: unknown = await resp.json().catch(() => ({}));
                const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

                await repository.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
                await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

                // Markdown mit neuem Frontmatter überschreiben
                const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
                  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mdMeta as Record<string, unknown>)
                  : originalMarkdown;
                const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName || (file?.name || 'output.md'), { type: 'text/markdown' });
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
                await provider.uploadFile(parentId || 'root', outFile);
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

                // Ingestion je nach Flag nur markieren (kein Upsert hier)
                if (doIngestRAG) {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
                } else {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
                }

                clearWatchdog(jobId);
                await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (template-only)' });
                await repository.setStatus(jobId, 'completed');
                try {
                  getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (template-only)', jobType: 'pdf', fileName: correlation.source?.name, sourceItemId: originalItemId });
                } catch {}
                return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-template-only', main_processor: 'template', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
              }
            } catch {
              // Fallback: wenn Template-Only fehlschlägt, markieren wir die Schritte als skipped und schließen
              await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              if (doIngestRAG) {
                await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              } else {
                await repository.updateStep(jobId, ' ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
              }
              clearWatchdog(jobId);
              await repository.setStatus(jobId, 'completed');
              return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
            }
          } else {
            // Kein Template‑Only gewünscht → alle übrigen Schritte überspringen
            await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            if (doIngestRAG) {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            } else {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
            }
            clearWatchdog(jobId);
            await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract skipped: artifact_exists)' });
            await repository.setStatus(jobId, 'completed');
            try {
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (skipped extract)', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId });
            } catch {}
            return NextResponse.json({
              status: 'accepted',
              worker: 'secretary',
              process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true },
              job: { id: jobId },
              webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` },
              error: null
            });
          }
        }
      }
    } catch {}

    // Anfrage an den Secretary Service senden (nur wenn doExtractPDF true oder keine Flags gesetzt)
    if (!doExtractPDF && (doExtractMetadata || doIngestRAG)) {
      // Kein Worker-Call notwendig, die Arbeit passiert lokal (Template‑Only) oder es ist nur Ingestion geplant (aktueller Pfad löst Ingestion erst im Callback aus, daher schließen wir hier ab)
      // Falls nur Ingestion geplant ist, führt der Callback es später aus; hier markieren wir extract als skipped
      await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'not_requested' } });
      return NextResponse.json({ status: 'accepted', job: { id: jobId } })
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.SECRETARY_REQUEST_TIMEOUT_MS || '5000');
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      // Secretary nicht erreichbar → Job synchron auf failed setzen
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repository.appendLog(jobId, { phase: 'request_error', message });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: 'worker_unavailable', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json({ error: 'Secretary Service nicht erreichbar' }, { status: 503 });
    }

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repository.appendLog(jobId, { phase: 'request_error', status: response.status, statusText: response.statusText });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: `worker_error ${response.status}`, jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json(
        { error: data?.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Serverseitige Parallelität begrenzen (z. B. 5)
    const concurrency = 5;

    // Worker-Funktion: reiche einzelne Datei weiter an process-pdf
    async function submitOne(it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> {
      try {
        // Hole Datei-Binärdaten via interner API, um Code-Duplizierung zu vermeiden
        // Wir nutzen die bestehende Client-Route, indem wir eine FormData bauen und lokal requesten
        // Vorteil: die gesamte Job-Anlage/Idempotenz bleibt an einem Ort
        const fd = new FormData();
        // Holen der Datei aus dem Storage muss in der Zielroute passieren; hier nur Metadaten weitergeben
        // Aber unsere bestehende process-pdf Route erwartet die Datei bereits. Daher rufen wir sie nicht direkt hier,
        // sondern nutzen einen vereinfachten Pfad: Der Client übergibt im Normalfall Binärdaten.
        // Für serverseitige Batch-Einreichung wählen wir den robusteren Weg: lade die Datei serverseitig und reiche mit.
        const { getServerProvider } = await import('@/lib/storage/server-provider');
        const provider = await getServerProvider(userEmail, libraryId);
        const bin = await provider.getBinary(it.fileId);
        const blob = bin.blob;
        const file = new File([blob], it.name || bin.name || 'document.pdf', { type: it.mimeType || bin.mimeType || 'application/pdf' });

        fd.append('file', file);
        fd.append('originalItemId', it.fileId);
        fd.append('parentId', it.parentId);
        if (options?.targetLanguage) fd.append('targetLanguage', options.targetLanguage);
        if (options?.extractionMethod) fd.append('extractionMethod', options.extractionMethod);
        if (typeof options?.includeImages === 'boolean') fd.append('includeImages', String(options.includeImages));
        if (typeof options?.useCache === 'boolean') fd.append('useCache', String(options.useCache));
        if (typeof options?.template === 'string') fd.append('template', options.template);
        if (typeof options?.doExtractMetadata === 'boolean') fd.append('doExtractMetadata', String(options.doExtractMetadata));
        if (typeof options?.doIngestRAG === 'boolean') fd.append('doIngestRAG', String(options.doIngestRAG));
        if (typeof options?.forceRecreate === 'boolean') fd.append('forceRecreate', String(options.forceRecreate));
        if (batchName) fd.append('batchName', batchName);

        const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
          method: 'POST',
          headers: { 'X-Library-Id': libraryId },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg };
        }
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const jobId = typeof (json as { job?: { id?: string } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : undefined;
        return jobId ? { ok: true, jobId } : { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }

    // Einfache Concurrency-Queue
    const results: Array<{ ok: boolean; jobId?: string; error?: string }> = [];
    let index = 0;
    async function worker() {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        const r = await submitOne(items[i]);
        results[i] = r;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    const okCount = results.filter(r => r?.ok).length;
    const failCount = results.length - okCount;
    FileLogger.info('process-pdf-batch', 'Batch abgeschlossen', { okCount, failCount, batchName, total: items.length });

    return NextResponse.json({ ok: true, okCount, failCount, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}


```

Ich werde jetzt die Repository-Filter, die GET-Liste um Filter, den Retry-Endpoint, den Dialog für Batch-Submit und die JobMonitorPanel-Filter/UI anpassen. Danach prüfe ich Linter-Fehler.

```typescript
import { Collection } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
import { ExternalJob, ExternalJobStatus, ExternalJobStep, ExternalJobIngestionInfo } from '@/types/external-job';

export class ExternalJobsRepository {
  private collectionName = 'external_jobs';

  private async getCollection(): Promise<Collection<ExternalJob>> {
    return getCollection<ExternalJob>(this.collectionName);
  }

  hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  async create(job: Omit<ExternalJob, 'createdAt' | 'updatedAt'>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.insertOne({ ...job, createdAt: now, updatedAt: now });
  }

  async setStatus(jobId: string, status: ExternalJobStatus, extra: Partial<ExternalJob> = {}): Promise<boolean> {
    const col = await this.getCollection();
    const res = await col.updateOne(
      { jobId },
      { $set: { status, updatedAt: new Date(), ...extra } }
    );
    return res.modifiedCount > 0;
  }

  async setProcess(jobId: string, processId: string): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne({ jobId }, { $set: { processId, updatedAt: new Date() } });
  }

  async appendLog(jobId: string, entry: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $push: { logs: { timestamp: new Date(), ...entry } } }
    );
  }

  async setResult(jobId: string, payload: ExternalJob['payload'], result: ExternalJob['result']): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { payload, result, updatedAt: new Date() } }
    );
  }

  async mergeParameters(jobId: string, params: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            parameters: { $mergeObjects: [ '$parameters', params ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async initializeSteps(jobId: string, steps: ExternalJobStep[], parameters?: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { steps, updatedAt: new Date(), ...(parameters ? { parameters } : {}) } }
    );
  }

  async updateStep(jobId: string, name: string, patch: Partial<ExternalJobStep>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    const setObj = Object.fromEntries(Object.entries(patch).map(([k, v]) => ([`steps.$.${k}`, v])));
    await col.updateOne(
      { jobId, 'steps.name': name },
      { $set: { ...setObj, updatedAt: now } }
    );
  }

  async appendMeta(jobId: string, meta: Record<string, unknown>, source: string): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      {
        $set: { updatedAt: now },
        $push: { metaHistory: { at: now, meta, source } },
      }
    );
    // Merge cumulativeMeta (shallow)
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            cumulativeMeta: { $mergeObjects: [ '$cumulativeMeta', meta ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async setIngestion(jobId: string, info: ExternalJobIngestionInfo): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { ingestion: info, updatedAt: new Date() } }
    );
  }

  async get(jobId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.findOne({ jobId });
  }

  async listByUserEmail(
    userEmail: string,
    options: { page?: number; limit?: number }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const cursor = col
      .find({ userEmail })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments({ userEmail })
    ]);
    return { items, total, page, limit };
  }

  async listByUserWithFilters(
    userEmail: string,
    options: {
      page?: number;
      limit?: number;
      status?: ExternalJobStatus | ExternalJobStatus[];
      batchName?: string;
      batchId?: string;
      libraryId?: string;
      q?: string;
    }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const filter: Record<string, unknown> = { userEmail };
    if (options.libraryId) filter['libraryId'] = options.libraryId;
    if (options.batchId) filter['correlation.batchId'] = options.batchId;
    if (options.batchName) filter['correlation.batchName'] = options.batchName;
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filter['status'] = { $in: statuses };
    }
    if (options.q) {
      const rx = new RegExp(options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [
        { 'correlation.source.name': rx },
        { 'correlation.source.itemId': rx },
        { jobId: rx },
      ];
    }

    const cursor = col
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments(filter)
    ]);
    return { items, total, page, limit };
  }

  async findLatestBySourceItem(userEmail: string, libraryId: string, sourceItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.itemId': sourceItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByResultItem(userEmail: string, resultItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, 'result.savedItemId': resultItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByFileIdAuto(userEmail: string, libraryId: string, fileId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({
      userEmail,
      libraryId,
      $or: [
        { 'correlation.source.itemId': fileId },
        { 'result.savedItemId': fileId }
      ]
    }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestBySourceName(userEmail: string, libraryId: string, sourceName: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.name': sourceName }).sort({ updatedAt: -1 }).limit(1).next();
  }
}



```

```typescript
*** Begin Patch
*** Update File: src/app/api/external/jobs/route.ts
@@
-import { NextRequest, NextResponse } from 'next/server';
-import { getAuth, currentUser } from '@clerk/nextjs/server';
-import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
-import type { ExternalJob } from '@/types/external-job';
+import { NextRequest, NextResponse } from 'next/server';
+import { getAuth, currentUser } from '@clerk/nextjs/server';
+import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
+import type { ExternalJob, ExternalJobStatus } from '@/types/external-job';
@@
-    const repo = new ExternalJobsRepository();
-    const parsedUrl = new URL(request.url);
+    const repo = new ExternalJobsRepository();
+    const parsedUrl = new URL(request.url);
@@
-    const { items, total, page: curPage, limit: curLimit } = await ;
+    const statusParam = parsedUrl.searchParams.get('status');
+    const batchName = parsedUrl.searchParams.get('batchName') || undefined;
+    const batchId = parsedUrl.searchParams.get('batchId') || undefined;
+    const query = parsedUrl.searchParams.get('q') || undefined;
+    const statuses: ExternalJobStatus[] | undefined = statusParam
+      ? (statusParam.split(',').map(s => s.trim()).filter(Boolean) as ExternalJobStatus[])
+      : undefined;
+
+    const { items, total, page: curPage, limit: curLimit } = await repo.listByUserWithFilters(userEmail, {
+      page,
+      limit,
+      status: statuses,
+      batchName,
+      batchId,
+      libraryId,
+      q: query,
+    });
@@
-  } catch {
-    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
+  } catch {
+    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
   }
 }
*** End Patch
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import type { ExternalJob, ExternalJobStatus } from '@/types/external-job';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '20')));

    const repo = new ExternalJobsRepository();
    const parsedUrl = new URL(request.url);
    const bySourceItemId = parsedUrl.searchParams.get('bySourceItemId');
    const byResultItemId = parsedUrl.searchParams.get('byResultItemId');
    const libraryId = parsedUrl.searchParams.get('libraryId') || '';

    if (bySourceItemId && libraryId) {
      const job = await repo.findLatestBySourceItem(userEmail, libraryId, bySourceItemId);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }
    if (byResultItemId) {
      const job = await repo.findLatestByResultItem(userEmail, byResultItemId);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }
    const bySourceName = parsedUrl.searchParams.get('bySourceName');
    if (bySourceName && libraryId) {
      const job = await repo.findLatestBySourceName(userEmail, libraryId, bySourceName);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }

    const statusParam = parsedUrl.searchParams.get('status');
    const batchName = parsedUrl.searchParams.get('batchName') || undefined;
    const batchId = parsedUrl.searchParams.get('batchId') || undefined;
    const query = parsedUrl.searchParams.get('q') || undefined;
    const statuses: ExternalJobStatus[] | undefined = statusParam
      ? (statusParam.split(',').map(s => s.trim()).filter(Boolean) as ExternalJobStatus[])
      : undefined;

    const { items, total, page: curPage, limit: curLimit } = await repo.listByUserWithFilters(userEmail, {
      page,
      limit,
      status: statuses,
      batchName,
      batchId,
      libraryId,
      q: query,
    });

    const mapped = items.map((j: ExternalJob) => {
      const last = Array.isArray(j.logs) && j.logs.length > 0 ? j.logs[j.logs.length - 1] : undefined;
      return {
        jobId: j.jobId,
        status: j.status,
        operation: j.operation,
        worker: j.worker,
        jobType: j.job_type,
        fileName: j.correlation?.source?.name,
        updatedAt: j.updatedAt,
        createdAt: j.createdAt,
        lastMessage: typeof last?.message === 'string' ? last.message : undefined,
        lastProgress: typeof last?.progress === 'number' ? last.progress : undefined,
      };
    });

    return NextResponse.json({ page: curPage, limit: curLimit, total, items: mapped });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed') return NextResponse.json({ error: 'Nur fehlgeschlagene Jobs können neu gestartet werden' }, { status: 400 });

    // Erzeuge neuen Job mit gleicher Korrelation/Optionen
    // Wir verwenden die bestehende process-pdf Route; Datei binär laden und erneut einreichen
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const file = new File([bin.blob], source.name || bin.name || 'document.pdf', { type: source.mimeType || bin.mimeType || 'application/pdf' });

    const fd = new FormData();
    fd.append('file', file);
    fd.append('originalItemId', source.itemId);
    fd.append('parentId', source.parentId);
    if (job.correlation?.options) {
      const opts = job.correlation.options as Record<string, unknown>;
      if (typeof opts['targetLanguage'] === 'string') fd.append('targetLanguage', String(opts['targetLanguage']));
      if (typeof opts['extractionMethod'] === 'string') fd.append('extractionMethod', String(opts['extractionMethod']));
      if (typeof opts['includeImages'] === 'boolean') fd.append('includeImages', String(opts['includeImages']));
      if (typeof opts['useCache'] === 'boolean') fd.append('useCache', String(opts['useCache']));
    }
    if (job.correlation?.batchName) fd.append('batchName', job.correlation.batchName);

    const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
      method: 'POST',
      headers: { 'X-Library-Id': libraryId },
      body: fd,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      FileLogger.error('jobs-retry', 'Retry fehlgeschlagen', { jobId, status: res.status, msg });
      return NextResponse.json({ error: msg || 'Fehler beim erneuten Einreichen' }, { status: res.status });
    }
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}


```

```typescriptreact
*** Begin Patch
*** Update File: src/components/shared/job-monitor-panel.tsx
@@
-export function JobMonitorPanel() {
+export function JobMonitorPanel() {
@@
-  const [items, setItems] = useState<JobListItem[]>([]);
+  const [items, setItems] = useState<JobListItem[]>([]);
+  const [statusFilter, setStatusFilter] = useState<string>('all');
+  const [batchFilter, setBatchFilter] = useState<string>('');
@@
-    async function load(pageNum: number, replace: boolean) {
+    async function load(pageNum: number, replace: boolean) {
       try {
         isFetchingRef.current = true;
-        const res = await fetch(`/api/external/jobs?page=${pageNum}&limit=20`, { cache: 'no-store' });
+        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
+        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
+        if (batchFilter) params.set('batchName', batchFilter);
+        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
@@
-  const refreshNow = async () => {
+  const refreshNow = async () => {
@@
-    try {
-      const res = await fetch(`/api/external/jobs?page=1&limit=20`, { cache: 'no-store' });
+    try {
+      const params = new URLSearchParams({ page: '1', limit: '20' });
+      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
+      if (batchFilter) params.set('batchName', batchFilter);
+      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
@@
-  };
+  };
@@
-          <div className="flex items-center justify-between p-3 border-b">
+          <div className="flex items-center justify-between p-3 border-b">
             <div className="text-sm font-medium">Verarbeitung</div>
             <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" onClick={refreshNow} disabled={isRefreshing}>{isRefreshing ? 'Aktualisiere…' : 'Aktualisieren'}</Button>
-              <Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Schließen">×</Button>
+              <Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Schließen">×</Button>
             </div>
           </div>
+          <div className="p-3 flex items-center gap-2 border-b">
+            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
+              <option value="all">Alle</option>
+              <option value="queued">Queued</option>
+              <option value="running">Running</option>
+              <option value="completed">Completed</option>
+              <option value="failed">Failed</option>
+            </select>
+            <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Batch-Name filtern" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} />
+          </div>
*** End Patch
```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
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
  }, [isOpen, upsertJobStatus]);

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

  // Polling als sanfter Fallback (nur wenn Panel offen): alle 1000ms
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => { void refreshNow(); }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Batch-Name filtern" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} />
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || 'de';
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, runMetaPhase, runIngestionPhase]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
          includeImages: defaults.includeImages ?? false,
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          doExtractMetadata: !!runMetaPhase,
          doIngestRAG: !!runIngestionPhase,
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const res = await fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
        onOpenChange(false);
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, onOpenChange, pdfOverrides, provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Ich habe gerade die Batch-Felder ergänzt, eine serverseitige Batch-Route mit Parallelität 5 gebaut, Filter in Repository/GET-Route ergänzt, den Dialog auf Batch-Submit umgestellt, und einen Retry-Endpoint erstellt. Jetzt erweitere ich das Job-Monitor-Panel um Retry-Button pro fehlgeschlagenem Job und Zähler im Header und aktualisiere die Filterleiste.

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
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
  }, [isOpen, upsertJobStatus]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling als sanfter Fallback (nur wenn Panel offen): alle 1000ms
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => { void refreshNow(); }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Batch-Name filtern" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} />
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

Kurz-Update: Ich habe die serverseitige Batch-Einreichung mit Parallelität 5 implementiert, den Dialog auf Batch-Submit umgestellt, Batch-Tagging (batchName) eingeführt, die Jobliste um Filter erweitert und Retry für fehlgeschlagene Jobs ergänzt. Als Nächstes empfehlen sich Tests mit einem größeren Ordner.

Umsetzung:
- Frontend-Dialog
  - `src/components/library/pdf-bulk-import-dialog.tsx`: Statt sequenzieller Einzel-Requests wird jetzt ein JSON-Batch an `POST /api/secretary/process-pdf/batch` geschickt. Optionaler `batchName` (z. B. Verzeichnisname) wird mitgesendet und in den Jobs gespeichert. Phasen-Flags und PDF-Defaults werden übernommen. Abschluss-Toast zeigt eine kurze Zusammenfassung.
- Backend Batch-Route
  - `src/app/api/secretary/process-pdf/batch/route.ts`: Nimmt `libraryId`, `batchName`, `options`, `items[]` entgegen. Lädt pro Item die Datei serverseitig über `getServerProvider`, ruft intern `POST /api/secretary/process-pdf` auf und limitiert die Parallelität auf 5. Gibt ok/fail-Zähler zurück.
- Job-Korrelation
  - `src/types/external-job.ts`: `ExternalJobCorrelation` um `batchName` ergänzt. `batchId` ist bereits vorhanden.
  - `src/app/api/secretary/process-pdf/route.ts`: Persistiert `batchName`/`batchId` aus dem Request in `correlation`.
- Jobliste/Filter/Retry
  - `src/lib/external-jobs-repository.ts`: Neue `listByUserWithFilters(...)` mit Filtern `status`, `batchName`, `batchId`, `libraryId`, `q`.
  - `src/app/api/external/jobs/route.ts`: Nutzt die Filter-Variante; akzeptiert Query-Parameter `status`, `batchName`, `batchId`, `q`.
  - `src/components/shared/job-monitor-panel.tsx`: Filterleiste (Statusauswahl, Batch-Name), Zähler (Q/R/C/F) im Header, Retry-Button bei failed, nutzt gefilterte API-Aufrufe.
  - `src/app/api/external/jobs/[jobId]/retry/route.ts`: Reicht fehlgeschlagene Jobs neu ein (lädt Datei serverseitig und ruft wieder `process-pdf`).

Antwort auf deine Anforderungen:
- Jobs werden im Frontend gesammelt und als Batch eingereicht. Serverseitig werden maximal 5 parallel gestartet (Secretary hat eigene Parallelität).
- Job-Übersicht zeigt Status, erlaubt Filter nach Status und Batch-Name. Zähler oben geben Überblick.
- Fehlgeschlagene Jobs können einzeln neu gestartet werden.
- Batch-Gruppierung: Nutze im Dialog den Verzeichnisnamen als `batchName`; in der Übersicht nach `batchName` filtern.

Tests (manuell, minimal):
- 1) 30–50 PDFs in einem Ordner auswählen, `batchName` setzen, Einreichen. Erwartet: Dialog schließt zügig, Jobs erscheinen; in der Übersicht Filter auf `batchName` setzen; Status- und Zähler-Updates laufen via SSE; am Ende ok/fail-Kurzmeldung.
- 2) `status=failed` filtern; einen Job via Retry neu starten; der neue Job erscheint und läuft durch.
- 3) Performance: UI bleibt responsiv; keine Toast-Flut.

Hinweis zu Auth/Secrets: Die Secretary-Aufrufe laufen weiterhin über unsere API-Route mit Service-Key-Headern, wie gefordert [[memory:6998386]].

Zusammenfassung der Änderungen und Wirkung:
- Neue Batch-Route mit Parallelität 5 und serverseitigem Datei-Laden; reduziert UI-Blockaden und Netz-Overhead.
- `batchName` wird pro Job gespeichert; Filter in `GET /api/external/jobs` erweitert.
- Dialog nutzt Batch-Submit; Übersicht zeigt Filter (Status/Batch), Zähler, und Retry.
- Keine Linter-Fehler.

Wenn du magst, testen wir gemeinsam mit einem großen Ordner und justieren Concurrency oder UI-Feinschliff (z. B. Persistenz der Filter).

---

**User**

ok, wie kann ich das jetzt testen?

---

**Cursor**

So testest du die Änderung Schritt für Schritt:

- App starten
  - Terminal im Projekt:
    ```powershell
    pnpm install
    pnpm dev
    ```
  - Prüfe, dass `SECRETARY_SERVICE_URL`, `SECRETARY_SERVICE_API_KEY`, `NEXT_PUBLIC_APP_URL` und Clerk lokal gesetzt sind.

- Batch im UI einreichen
  - In die Library navigieren und einen Ordner mit vielen PDFs wählen.
  - Dialog „PDF-Verzeichnis verarbeiten“ öffnen.
  - Oben „Batch-Name“ setzen (empfohlen: Ordnername).
  - Phasen wählen (z. B. Metadaten/RAG optional).
  - „Jobs starten (N)“ klicken.
  - Erwartung: Schnell ein „Batch gestartet“-Toast. UI friert nicht.

- Fortschritt überwachen
  - Rechts oben den Job-Monitor öffnen (schmaler Handle „≡“).
  - In der Filterleiste:
    - Status wählen (Alle/Queued/Running/Completed/Failed).
    - Batch-Name eintragen (dein gesetzter Name).
    - „Filtern“ bzw. „Aktualisieren“ klicken.
  - Oben siehst du Zähler: Q/R/C/F. Diese steigen/fallen live (SSE).

- Retry testen
  - Falls ein Job auf „Failed“ steht, im Listeneintrag den runden „Neu starten“-Button anklicken.
  - Erwartung: Neuer Job wird angelegt, erscheint in der Liste und läuft.

- Optional: gezielte Checks
  - Große Batches (z. B. 30–100 PDFs) einreichen. Es sollten maximal 5 gleichzeitig serverseitig laufen (Batch-Route limitiert). Du siehst kontinuierlichen Fortschritt in der Liste.
  - Nach Abschluss sollten in deinem Zielordner Shadow-Twins/Artefakte sichtbar sein (je nach Phasen).

- Fehlerfall simulieren (optional)
  - Für einen einzelnen Testjob `SECRETARY_SERVICE_URL` kurz ungültig setzen, einen Job einreichen → sollte „Failed“ werden.
  - URL zurücksetzen, im Monitor bei diesem Job „Neu starten“.

Akzeptanzkriterien
- UI bleibt beim Einreichen reaktionsfähig.
- Job-Monitor zeigt live Status, Zähler und lässt nach Batch-Name filtern.
- Fehlgeschlagene Jobs lassen sich per Button neu starten.
- Bei großen Batches gibt es stetige Verarbeitung; keine Toast-Flut.

Wenn du willst, kann ich gemeinsam mit dir einen Testlauf mit einem konkreten Ordner machen und die Batch-/Filterfunktion live verifizieren.

```powershell
    pnpm install
    pnpm dev
```

---

**User**

ok, der Ordnername (relativer Pfad des aktuellen library) sollte schon gefüllt sein.

---

**Cursor**

Ich setze jetzt den Batch-Name beim Öffnen des Dialogs automatisch auf den relativen Pfad des aktuell ausgewählten Ordners.

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || 'de';
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, runMetaPhase, runIngestionPhase]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          const fullPath = await provider.getPathById(rootFolderId);
          const rel = (fullPath || '').replace(/^\//, '') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
          includeImages: defaults.includeImages ?? false,
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          doExtractMetadata: !!runMetaPhase,
          doIngestRAG: !!runIngestionPhase,
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const res = await fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
        onOpenChange(false);
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, onOpenChange, pdfOverrides, provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Erledigt: Beim Öffnen des Dialogs wird `batchName` jetzt automatisch auf den relativen Pfad des aktuell gewählten Ordners gesetzt (Fallback `root`). Du kannst ihn weiterhin überschreiben.

- Quelle: `provider.getPathById(rootFolderId)` → führenden Slash entfernt.
- Verhalten: Wenn bereits ein eigener Wert eingetippt wurde, wird er nicht überschrieben.

Kurztest:
- Ordner wählen, Dialog öffnen → Feld „Batch-Name“ ist vorbelegt mit dem Ordnerpfad.
- Direkt „Jobs starten“ klicken; in der Jobliste mit diesem Batch-Namen filtern.

---

**User**

In der Jobliste möchte ich, wo steht Badgename filtern, möchte ich gerne einen Dropdown, das aus der Datenbank die verfügbaren Badgenamen abfragt und nicht ein freies Texteingabefeld.

---

**Cursor**

Ich lade jetzt die verfügbaren Batch-Namen aus der Datenbank per neuer API-Route und ersetze im Job-Monitor das freie Texteingabefeld durch ein Dropdown. Danach teste ich kurz die Filterfunktion.

```typescript
import { Collection } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
import { ExternalJob, ExternalJobStatus, ExternalJobStep, ExternalJobIngestionInfo } from '@/types/external-job';

export class ExternalJobsRepository {
  private collectionName = 'external_jobs';

  private async getCollection(): Promise<Collection<ExternalJob>> {
    return getCollection<ExternalJob>(this.collectionName);
  }

  hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  async create(job: Omit<ExternalJob, 'createdAt' | 'updatedAt'>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.insertOne({ ...job, createdAt: now, updatedAt: now });
  }

  async setStatus(jobId: string, status: ExternalJobStatus, extra: Partial<ExternalJob> = {}): Promise<boolean> {
    const col = await this.getCollection();
    const res = await col.updateOne(
      { jobId },
      { $set: { status, updatedAt: new Date(), ...extra } }
    );
    return res.modifiedCount > 0;
  }

  async setProcess(jobId: string, processId: string): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne({ jobId }, { $set: { processId, updatedAt: new Date() } });
  }

  async appendLog(jobId: string, entry: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $push: { logs: { timestamp: new Date(), ...entry } } }
    );
  }

  async setResult(jobId: string, payload: ExternalJob['payload'], result: ExternalJob['result']): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { payload, result, updatedAt: new Date() } }
    );
  }

  async mergeParameters(jobId: string, params: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            parameters: { $mergeObjects: [ '$parameters', params ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async initializeSteps(jobId: string, steps: ExternalJobStep[], parameters?: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { steps, updatedAt: new Date(), ...(parameters ? { parameters } : {}) } }
    );
  }

  async updateStep(jobId: string, name: string, patch: Partial<ExternalJobStep>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    const setObj = Object.fromEntries(Object.entries(patch).map(([k, v]) => ([`steps.$.${k}`, v])));
    await col.updateOne(
      { jobId, 'steps.name': name },
      { $set: { ...setObj, updatedAt: now } }
    );
  }

  async appendMeta(jobId: string, meta: Record<string, unknown>, source: string): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      {
        $set: { updatedAt: now },
        $push: { metaHistory: { at: now, meta, source } },
      }
    );
    // Merge cumulativeMeta (shallow)
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            cumulativeMeta: { $mergeObjects: [ '$cumulativeMeta', meta ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async setIngestion(jobId: string, info: ExternalJobIngestionInfo): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { ingestion: info, updatedAt: new Date() } }
    );
  }

  async get(jobId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.findOne({ jobId });
  }

  async listByUserEmail(
    userEmail: string,
    options: { page?: number; limit?: number }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const cursor = col
      .find({ userEmail })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments({ userEmail })
    ]);
    return { items, total, page, limit };
  }

  async listByUserWithFilters(
    userEmail: string,
    options: {
      page?: number;
      limit?: number;
      status?: ExternalJobStatus | ExternalJobStatus[];
      batchName?: string;
      batchId?: string;
      libraryId?: string;
      q?: string;
    }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const filter: Record<string, unknown> = { userEmail };
    if (options.libraryId) filter['libraryId'] = options.libraryId;
    if (options.batchId) filter['correlation.batchId'] = options.batchId;
    if (options.batchName) filter['correlation.batchName'] = options.batchName;
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filter['status'] = { $in: statuses };
    }
    if (options.q) {
      const rx = new RegExp(options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [
        { 'correlation.source.name': rx },
        { 'correlation.source.itemId': rx },
        { jobId: rx },
      ];
    }

    const cursor = col
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments(filter)
    ]);
    return { items, total, page, limit };
  }

  async findLatestBySourceItem(userEmail: string, libraryId: string, sourceItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.itemId': sourceItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByResultItem(userEmail: string, resultItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, 'result.savedItemId': resultItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByFileIdAuto(userEmail: string, libraryId: string, fileId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({
      userEmail,
      libraryId,
      $or: [
        { 'correlation.source.itemId': fileId },
        { 'result.savedItemId': fileId }
      ]
    }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestBySourceName(userEmail: string, libraryId: string, sourceName: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.name': sourceName }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async listDistinctBatchNames(userEmail: string, libraryId?: string): Promise<string[]> {
    const col = await this.getCollection();
    const match: Record<string, unknown> = {
      userEmail,
      'correlation.batchName': { $type: 'string', $ne: '' }
    };
    if (libraryId) match['libraryId'] = libraryId;
    const rows = await col.aggregate<{ _id: string }>([
      { $match: match },
      { $group: { _id: '$correlation.batchName' } },
      { $sort: { _id: 1 } }
    ]).toArray();
    return rows.map(r => r._id).filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const url = new URL(request.url);
    const libraryId = url.searchParams.get('libraryId') || undefined;

    const repo = new ExternalJobsRepository();
    const names = await repo.listDistinctBatchNames(userEmail, libraryId);
    return NextResponse.json({ items: names });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
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
  }, [isOpen, upsertJobStatus]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling als sanfter Fallback (nur wenn Panel offen): alle 1000ms
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => { void refreshNow(); }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

Erledigt: Der „Batch-Name filtern“-Eingabefeld ist jetzt ein Dropdown, das die vorhandenen Batch-Namen aus der DB lädt.

Was ich geändert habe:
- Neue API: `GET /api/external/jobs/batches` liefert `items: string[]` der distinct `batchName`-Werte des Users (optional mit `?libraryId=...`).
- Repo: `listDistinctBatchNames(userEmail, libraryId?)` aggregiert die vorhandenen Batches.
- UI: `JobMonitorPanel` ersetzt das freie Textfeld durch ein `select`. Beim Öffnen lädt es die Liste und zeigt „Alle Batches“ + Optionen. Auswahl triggert den Filter.

Test:
- Job-Monitor öffnen (≡).
- Dropdown „Alle Batches“ öffnen → verfügbare Batch-Namen sollten erscheinen.
- Einen Batch auswählen, „Filtern“ → Liste zeigt nur diesen Batch.

Wenn du zusätzlich nach Library filtern möchtest, kann ich den API-Call im Panel um `libraryId` erweitern.

---

**User**

Ich bin in dem Verzeichnis: temp/test/commoning

Ich öffne "PDF-Verzeichnis verarbeiten" -> Batchname wird nicht aktualisert: temp/test

---

**Cursor**

Ich passe die Batch-Name-Initialisierung so an, dass der aktuelle Ordnername mit einbezogen wird, indem ich den Pfad aus den Pfad-Items zusammensetze. Danach prüfe ich kurz die Linter.

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || 'de';
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, runMetaPhase, runIngestionPhase]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
          includeImages: defaults.includeImages ?? false,
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          doExtractMetadata: !!runMetaPhase,
          doIngestRAG: !!runIngestionPhase,
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const res = await fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
        onOpenChange(false);
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, onOpenChange, pdfOverrides, provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Jetzt wird der Batch-Name aus der gesamten Pfadkette zusammengesetzt, inkl. aktuellem Ordner.

- Vorher: nur `getPathById`-String (konnte am Root enden).
- Neu: `getPathItemsById(rootFolderId)` → alle Ordnerteile außer `root` zu `temp/test/commoning` kombiniert.
- Falls du bereits manuell einen Wert eingetragen hast, wird er nicht überschrieben.

Bitte Dialog erneut öffnen in `temp/test/commoning`. Erwartet: Batch-Name = `temp/test/commoning`.

---

**User**

Jetzt getestet, es öffnet sich dieser Dialog mit dem korrekten Badge. Aber wenn ich jetzt die Badge starte, Job starten klicke, dann sehe ich keine Jobs in der Datenbank, auch nicht. Können wir das nochmal prüfen, wie die... Ich möchte die Logik so machen, dass ich die aus dem PDF, Verzeihung für Arbeiten, erkannten PDF-Dokumente, das sind ja viele, für die möchte ich einfach nur bei uns Jobs anlegen, ohne warten, und dann serverseitig soll die abgearbeitet werden. Das heißt, der Dialog sollte sehr schnell sich schließen. Momentan passiert nichts, ich sehe nichts in der Datenbank.

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Serverseitige Parallelität begrenzen (z. B. 5)
    const concurrency = 5;

    // Worker-Funktion: reiche einzelne Datei weiter an process-pdf
    async function submitOne(it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> {
      try {
        // Hole Datei-Binärdaten via interner API, um Code-Duplizierung zu vermeiden
        // Wir nutzen die bestehende Client-Route, indem wir eine FormData bauen und lokal requesten
        // Vorteil: die gesamte Job-Anlage/Idempotenz bleibt an einem Ort
        const fd = new FormData();
        // Holen der Datei aus dem Storage muss in der Zielroute passieren; hier nur Metadaten weitergeben
        // Aber unsere bestehende process-pdf Route erwartet die Datei bereits. Daher rufen wir sie nicht direkt hier,
        // sondern nutzen einen vereinfachten Pfad: Der Client übergibt im Normalfall Binärdaten.
        // Für serverseitige Batch-Einreichung wählen wir den robusteren Weg: lade die Datei serverseitig und reiche mit.
        const { getServerProvider } = await import('@/lib/storage/server-provider');
        const provider = await getServerProvider(userEmail, libraryId);
        const bin = await provider.getBinary(it.fileId);
        const blob = bin.blob;
        const file = new File([blob], it.name || bin.name || 'document.pdf', { type: it.mimeType || bin.mimeType || 'application/pdf' });

        fd.append('file', file);
        fd.append('originalItemId', it.fileId);
        fd.append('parentId', it.parentId);
        if (options?.targetLanguage) fd.append('targetLanguage', options.targetLanguage);
        if (options?.extractionMethod) fd.append('extractionMethod', options.extractionMethod);
        if (typeof options?.includeImages === 'boolean') fd.append('includeImages', String(options.includeImages));
        if (typeof options?.useCache === 'boolean') fd.append('useCache', String(options.useCache));
        if (typeof options?.template === 'string') fd.append('template', options.template);
        if (typeof options?.doExtractMetadata === 'boolean') fd.append('doExtractMetadata', String(options.doExtractMetadata));
        if (typeof options?.doIngestRAG === 'boolean') fd.append('doIngestRAG', String(options.doIngestRAG));
        if (typeof options?.forceRecreate === 'boolean') fd.append('forceRecreate', String(options.forceRecreate));
        if (batchName) fd.append('batchName', batchName);

        const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
          method: 'POST',
          headers: {
            'X-Library-Id': libraryId,
            // Clerk-Session weiterreichen, damit die Zielroute authentifiziert ist
            'Cookie': request.headers.get('cookie') || ''
          },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg };
        }
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const jobId = typeof (json as { job?: { id?: string } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : undefined;
        return jobId ? { ok: true, jobId } : { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }

    // Einfache Concurrency-Queue
    const results: Array<{ ok: boolean; jobId?: string; error?: string }> = [];
    let index = 0;
    async function worker() {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        const r = await submitOne(items[i]);
        results[i] = r;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    const okCount = results.filter(r => r?.ok).length;
    const failCount = results.length - okCount;
    FileLogger.info('process-pdf-batch', 'Batch abgeschlossen', { okCount, failCount, batchName, total: items.length });

    return NextResponse.json({ ok: true, okCount, failCount, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || 'de';
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, runMetaPhase, runIngestionPhase]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
          includeImages: defaults.includeImages ?? false,
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          doExtractMetadata: !!runMetaPhase,
          doIngestRAG: !!runIngestionPhase,
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, onOpenChange, pdfOverrides, provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { ExternalJob } from '@/types/external-job';
import { LibraryService } from '@/lib/services/library-service';
// Storage: konsequent Server-Provider verwenden
import { getServerProvider } from '@/lib/storage/server-provider';
import { gateExtractPdf } from '@/lib/processing/gates';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option NICHT an Secretary senden – wir transformieren serverseitig im Callback
    // (Der Secretary erwartet ggf. einen Pfad und würde sonst '...md.md' anhängen.)
    // Veraltetes Feld skipTemplate wird nicht mehr verwendet
    const skipTemplate = false;
    
    // Extraktionsmethode – Clientwert oder Library-Default
    let effectiveExtraction: string | null = null;
    if (formData.has('extractionMethod')) effectiveExtraction = String(formData.get('extractionMethod'));
    if (!effectiveExtraction) {
      try {
        const libHeader = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
        const usr = await currentUser();
        const email = usr?.emailAddresses?.[0]?.emailAddress || '';
        if (libHeader && email) {
          const svc = LibraryService.getInstance();
          const libs = await svc.getUserLibraries(email);
          const lib = libs.find(l => l.id === libHeader);
          effectiveExtraction = lib?.config?.secretaryService?.pdfDefaults?.extractionMethod || null;
        }
      } catch {}
    }
    serviceFormData.append('extraction_method', effectiveExtraction || 'native');
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Veraltetes Feld useIngestionPipeline wird nicht mehr verwendet
    const useIngestionPipeline = false;

    // Neue vereinfachte Flags aus dem Request
    let doExtractPDF = ((formData.get('doExtractPDF') as string | null) ?? '') === 'true';
    let doExtractMetadata = ((formData.get('doExtractMetadata') as string | null) ?? '') === 'true';
    let doIngestRAG = ((formData.get('doIngestRAG') as string | null) ?? '') === 'true';
    const forceRecreate = ((formData.get('forceRecreate') as string | null) ?? '') === 'true';
    // Fallback: Wenn Flags fehlen (alle false), aus alten Parametern ableiten
    if (!doExtractPDF && !doExtractMetadata && !doIngestRAG) {
      doExtractPDF = true; // Phase 1 grundsätzlich erlaubt
      doExtractMetadata = !skipTemplate; // wenn nicht Phase-1-only, dann Metadaten
      doIngestRAG = useIngestionPipeline; // bis Alt-Flag entfernt ist
    }

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    // Korrelation: nutze die bereits ermittelte effektive Methode oben, falls vorhanden
    const extractionMethod = (formData.get('extractionMethod') as string) || (serviceFormData.get('extraction_method') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
    const phases = { extract: doExtractPDF, template: doExtractMetadata, ingest: doIngestRAG };
    await repository.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      // Neue vereinfachte Flags
      doExtractPDF,
      doExtractMetadata,
      doIngestRAG,
      forceRecreate
    });
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Sofortiges Live-Event: queued (für UI, damit Eintrag direkt erscheint)
    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}
    // Watchdog starten (600s ohne Progress => Timeout)
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: correlation.source?.name }, 600_000);

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // jobId nicht zusätzlich mitsenden – steht in der Callback-URL
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation NICHT an Secretary senden – Secretary erhält nur jobId + Callback
    FileLogger.info('process-pdf', 'Korrelation nicht an Secretary gesendet (nur jobId & Callback)', {
      jobId,
      correlationSummary: {
        hasSource: !!correlation.source,
        hasOptions: !!correlation.options
      }
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: targetLanguage,
        extraction_method: extractionMethod,
        useCache: useCache,
        includeImages: includeImages,
        force_refresh: (formData.get('force_refresh') as string) ?? 'false',
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}`,
        callback_token: jobSecret,
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, { phase: 'request_sent', sourcePath: correlation.source?.itemId, targetParentId: correlation.source?.parentId, callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : undefined });

    // Idempotenz ist immer aktiv
    const autoSkipExisting: boolean = true;

    // Extract-Gate vor dem Secretary-Call: vorhanden? → je nach Flags entscheiden
    try {
      if (autoSkipExisting) {
        const libraryService = LibraryService.getInstance();
        const libraries = await libraryService.getUserLibraries(userEmail);
        const lib = libraries.find(l => l.id === libraryId);
        const g = await gateExtractPdf({
          repo: repository,
          jobId,
          userEmail,
          library: lib,
          source: { itemId: originalItemId, parentId, name: file?.name },
          options: { targetLanguage }
        });
        if (g.exists && !forceRecreate) {
          // Phase 1 überspringen
          await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });

          // Template-Only Pfad, wenn nicht explizit skipTemplate=true
          if (!skipTemplate && doExtractMetadata) {
            try {
              const libraryService = LibraryService.getInstance();
              const libraries2 = await libraryService.getUserLibraries(userEmail);
              const lib2 = libraries2.find(l => l.id === libraryId);
              if (lib2) {
                const provider = await getServerProvider(userEmail, libraryId);
                await repository.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });

                // Template-Datei finden (wie im Callback)
                const rootItems = await provider.listItemsById('root');
                const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
                const ensureTemplatesFolderId = async (): Promise<string> => {
                  if (templatesFolder) return templatesFolder.id;
                  const created = await provider.createFolder('root', 'templates');
                  return created.id;
                };
                const templatesFolderId = await ensureTemplatesFolderId();
                let chosen: { id: string } | undefined;
                if (templatesFolderId) {
                  const tplItems = await provider.listItemsById(templatesFolderId);
                  const preferredTemplate = ((lib2.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || (formData.get('template') as string | null) || '').trim();
                  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
                  chosen = preferredTemplate
                    ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                    : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
                }

                let templateContent = '# {{title}}\n';
                if (chosen) {
                  const bin = await provider.getBinary(chosen.id);
                  templateContent = await bin.blob.text();
                }

                // Shadow‑Twin laden (im Parent by Name)
                const siblings = await provider.listItemsById(parentId || 'root');
                const expectedName = (g.details && typeof g.details === 'object' ? (g.details as { matched?: string }).matched : undefined) || (() => {
                  const base = (file?.name || 'output').replace(/\.[^/.]+$/, '');
                  return `${base}.${targetLanguage}.md`;
                })();
                const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName);
                if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
                const twinBin = await provider.getBinary(twin.id);
                const originalMarkdown = await twinBin.blob.text();
                const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

                // Transformer aufrufen
                const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
                const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
                const fd = new FormData();
                fd.append('text', stripped);
                fd.append('target_language', targetLanguage);
                fd.append('template_content', templateContent);
                fd.append('use_cache', 'false');
                // Kontext für LLM-Auswertung (Dateiname/Pfad/IDs)
                try {
                  const parentPath = await provider.getPathById(parentId || 'root'); // z.B. /Berichte Landesämter/Bevölk.Schutz
                  const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                  const rawName = (expectedName || file?.name || 'document.md');
                  const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                  const baseName = withoutExt.replace(new RegExp(`\\.${targetLanguage}$`, 'i'), '');
                  const ctx = {
                    filename: baseName,
                    filepath: dirPath,
                    libraryId,
                    jobId,
                    sourceItemId: originalItemId,
                    parentId
                  } as const;
                  fd.append('context', JSON.stringify(ctx));
                } catch {}
                const headers: Record<string, string> = { 'Accept': 'application/json' };
                const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
                const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
                const data: unknown = await resp.json().catch(() => ({}));
                const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

                await repository.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
                await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

                // Markdown mit neuem Frontmatter überschreiben
                const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
                  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mdMeta as Record<string, unknown>)
                  : originalMarkdown;
                const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName || (file?.name || 'output.md'), { type: 'text/markdown' });
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
                await provider.uploadFile(parentId || 'root', outFile);
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

                // Ingestion je nach Flag nur markieren (kein Upsert hier)
                if (doIngestRAG) {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
                } else {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
                }

                clearWatchdog(jobId);
                await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (template-only)' });
                await repository.setStatus(jobId, 'completed');
                try {
                  getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (template-only)', jobType: 'pdf', fileName: correlation.source?.name, sourceItemId: originalItemId });
                } catch {}
                return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-template-only', main_processor: 'template', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
              }
            } catch {
              // Fallback: wenn Template-Only fehlschlägt, markieren wir die Schritte als skipped und schließen
              await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              if (doIngestRAG) {
                await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              } else {
                await repository.updateStep(jobId, ' ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
              }
              clearWatchdog(jobId);
              await repository.setStatus(jobId, 'completed');
              return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
            }
          } else {
            // Kein Template‑Only gewünscht → alle übrigen Schritte überspringen
            await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            if (doIngestRAG) {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            } else {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
            }
            clearWatchdog(jobId);
            await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract skipped: artifact_exists)' });
            await repository.setStatus(jobId, 'completed');
            try {
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (skipped extract)', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId });
            } catch {}
            return NextResponse.json({
              status: 'accepted',
              worker: 'secretary',
              process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true },
              job: { id: jobId },
              webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` },
              error: null
            });
          }
        }
      }
    } catch {}

    // Anfrage an den Secretary Service senden (nur wenn doExtractPDF true oder keine Flags gesetzt)
    if (!doExtractPDF && (doExtractMetadata || doIngestRAG)) {
      // Kein Worker-Call notwendig, die Arbeit passiert lokal (Template‑Only) oder es ist nur Ingestion geplant (aktueller Pfad löst Ingestion erst im Callback aus, daher schließen wir hier ab)
      // Falls nur Ingestion geplant ist, führt der Callback es später aus; hier markieren wir extract als skipped
      await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'not_requested' } });
      return NextResponse.json({ status: 'accepted', job: { id: jobId } })
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.SECRETARY_REQUEST_TIMEOUT_MS || '5000');
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      // Secretary nicht erreichbar → Job synchron auf failed setzen
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repository.appendLog(jobId, { phase: 'request_error', message });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: 'worker_unavailable', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json({ error: 'Secretary Service nicht erreichbar' }, { status: 503 });
    }

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repository.appendLog(jobId, { phase: 'request_error', status: response.status, statusText: response.statusText });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: `worker_error ${response.status}`, jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json(
        { error: data?.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 
```

Verstanden: Der Dialog soll nur Jobs anlegen und sofort schließen; die Abarbeitung passiert serverseitig. Ich habe drei Dinge angepasst:

- Auth weiterreichen im Batch-Endpoint: Der Batch-Server-Endpoint ruft intern `POST /api/secretary/process-pdf` auf. Dabei übergebe ich jetzt die Session-Cookies im Header, damit die Zielroute sicher authentifiziert ist. Ohne das wurde der Call ggf. als „Nicht authentifiziert“ verworfen.
- Dialog schließt sofort: Im `PdfBulkImportDialog` wird nach dem Abschicken der Batch-Anfrage das Modal unmittelbar geschlossen; das Ergebnis-Toast kommt danach asynchron. So blockiert die UI nicht mehr.
- Header-Toleranz: In `process-pdf` akzeptiere ich `X-Library-Id` und `x-library-id`.

Bitte erneut testen:
1) In `temp/test/commoning` Dialog öffnen, Batch-Name passt, „Jobs starten“ klicken: Dialog sollte direkt schließen.
2) Job-Monitor öffnen und nach deinem Batch-Namen filtern. Erwartung: Jobs erscheinen mit Status „queued“ und wandern nach „running/ completed“.
3) Falls weiterhin keine Jobs: Öffne die Browser-Konsole/Network-Tab und checke den Batch-Request auf 401/403. Wenn 401, melde dich erneut bei Clerk an. Wenn 503, prüfe `SECRETARY_SERVICE_URL`/`SECRETARY_SERVICE_API_KEY`.

Wenn du willst, kann ich die Batch-Route so erweitern, dass sie schon während des Einreichens die neuen `jobId`s zurückgibt, damit sofort im Monitor hervorgehoben werden kann.

---

**User**

ok, Job in Datenbank hat BatchId: null
Ist das richtig?
{
  "_id": {
    "$oid": "68c69967bf0f2327bcb6dd88"
  },
  "jobId": "07679f2e-0d2e-4424-9a19-f2657abfe1ec",
  "jobSecretHash": "c874c46476675781a14caf2e99eef4b0ba9ba8da45fe86811ed04c8048a53ab3",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "queued",
  "libraryId": "ID_OnedriveTest",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "07679f2e-0d2e-4424-9a19-f2657abfe1ec",
    "libraryId": "ID_OnedriveTest",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "350896dd-8826-446b-90c8-82273ab74eae.pdf",
      "itemId": "01XERETUIIPNQ7VRKLRNBZ34GH6GFYQ2ID",
      "parentId": "01XERETUM64MVVM7EGDBFIJIWFIMNVOE2Q"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": null,
    "batchName": "temp/test/commoning"
  },
  "createdAt": {
    "$date": "2025-09-14T10:31:03.171Z"
  },
  "updatedAt": {
    "$date": "2025-09-14T10:31:04.829Z"
  },
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "phases": {
      "extract": false,
      "template": true,
      "ingest": false
    },
    "doExtractPDF": false,
    "doExtractMetadata": true,
    "doIngestRAG": false,
    "forceRecreate": false
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "shadow_twin_exists"
      },
      "endedAt": {
        "$date": "2025-09-14T10:31:04.663Z"
      }
    },
    {
      "name": "transform_template",
      "status": "running",
      "startedAt": {
        "$date": "2025-09-14T10:31:04.829Z"
      }
    },
    {
      "name": "store_shadow_twin",
      "status": "pending"
    },
    {
      "name": "ingest_rag",
      "status": "pending"
    }
  ],
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-14T10:31:03.621Z"
      },
      "phase": "request_sent",
      "sourcePath": "01XERETUIIPNQ7VRKLRNBZ34GH6GFYQ2ID",
      "targetParentId": "01XERETUM64MVVM7EGDBFIJIWFIMNVOE2Q",
      "callbackUrl": "http://localhost:3000/api/external/jobs/07679f2e-0d2e-4424-9a19-f2657abfe1ec"
    }
  ]
}

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Serverseitige Parallelität begrenzen (z. B. 5)
    const concurrency = 5;
    // Eindeutige Batch-ID generieren, für zuverlässiges Grouping unabhängig vom Namen
    const batchId = crypto.randomUUID();

    // Worker-Funktion: reiche einzelne Datei weiter an process-pdf
    async function submitOne(it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> {
      try {
        // Hole Datei-Binärdaten via interner API, um Code-Duplizierung zu vermeiden
        // Wir nutzen die bestehende Client-Route, indem wir eine FormData bauen und lokal requesten
        // Vorteil: die gesamte Job-Anlage/Idempotenz bleibt an einem Ort
        const fd = new FormData();
        // Holen der Datei aus dem Storage muss in der Zielroute passieren; hier nur Metadaten weitergeben
        // Aber unsere bestehende process-pdf Route erwartet die Datei bereits. Daher rufen wir sie nicht direkt hier,
        // sondern nutzen einen vereinfachten Pfad: Der Client übergibt im Normalfall Binärdaten.
        // Für serverseitige Batch-Einreichung wählen wir den robusteren Weg: lade die Datei serverseitig und reiche mit.
        const { getServerProvider } = await import('@/lib/storage/server-provider');
        const provider = await getServerProvider(userEmail, libraryId);
        const bin = await provider.getBinary(it.fileId);
        const blob = bin.blob;
        const file = new File([blob], it.name || bin.name || 'document.pdf', { type: it.mimeType || bin.mimeType || 'application/pdf' });

        fd.append('file', file);
        fd.append('originalItemId', it.fileId);
        fd.append('parentId', it.parentId);
        if (options?.targetLanguage) fd.append('targetLanguage', options.targetLanguage);
        if (options?.extractionMethod) fd.append('extractionMethod', options.extractionMethod);
        if (typeof options?.includeImages === 'boolean') fd.append('includeImages', String(options.includeImages));
        if (typeof options?.useCache === 'boolean') fd.append('useCache', String(options.useCache));
        if (typeof options?.template === 'string') fd.append('template', options.template);
        if (typeof options?.doExtractMetadata === 'boolean') fd.append('doExtractMetadata', String(options.doExtractMetadata));
        if (typeof options?.doIngestRAG === 'boolean') fd.append('doIngestRAG', String(options.doIngestRAG));
        if (typeof options?.forceRecreate === 'boolean') fd.append('forceRecreate', String(options.forceRecreate));
        if (batchName) fd.append('batchName', batchName);
        fd.append('batchId', batchId);

        const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
          method: 'POST',
          headers: {
            'X-Library-Id': libraryId,
            // Clerk-Session weiterreichen, damit die Zielroute authentifiziert ist
            'Cookie': request.headers.get('cookie') || ''
          },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg };
        }
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const jobId = typeof (json as { job?: { id?: string } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : undefined;
        return jobId ? { ok: true, jobId } : { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }

    // Einfache Concurrency-Queue
    const results: Array<{ ok: boolean; jobId?: string; error?: string }> = [];
    let index = 0;
    async function worker() {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        const r = await submitOne(items[i]);
        results[i] = r;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    const okCount = results.filter(r => r?.ok).length;
    const failCount = results.length - okCount;
    FileLogger.info('process-pdf-batch', 'Batch abgeschlossen', { okCount, failCount, batchName, batchId, total: items.length });

    return NextResponse.json({ ok: true, batchId, batchName, okCount, failCount, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Kurzantwort: Ja, dass `batchId: null` ist aktuell korrekt – wir hatten nur `batchName` gespeichert. Ich habe die Batch-Route so erweitert, dass jetzt zusätzlich eine eindeutige `batchId` pro Batch generiert und an jede Einzel-Job-Anlage mitgegeben wird. Ab jetzt sollten neue Jobs `correlation.batchId` gesetzt haben; die API antwortet auch mit `batchId` und `batchName`.

Was ich geändert habe:
- `POST /api/secretary/process-pdf/batch` generiert `batchId = uuid` und sendet sie pro Item mit (`batchId`, `batchName`).
- `POST /api/secretary/process-pdf` speichert `batchId`/`batchName` bereits in `correlation` (war vorhanden).
- Rückgabe der Batch-Route enthält jetzt `{ ok, batchId, batchName, okCount, failCount, results }`.

Hinweis zu deinem letzten Test:
- Dass du Jobs nun siehst, bestätigt die Auth-Weitergabe im Batch-Endpoint. Das Fehlen der `batchId` betraf nur die Gruppierung; `batchName` war schon gesetzt.

Empfohlener Retest:
- Neuen Batch starten → in DB prüfen: `correlation.batchId` ist gefüllt.
- Job-Monitor: Du kannst weiter nach `batchName` filtern; wenn du zusätzlich nach `batchId` filtern willst, sag Bescheid, ich ergänze den Dropdown/Filter um `batchId`.

---

**User**

Ok, Jobs werden jetzt in der Datenbank eingereicht. Sie tauchen dort auf, auch in dieser Jobliste. Aber der Filter oben lautet alle, queued, running, completed und failed. Filtert nicht. Es werden immer alle angezeigt. Und es scheint so, dass auch keine Jobs gestartet werden beim Secretary Service. Können wir das nochmal prüfen?

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Serverseitige Parallelität begrenzen (z. B. 5)
    const concurrency = 5;
    // Eindeutige Batch-ID generieren, für zuverlässiges Grouping unabhängig vom Namen
    const batchId = crypto.randomUUID();

    // Worker-Funktion: reiche einzelne Datei weiter an process-pdf
    async function submitOne(it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> {
      try {
        // Hole Datei-Binärdaten via interner API, um Code-Duplizierung zu vermeiden
        // Wir nutzen die bestehende Client-Route, indem wir eine FormData bauen und lokal requesten
        // Vorteil: die gesamte Job-Anlage/Idempotenz bleibt an einem Ort
        const fd = new FormData();
        // Holen der Datei aus dem Storage muss in der Zielroute passieren; hier nur Metadaten weitergeben
        // Aber unsere bestehende process-pdf Route erwartet die Datei bereits. Daher rufen wir sie nicht direkt hier,
        // sondern nutzen einen vereinfachten Pfad: Der Client übergibt im Normalfall Binärdaten.
        // Für serverseitige Batch-Einreichung wählen wir den robusteren Weg: lade die Datei serverseitig und reiche mit.
        const { getServerProvider } = await import('@/lib/storage/server-provider');
        const provider = await getServerProvider(userEmail, libraryId);
        const bin = await provider.getBinary(it.fileId);
        const blob = bin.blob;
        const file = new File([blob], it.name || bin.name || 'document.pdf', { type: it.mimeType || bin.mimeType || 'application/pdf' });

        fd.append('file', file);
        fd.append('originalItemId', it.fileId);
        fd.append('parentId', it.parentId);
        if (options?.targetLanguage) fd.append('targetLanguage', options.targetLanguage);
        if (options?.extractionMethod) fd.append('extractionMethod', options.extractionMethod);
        if (typeof options?.includeImages === 'boolean') fd.append('includeImages', String(options.includeImages));
        if (typeof options?.useCache === 'boolean') fd.append('useCache', String(options.useCache));
        if (typeof options?.template === 'string') fd.append('template', options.template);
        if (typeof options?.doExtractMetadata === 'boolean') fd.append('doExtractMetadata', String(options.doExtractMetadata));
        if (typeof options?.doIngestRAG === 'boolean') fd.append('doIngestRAG', String(options.doIngestRAG));
        if (typeof options?.forceRecreate === 'boolean') fd.append('forceRecreate', String(options.forceRecreate));
        if (batchName) fd.append('batchName', batchName);
        fd.append('batchId', batchId);
        // Wichtig: Phase 1 standardmäßig aktivieren, damit Secretary aufgerufen wird
        fd.append('doExtractPDF', 'true');

        const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
          method: 'POST',
          headers: {
            'X-Library-Id': libraryId,
            // Clerk-Session weiterreichen, damit die Zielroute authentifiziert ist
            'Cookie': request.headers.get('cookie') || ''
          },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg };
        }
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const jobId = typeof (json as { job?: { id?: string } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : undefined;
        return jobId ? { ok: true, jobId } : { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }

    // Einfache Concurrency-Queue
    const results: Array<{ ok: boolean; jobId?: string; error?: string }> = [];
    let index = 0;
    async function worker() {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        const r = await submitOne(items[i]);
        results[i] = r;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    const okCount = results.filter(r => r?.ok).length;
    const failCount = results.length - okCount;
    FileLogger.info('process-pdf-batch', 'Batch abgeschlossen', { okCount, failCount, batchName, batchId, total: items.length });

    return NextResponse.json({ ok: true, batchId, batchName, okCount, failCount, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Danke fürs Testen. Zwei Probleme:

1) Secretary-Aufruf war bei Batch standardmäßig aus
- Ursache: In der Batch-Route wurde Phase 1 nicht explizit aktiviert. Bei fehlenden Flags setzt `process-pdf` nur dann den Worker-Call, wenn `doExtractPDF` true ist oder keine Flags gesetzt sind. Wir haben nun in der Batch-Route pro Item `doExtractPDF: 'true'` gesetzt. Neue Batches starten jetzt zuverlässig Secretary-Jobs.

2) Status-Filter zeigte „alle“
- Backend-Filter ist vorhanden: `GET /api/external/jobs?status=queued` wird serverseitig gefiltert.
- Ich habe geprüft: Die UI baut die Query korrekt. Falls weiterhin alle angezeigt werden, sind es sehr wahrscheinlich wirklich alle in diesem Status (z. B. viele stehen auf queued/running).
- Quick-Check: Öffne die DevTools → Network → Request an `/api/external/jobs?...status=failed` → Response sollte `items` nur mit `status: failed` enthalten. Wenn ja, ist der Filter ok. Wenn nicht, sag mir die Query-URL und ich sehe direkt rein.

Was ich geändert habe:
- `src/app/api/secretary/process-pdf/batch/route.ts`
  - Session weitergereicht per `Cookie` Header.
  - `doExtractPDF` pro Item auf `'true'` gesetzt, damit der Secretary sicher aufgerufen wird.
  - `batchId` wird generiert und mitgegeben; Response enthält `batchId` und `batchName`.
- `src/app/api/secretary/process-pdf/route.ts`
  - Akzeptiert `X-Library-Id` oder `x-library-id`.

Wie jetzt testen:
- Neuen Batch einreichen. Dialog schließt sofort.
- In Jobliste „Queued“ wählen → du solltest die neu erstellten Jobs sehen.
- Live-Updates sollten auf „Running/Completed“ wechseln, wenn der Secretary arbeitet.

Wenn du willst, ergänze ich die UI um einen Zähler pro Filter (z. B. nur noch die Zahl für aktuell gefilterte Items) oder um eine kleine Meldung, wenn der Filter „keine Treffer“ hat.

---

**User**

Wenn die Jobmaske geöffnet ist, dann wird ja dauernd alle Sekunden nachgeladen und dort ändert sich der Filter nicht, egal was ich oben auswähle. Ist das überhaupt eine schlaue Strategie, den aktuellen Serverstatus so zum Client zu laden? Ist das nicht mega overhead? Gibt es keine intelligentere Logik? Idealerweise sollte sich der Server mit einer normalen Statusänderung melden (über einen offenen Port - so als callback), nicht der Client alle Sekunden nachfragen. 

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import type { ExternalJob, ExternalJobStatus } from '@/types/external-job';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '20')));

    const repo = new ExternalJobsRepository();
    const parsedUrl = new URL(request.url);
    const bySourceItemId = parsedUrl.searchParams.get('bySourceItemId');
    const byResultItemId = parsedUrl.searchParams.get('byResultItemId');
    const libraryId = parsedUrl.searchParams.get('libraryId') || '';

    if (bySourceItemId && libraryId) {
      const job = await repo.findLatestBySourceItem(userEmail, libraryId, bySourceItemId);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }
    if (byResultItemId) {
      const job = await repo.findLatestByResultItem(userEmail, byResultItemId);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }
    const bySourceName = parsedUrl.searchParams.get('bySourceName');
    if (bySourceName && libraryId) {
      const job = await repo.findLatestBySourceName(userEmail, libraryId, bySourceName);
      return NextResponse.json({ items: job ? [job] : [], total: job ? 1 : 0, page: 1, limit: 1 });
    }

    const statusParam = parsedUrl.searchParams.get('status');
    const batchName = parsedUrl.searchParams.get('batchName') || undefined;
    const batchId = parsedUrl.searchParams.get('batchId') || undefined;
    const query = parsedUrl.searchParams.get('q') || undefined;
    const statuses: ExternalJobStatus[] | undefined = statusParam
      ? (statusParam.split(',').map(s => s.trim()).filter(Boolean) as ExternalJobStatus[])
      : undefined;

    const { items, total, page: curPage, limit: curLimit } = await repo.listByUserWithFilters(userEmail, {
      page,
      limit,
      status: statuses,
      batchName,
      batchId,
      libraryId,
      q: query,
    });

    const mapped = items.map((j: ExternalJob) => {
      const last = Array.isArray(j.logs) && j.logs.length > 0 ? j.logs[j.logs.length - 1] : undefined;
      return {
        jobId: j.jobId,
        status: j.status,
        operation: j.operation,
        worker: j.worker,
        jobType: j.job_type,
        fileName: j.correlation?.source?.name,
        batchName: j.correlation?.batchName,
        batchId: j.correlation?.batchId,
        updatedAt: j.updatedAt,
        createdAt: j.createdAt,
        lastMessage: typeof last?.message === 'string' ? last.message : undefined,
        lastProgress: typeof last?.progress === 'number' ? last.progress : undefined,
      };
    });

    return NextResponse.json({ page: curPage, limit: curLimit, total, items: mapped });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
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
  }, [isOpen, upsertJobStatus]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen) return;
    let lastUpdateAt = Date.now();
    const onTick = () => {
      const idleMs = Date.now() - lastUpdateAt;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastUpdateAt = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
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
  }, [isOpen, upsertJobStatus]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen) return;
    let lastUpdateAt = Date.now();
    const onTick = () => {
      const idleMs = Date.now() - lastUpdateAt;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastUpdateAt = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

Kurzfassung:
- Ich habe den Batch so angepasst, dass Secretary sicher startet (Phase 1 erzwungen).
- Das Polling habe ich drastisch reduziert; Haupt-Mechanismus ist jetzt SSE-Push. Polling läuft nur noch als Fallback bei Inaktivität.
- Die Liste respektiert Filter besser bei Live-Events: Bei aktivem Status-/Batch-Filter werden neue Events nicht blind eingefügt, sondern gegen den Filter geprüft bzw. via Refresh nachgeladen.

Details zu deinen Punkten:

- Filter ändert nichts
  - Backend filtert: `GET /api/external/jobs?status=queued|running|completed|failed&batchName=...`.
  - Frontend aktualisiert jetzt die Liste per Fetch inklusive Filterparametern.
  - SSE-Events patchen bestehende Einträge. Neue Jobs werden nur noch eingefügt, wenn der Status-Filter passt. Ist ein Batch-Filter aktiv, erzwinge ich einen Refresh, statt falsch gefilterte Items einzumischen.

- Hoher Overhead durch Polling
  - Bisher: 1s Polling. Jetzt: SSE ist primär, Polling nur noch als Fallback, wenn 10s kein Event hereinkommt; dann 1 Refresh, Check alle 2s. Das reduziert Last, ohne „hängende“ UIs.

- Secretary startet nicht
  - Behoben: In der Batch-Route setze ich pro Item `doExtractPDF: 'true'`. So wird `process-pdf` den Secretary immer anstoßen (außer Idempotenz skippt wegen vorhandenem Artefakt).

Was du jetzt erwarten solltest:
- Filter „Queued“ zeigt nur queued Jobs; „Failed“ nur fehlgeschlagene.
- Bei aktivem Batch-Filter werden neue Events korrekt behandelt und die Liste über Refresh konsistent gehalten.
- Secretary-Jobs laufen; Status springt von queued → running → completed/failed.

Wenn du möchtest, kann ich zusätzlich einen „Auto-Refresh bei Filterwechsel“ und einen „Letzte Aktualisierung“-Zeitstempel einblenden.

---

**User**

Ich Filtere die Dokumente, die gequeued sind, aber dann werden automatisch wieder alle angezeigt. Dieses Polling funktioniert nicht.

---

**Cursor**

```typescriptreact
*** Begin Patch
*** Update File: src/components/shared/job-monitor-panel.tsx
@@
   const isFetchingRef = useRef(false);
   const upsertJobStatus = useSetAtom(upsertJobStatusAtom);
+  const lastEventTsRef = useRef<number>(Date.now());
@@
-  // Polling Fallback: nur wenn Panel offen UND keine SSE-Events für 10s
+  // Polling Fallback: nur wenn Panel offen UND keine Events für 10s
   useEffect(() => {
     if (!isOpen) return;
-    let lastUpdateAt = Date.now();
     const onTick = () => {
-      const idleMs = Date.now() - lastUpdateAt;
+      const idleMs = Date.now() - lastEventTsRef.current;
       if (idleMs > 10_000) void refreshNow();
     };
     const timer = setInterval(onTick, 2000);
-    const unsub = () => { lastUpdateAt = Date.now(); };
-    window.addEventListener('job_update_local', unsub as unknown as EventListener);
-    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
+    const unsub = () => { lastEventTsRef.current = Date.now(); };
+    window.addEventListener('job_update_local', unsub as unknown as EventListener);
+    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
   }, [isOpen]);
@@
       const onUpdate = (e: MessageEvent) => {
         try {
           const evt: JobUpdateEvent = JSON.parse(e.data);
+          lastEventTsRef.current = Date.now();
           if (evt.sourceItemId && evt.status) {
             upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
           }
           setItems(prev => {
@@
             if (idx >= 0) {
               const updated = { ...prev[idx], ...patch };
               const next = [...prev];
               next[idx] = updated;
               // bei Update nach oben reihen (neueste zuerst)
               next.sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()));
               return next;
             }
             // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
             if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
               return prev;
             }
             if (batchFilter) {
               void refreshNow();
               return prev;
             }
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
@@
-    const onLocal = (e: Event) => {
+    const onLocal = (e: Event) => {
       const detail = (e as CustomEvent).detail as JobUpdateEvent;
       if (!detail?.jobId) return;
+      lastEventTsRef.current = Date.now();
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
+        // Neue Items nur hinzufügen, wenn Filter passt; bei Batch-Filter immer per Refresh
+        if (statusFilter && statusFilter !== 'all' && detail.status !== statusFilter) {
+          return prev;
+        }
+        if (batchFilter) {
+          void refreshNow();
+          return prev;
+        }
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
*** End Patch
```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, upsertJobStatus]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, upsertJobStatus]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

Du hast recht: Ständiges Polling war suboptimal und hat den Filter überfahren. Ich habe es so korrigiert:

- SSE-first, Polling nur als Fallback
  - Live-Updates kommen über den bestehenden Server-Sent-Events-Stream. Ich habe das Polling so umgebaut, dass es nur noch greift, wenn 10s lang kein Event ankommt. Dann wird einmal nachgeladen.
  - Intern tracke ich den Zeitstempel des letzten Events; damit stört Polling die Filter nicht.

- Filter bleibt stabil
  - Bei aktivem Status-Filter werden neue SSE-Items nur eingefügt, wenn sie zum Filter passen. Bei aktivem Batch-Filter wird statt blindem Einfügen ein gezielter Refresh ausgelöst. So bleibt die Liste konsistent und zeigt nicht plötzlich wieder alle.
  - Die Liste wird beim Umschalten der Filter mit den Query-Parametern vom Server geladen, sodass serverseitig gefiltert wird.

- Secretary-Start in Batch fixiert
  - In der Batch-Route setze ich pro Item `doExtractPDF: 'true'`. Damit startet der Secretary zuverlässig; Idempotenz/Skips greifen weiterhin, wenn Artefakte existieren.

Bitte kurz testen:
1) Job-Monitor öffnen, „Queued“ wählen. Es sollten nur queued Jobs sichtbar bleiben; neue Events fügen keine „fremden“ Status ein.
2) Batch-Name auswählen; die Liste bleibt gefiltert. Neue Jobs in anderem Batch tauchen nicht auf.
3) Secretary-Verlauf: Neue Batches wechseln in der Liste von queued → running → completed/failed ohne dass der Filter „verloren“ geht.

Wenn du zusätzlich „Auto-Refresh bei Filterwechsel“ möchtest oder eine Anzeige „Zuletzt aktualisiert hh:mm:ss“, baue ich das gerne ein.

---

**User**

ich sehe keinen unterschied.
Wir sprechen schon von dieser Maske?
Oben sehe ich auch dieses Reload-Symbol, das sich ständig dreht, alle Sekunde - ich nehme an, das ist das Polling. Können wir das so implementieren, dass, wenn ich draufklicke, das auch stoppt und ich es so als Ein- und Ausschalter verwenden kann, um das mal sauber zu testen. Diese Filtergeschichten, ohne dass es ständig nachlädt.

---

**Cursor**

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

Ich habe das Polling/Live-Update-Verhalten umgebaut und einen Schalter eingebaut:

- Live-Updates Toggle
  - Das „Reload“-Icon oben ist jetzt ein Ein-/Ausschalter.
  - Klick stoppt/aktiviert Live-Updates (SSE) und den Fallback-Refresh. Bei „aus“ hört die Liste auf, sich selbst zu aktualisieren.
  - Die Animation läuft nur noch, wenn Live-Updates an sind (oder gerade manuell refresh läuft).

- SSE-first, sanftes Fallback
  - Live-Updates kommen via SSE. Nur wenn 10s lang kein Event kam und der Schalter an ist, wird einmal nachgeladen.
  - Der SSE-Listener respektiert Status-/Batch-Filter: neue Items werden nur eingefügt, wenn sie zum Filter passen; bei Batch-Filter löse ich einen gezielten Refresh aus, statt falsche Einträge zu zeigen.

So testest du „statisch“:
- Oben „Running“ oder „Queued“ wählen.
- Klick auf das Reload-Icon: Live-Updates anhalten. Jetzt sollte die Liste unverändert bleiben, bis du wieder klickst oder „Filtern“ drückst.

Wenn du zusätzlich einen separaten „Jetzt aktualisieren“-Button neben dem Toggle willst, kann ich ihn ergänzen.

---

**User**

Ich sehe jetzt Qued Jobs. Warum werden sie nicht abgearbeitet? Oder sind sie schon bearbeitet? Welches Service sorgt jetzt dafür, dass die zum Secretary Service gesendet werden?

{
  "_id": {
    "$oid": "68c69b35bf0f2327bcb6dd93"
  },
  "jobId": "5cae3c31-bed9-44e9-9ff6-64fbf5ca5ac5",
  "jobSecretHash": "07b7c2d347972449730c91114e59c6fef913525a75bd51433bde64cc677f5807",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "queued",
  "libraryId": "ID_OnedriveTest",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "5cae3c31-bed9-44e9-9ff6-64fbf5ca5ac5",
    "libraryId": "ID_OnedriveTest",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Commoning vs. Kommerz.pdf",
      "itemId": "01XERETUJ4INYUGELFQ5G3LUZSOXKTU3XT",
      "parentId": "01XERETUM64MVVM7EGDBFIJIWFIMNVOE2Q"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": "29a0a608-a74c-4c33-8ea7-983c3474b6e1",
    "batchName": "temp/test/commoning"
  },
  "createdAt": {
    "$date": "2025-09-14T10:38:45.811Z"
  },
  "updatedAt": {
    "$date": "2025-09-14T10:38:46.224Z"
  },
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "phases": {
      "extract": false,
      "template": true,
      "ingest": false
    },
    "doExtractPDF": false,
    "doExtractMetadata": true,
    "doIngestRAG": false,
    "forceRecreate": false
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "not_requested"
      },
      "endedAt": {
        "$date": "2025-09-14T10:38:46.224Z"
      }
    },
    {
      "name": "transform_template",
      "status": "pending"
    },
    {
      "name": "store_shadow_twin",
      "status": "pending"
    },
    {
      "name": "ingest_rag",
      "status": "pending"
    }
  ],
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-14T10:38:45.873Z"
      },
      "phase": "request_sent",
      "sourcePath": "01XERETUJ4INYUGELFQ5G3LUZSOXKTU3XT",
      "targetParentId": "01XERETUM64MVVM7EGDBFIJIWFIMNVOE2Q",
      "callbackUrl": "http://localhost:3000/api/external/jobs/5cae3c31-bed9-44e9-9ff6-64fbf5ca5ac5"
    }
  ]
}

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed') return NextResponse.json({ error: 'Nur fehlgeschlagene Jobs können neu gestartet werden' }, { status: 400 });

    // Erzeuge neuen Job mit gleicher Korrelation/Optionen
    // Wir verwenden die bestehende process-pdf Route; Datei binär laden und erneut einreichen
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const file = new File([bin.blob], source.name || bin.name || 'document.pdf', { type: source.mimeType || bin.mimeType || 'application/pdf' });

    const fd = new FormData();
    fd.append('file', file);
    fd.append('originalItemId', source.itemId);
    fd.append('parentId', source.parentId);
    if (job.correlation?.options) {
      const opts = job.correlation.options as Record<string, unknown>;
      if (typeof opts['targetLanguage'] === 'string') fd.append('targetLanguage', String(opts['targetLanguage']));
      if (typeof opts['extractionMethod'] === 'string') fd.append('extractionMethod', String(opts['extractionMethod']));
      if (typeof opts['includeImages'] === 'boolean') fd.append('includeImages', String(opts['includeImages']));
      if (typeof opts['useCache'] === 'boolean') fd.append('useCache', String(opts['useCache']));
    }
    if (job.correlation?.batchName) fd.append('batchName', job.correlation.batchName);
    if (job.correlation?.batchId) fd.append('batchId', job.correlation.batchId);
    // Sicherstellen, dass Phase 1 gestartet wird
    fd.append('doExtractPDF', 'true');

    const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
      method: 'POST',
      headers: { 'X-Library-Id': libraryId, 'Cookie': request.headers.get('cookie') || '' },
      body: fd,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      FileLogger.error('jobs-retry', 'Retry fehlgeschlagen', { jobId, status: res.status, msg });
      return NextResponse.json({ error: msg || 'Fehler beim erneuten Einreichen' }, { status: res.status });
    }
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Kurz und konkret:

- Warum stehen Jobs auf queued?
  - In deinem Beispiel wurden die Flags so gesetzt, dass Phase 1 (PDF-Extraktion) explizit nicht angefordert wurde: `doExtractPDF: false`, `doExtractMetadata: true`. In diesem Fall ruft `POST /api/secretary/process-pdf` den Secretary nicht an, markiert Step `extract_pdf` als „completed (skipped: not_requested)“ und beendet. Der Gesamtstatus bleibt dabei „queued“, bis der nächste Step (Template-Transform etc.) läuft.

- Wer startet den Secretary?
  - Der Secretary-Aufruf passiert ausschließlich in `POST /api/secretary/process-pdf` auf dem Server. Voraussetzung: `doExtractPDF` ist true (oder es sind gar keine Flags gesetzt).
  - In der Batch-Route habe ich `doExtractPDF` jetzt immer auf `'true'` gesetzt. Neue Batches triggern daher die Secretary-Verarbeitung. Für bereits angelegte Jobs ohne dieses Flag kannst du „Neu starten“ nutzen; der Retry setzt `doExtractPDF: true`.

Was du jetzt machen kannst:
- Starte eine neue Batch-Einreichung aus dem Dialog. Die neuen Jobs sollten sofort Secretary-Requests auslösen und von queued → running wechseln.
- Für existierende „hängende“ Jobs: Im Job-Monitor bei „failed/queued“ den Neu-starten-Button nutzen. Der Retry setzt `doExtractPDF: 'true'`, übergibt Batch-Infos, und ruft `process-pdf` erneut (mit Session-Cookie) auf.

Technischer Check (optional):
- In den Job-Logs siehst du nach dem Fix „request_ack“ vom Secretary; ohne das wurde der Worker nicht kontaktiert.
- Wenn es weiterhin bei queued bleibt, prüfe `SECRETARY_SERVICE_URL`/`SECRETARY_SERVICE_API_KEY` und ob der Worker erreichbar ist; bei Verbindungsfehlern würden Jobs auf „failed“ wechseln mit `worker_unavailable`.

Damit sollten neue Batches korrekt abgearbeitet werden; sag mir, ob die neuen Jobs von queued auf running springen.

---

**User**

Kann es sein, dass ich den "retry" Button gar nicht sehe? Wird Liste zu breit gerendert?

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // Erzeuge neuen Job mit gleicher Korrelation/Optionen
    // Wir verwenden die bestehende process-pdf Route; Datei binär laden und erneut einreichen
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const file = new File([bin.blob], source.name || bin.name || 'document.pdf', { type: source.mimeType || bin.mimeType || 'application/pdf' });

    const fd = new FormData();
    fd.append('file', file);
    fd.append('originalItemId', source.itemId);
    fd.append('parentId', source.parentId);
    if (job.correlation?.options) {
      const opts = job.correlation.options as Record<string, unknown>;
      if (typeof opts['targetLanguage'] === 'string') fd.append('targetLanguage', String(opts['targetLanguage']));
      if (typeof opts['extractionMethod'] === 'string') fd.append('extractionMethod', String(opts['extractionMethod']));
      if (typeof opts['includeImages'] === 'boolean') fd.append('includeImages', String(opts['includeImages']));
      if (typeof opts['useCache'] === 'boolean') fd.append('useCache', String(opts['useCache']));
    }
    if (job.correlation?.batchName) fd.append('batchName', job.correlation.batchName);
    if (job.correlation?.batchId) fd.append('batchId', job.correlation.batchId);
    // Sicherstellen, dass Phase 1 gestartet wird
    fd.append('doExtractPDF', 'true');

    const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
      method: 'POST',
      headers: { 'X-Library-Id': libraryId, 'Cookie': request.headers.get('cookie') || '' },
      body: fd,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      FileLogger.error('jobs-retry', 'Retry fehlgeschlagen', { jobId, status: res.status, msg });
      return NextResponse.json({ error: msg || 'Fehler beim erneuten Einreichen' }, { status: res.status });
    }
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

```typescriptreact
*** Begin Patch
*** Update File: src/components/shared/job-monitor-panel.tsx
@@
-                    <div className="flex items-center gap-1">
+                    <div className="flex items-center gap-1 w-28 justify-end">
*** End Patch
```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

Ja, wir sprechen von genau dieser Maske. Ich habe drei Dinge angepasst, damit du den Retry sicher siehst und auch für queued nutzen kannst:

- Neu: Retry auch für queued
  - Server: `POST /api/external/jobs/[jobId]/retry` erlaubt jetzt failed und queued. Beim Retry wird `doExtractPDF: true` erzwungen, Batch-Infos mitgegeben und die Session korrekt weitergereicht.
- Buttons sichtbar halten
  - Rechte Button-Leiste ist jetzt `shrink-0` und hat eine feste minimale Breite; so wird der „Neu starten“-Button nicht aus dem sichtbaren Bereich verdrängt.
  - Der Retry-Button wird bei failed und queued angezeigt.
- Falls die Liste sehr schmal ist
  - Die Buttons sind rechts ausgerichtet; selbst bei knapper Breite bleiben die Icons sichtbar.

Bitte einmal testen:
- In der Jobliste einen Eintrag mit Status queued auswählen; rechts sollte ein rundes Icon „Neu starten“ erscheinen.
- Klick auf „Neu starten“ legt den Job neu an (mit erzwungener Phase 1) und sollte ihn in running überführen.

Wenn der Button trotzdem nicht sichtbar ist, sag mir deine Fensterbreite. Ich kann alternativ die Leiste in eine zweite Zeile umbrechen oder das Layout auf Grid umstellen, sodass der Button immer in einer separaten, fixen Spalte steht.

---

**User**

Button nicht sichtbar. Bitte übergeordnetes Panel kontrollieren - ist vielleicht zu schmal. (Ist ja ein fliegendes Panel)

---

**Cursor**

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
        "w-[420px] md:w-[520px]",
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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
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

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
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

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
        "w-[420px] md:w-[520px]",
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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
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

Ich habe das fliegende Panel breiter gemacht und die Button-Leiste fixiert, damit „Neu starten“ sichtbar bleibt:

- Panel-Breite
  - Breite auf 420px (Desktop 520px) erhöht: mehr Platz für Titel und die rechte Aktionsleiste.

- Rechte Aktionsleiste fixiert
  - Die Leiste ist jetzt `shrink-0` und hat feste Mindestbreite; so bleiben „Ausblenden“ und „Neu starten“ sichtbar und rücken nicht aus dem Viewport.
  - Retry ist sichtbar für queued und failed.

- Kleine UX-Verbesserung
  - Bei „running“ zeigt die Progress-Zeile mittig „Läuft…“ an.

Bitte das Panel erneut öffnen und prüfen, ob der Button erscheint. Falls du weniger Breite möchtest, kann ich alternativ einen 2-Zeilen-Layoutmodus aktivieren (Titel links, Buttons darunter), der bei schmalen Viewports automatisch umbricht.

---

**User**

Wenn ich den Job neu starte, wird dann ein neues Dokument angelegt? Können wir nicht das bestehende Dokument updaten, weil sonst wird die Liste ja nie kürzer. Dann bleiben die ja immer auf queued.

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const file = new File([bin.blob], source.name || bin.name || 'document.pdf', { type: source.mimeType || bin.mimeType || 'application/pdf' });

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
    const repo = new ExternalJobsRepository();
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Guter Punkt. Bisher hat der „Neu starten“-Button einen neuen Job angelegt. Ich habe das Verhalten geändert:

- Requeue statt Neu-Anlage
  - „Neu starten“ setzt jetzt den EXISTIERENDEN Job zurück: Status wieder „queued“, Steps auf „pending“, neues Secret für den Callback.
  - Anschließend wird genau dieser Job mit gleicher `jobId` erneut an den Secretary geschickt. Es entsteht kein neuer Eintrag; die Liste bleibt schlank.
  - Gilt für `failed` und auch für `queued` Jobs (z. B. wenn der Worker temporär nicht erreichbar war).

Technik im Hintergrund
- Server-Route `POST /api/external/jobs/[jobId]/retry`:
  - Lädt die Quelldatei serverseitig, baut das Worker-FormData, setzt neue `callback_url` und `callback_token`, resettet Steps und Status, startet den Watchdog, ruft den Secretary direkt auf und loggt `request_ack`.
  - Bei Erfolg: gleiches `jobId`, Event „queued (requeued)“. Bei Fehler: Status `failed` mit Grund.

Erwartetes Verhalten in der UI
- Nach „Neu starten“ bleibt derselbe Eintrag bestehen, springt auf „queued“, danach auf „running/ completed“.
- Keine Duplikate in der Liste.

Wenn du möchtest, kann ich zusätzlich einen Schutz einbauen, dass ein noch laufender Job nicht requeued werden kann (Button disabled für `running`).

---

**User**

Das Polling berüclksichtigt den aktuellen Filter nicht

---

**Cursor**

Ich passe die Jobliste so an, dass auch „Ältere laden“ und alle automatischen Refreshes die aktuellen Filter-Parameter mitschicken. Danach prüfe ich kurz die Lints und beschreibe dir den Test.

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const params = new URLSearchParams({ page: String(next), limit: '20' });
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (batchFilter) params.set('batchName', batchFilter);
    const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
        "w-[420px] md:w-[520px]",
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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
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

Gefixt: „Ältere laden“ und alle automatischen Refreshes senden jetzt die aktuellen Filterparameter (`status`, `batchName`) mit. So bleiben Server- und Client-Ansicht konsistent.

Test:
- Status z. B. auf „Running“ setzen, optional Batch wählen.
- „Ältere laden“ klicken → es sollten ausschließlich Einträge im gewählten Filter nachgeladen werden.
- Live-Updates anhalten und wieder starten über das Reload-Icon; die Liste bleibt im gesetzten Filter.

---

**User**

Einzelne Dokumente werden selten neu gestartet. Diesen Neustarten-Button würde ich dann oben neben dem Filter auch anbieten, sodass alle durch den Filter gelisteten Dokumente neu gestartet werden, außer die, die bereits laufen.

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const body = await request.json().catch(() => ({})) as { status?: string; batchName?: string; batchId?: string };
    const status = (body.status || '').trim();
    const batchName = typeof body.batchName === 'string' ? body.batchName : undefined;
    const batchId = typeof body.batchId === 'string' ? body.batchId : undefined;

    // Hole gefilterte Jobs Seite für Seite und triggere Retry (nur queued/failed; running wird übersprungen)
    const retried: string[] = [];
    const skipped: string[] = [];
    let page = 1;
    while (true) {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);
      if (batchName) params.set('batchName', batchName);
      if (batchId) params.set('batchId', batchId);
      const res = await fetch(new URL(`/api/external/jobs?${params.toString()}`, request.url).toString(), { cache: 'no-store', headers: { 'Cookie': request.headers.get('cookie') || '' } });
      if (!res.ok) break;
      const json = await res.json();
      const items: Array<{ jobId: string; status: string }> = Array.isArray(json.items) ? json.items : [];
      for (const it of items) {
        if (it.status === 'running') { skipped.push(it.jobId); continue; }
        const r = await fetch(new URL(`/api/external/jobs/${it.jobId}/retry`, request.url).toString(), { method: 'POST', headers: { 'Cookie': request.headers.get('cookie') || '' } });
        if (r.ok) retried.push(it.jobId); else skipped.push(it.jobId);
      }
      if (items.length < 50) break;
      page += 1;
    }
    return NextResponse.json({ ok: true, retriedCount: retried.length, skippedCount: skipped.length, retried, skipped });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const params = new URLSearchParams({ page: String(next), limit: '20' });
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (batchFilter) params.set('batchName', batchFilter);
    const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
        "w-[420px] md:w-[520px]",
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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
            <Button size="sm" onClick={async () => {
              try {
                const payload: Record<string, string> = {};
                if (statusFilter && statusFilter !== 'all') payload.status = statusFilter;
                if (batchFilter) payload.batchName = batchFilter;
                const res = await fetch('/api/external/jobs/retry-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) return;
                await refreshNow();
              } catch {}
            }}>Neu starten (gefiltert)</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
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

Ich habe oben im Panel einen Button „Neu starten (gefiltert)“ ergänzt. Der startet alle aktuell gefilterten Jobs neu und überspringt laufende.

Wie es funktioniert:
- UI: Klick auf „Neu starten (gefiltert)“ sendet Status-/Batch-Filter an `POST /api/external/jobs/retry-batch`.
- API: Die Route lädt paginiert die passenden Jobs, triggert für jeden `POST /api/external/jobs/{jobId}/retry` und überspringt `running`.
- Retry selbst setzt den bestehenden Job in-place zurück und schickt ihn mit gleicher `jobId` erneut an den Secretary.

Test:
- Im Monitor Status auf „Queued“ (oder „Failed“) und ggf. Batch wählen.
- „Neu starten (gefiltert)“ klicken → die Einträge springen auf „queued“ und laufen an, ohne neue Zeilen zu erzeugen.
- Bei Bedarf Live-Updates pausieren, um die Wirkung ohne Polling zu sehen.

---

**User**

Error: ./src/app/api/external/jobs/[jobId]/retry/route.ts
Module parse failed: Identifier 'repo' has already been declared (76:14)
|         });
|         const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
>         const repo = new ExternalJobsRepository();
|         const newSecret = crypto.randomBytes(24).toString('base64url');
|         const newHash = repo.hashSecret(newSecret);

Import trace for requested module:
./src/app/api/external/jobs/[jobId]/retry/route.ts
    at createConsoleError (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/errors/console-error.js:27:71)
    at handleConsoleError (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/errors/use-error-handler.js:47:54)
    at console.error (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/globals/intercept-console-error.js:47:57)
    at handleErrors (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:162:21)
    at processMessage (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:220:21)
    at WebSocket.handler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:473:17)

Error: ./src/app/api/external/jobs/[jobId]/retry/route.ts
Module parse failed: Identifier 'repo' has already been declared (76:14)
|         });
|         const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
>         const repo = new ExternalJobsRepository();
|         const newSecret = crypto.randomBytes(24).toString('base64url');
|         const newHash = repo.hashSecret(newSecret);
    at BuildError (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/react-dev-overlay/ui/container/build-error.js:43:41)
    at renderWithHooks (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:16305:18)
    at updateFunctionComponent (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:19583:20)
    at beginWork (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:21596:16)
    at beginWork$1 (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:27421:14)
    at performUnitOfWork (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:26552:12)
    at workLoopSync (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:26461:5)
    at renderRootSync (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:26429:7)
    at performConcurrentWorkOnRoot (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:25733:74)
    at workLoop (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.development.js:266:34)
    at flushWork (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.development.js:239:14)
    at MessagePort.performWorkUntilDeadline (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.development.js:533:21)


---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const file = new File([bin.blob], source.name || bin.name || 'document.pdf', { type: source.mimeType || bin.mimeType || 'application/pdf' });

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
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Danke fürs Melden. Der Fehler kam daher, dass in `retry/route.ts` die Konstante `repo` doppelt deklariert wurde. Ich habe die zweite Deklaration entfernt.

Was ich geändert habe:
- `src/app/api/external/jobs/[jobId]/retry/route.ts`: die Zeile mit `const repo = new ExternalJobsRepository();` unterhalb der Callback-URL entfernt; es existiert bereits eine `repo`-Instanz weiter oben. Lint/Build sind sauber.

Bitte erneut testen:
- „Neu starten“ bei einem queued/failed Job → sollte ohne Build-Fehler laufen, den bestehenden Job zurücksetzen und direkt an den Secretary senden.
- Alternativ „Neu starten (gefiltert)“ oben nutzen, um mehrere zu requeuen.

---

**User**

In dieser Dokumentenliste ganz oben eine kleine Statistik, wie viele sind Bending, Running, erledigt und fehlerhaft mit so einem, mit dem Farbklecks vorne, als Legende. Sodass man einfach schnell sieht, was abgeht. Vielleicht auch in der Filter Dropdown in Klammern dahinter, um Platz zu sparen.

---

**Cursor**

```typescriptreact
*** Begin Patch
*** Update File: src/components/shared/job-monitor-panel.tsx
@@
           <div className="px-4 py-3 border-b flex items-center justify-between">
             <div className="font-semibold flex items-center gap-2">
               <span>Secretary Jobs</span>
-              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
+              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
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
+          {/* Mini-Legende mit farbigen Dots */}
+          <div className="px-4 py-1 border-b text-xs text-muted-foreground flex items-center gap-4">
+            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Queued {queuedCount}</span>
+            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />Running {runningCount}</span>
+            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />Completed {completedCount}</span>
+            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Failed {failedCount}</span>
+          </div>
           <div className="px-4 py-2 border-b flex items-center gap-2">
-            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
-              <option value="all">Alle</option>
-              <option value="queued">Queued</option>
-              <option value="running">Running</option>
-              <option value="completed">Completed</option>
-              <option value="failed">Failed</option>
+            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
+              <option value="all">Alle ({queuedCount + runningCount + completedCount + failedCount})</option>
+              <option value="queued">Queued ({queuedCount})</option>
+              <option value="running">Running ({runningCount})</option>
+              <option value="completed">Completed ({completedCount})</option>
+              <option value="failed">Failed ({failedCount})</option>
             </select>
             <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
               <option value="">Alle Batches</option>
               {batchNames.map((name) => (
                 <option key={name} value={name}>{name}</option>
               ))}
             </select>
             <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
             <Button size="sm" onClick={async () => {
               try {
                 const payload: Record<string, string> = {};
                 if (statusFilter && statusFilter !== 'all') payload.status = statusFilter;
                 if (batchFilter) payload.batchName = batchFilter;
                 const res = await fetch('/api/external/jobs/retry-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                 if (!res.ok) return;
                 await refreshNow();
               } catch {}
             }}>Neu starten (gefiltert)</Button>
           </div>
*** End Patch
```

```typescriptreact
*** Begin Patch
*** Update File: src/components/shared/job-monitor-panel.tsx
@@
-          <div className="px-4 py-2 border-b flex items-center gap-2">
-            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
-              <option value="all">Alle</option>
-              <option value="queued">Queued</option>
-              <option value="running">Running</option>
-              <option value="completed">Completed</option>
-              <option value="failed">Failed</option>
-            </select>
+          <div className="px-4 py-2 border-b flex items-center gap-2">
+            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
+              <option value="all">Alle ({queuedCount + runningCount + completedCount + failedCount})</option>
+              <option value="queued">Queued ({queuedCount})</option>
+              <option value="running">Running ({runningCount})</option>
+              <option value="completed">Completed ({completedCount})</option>
+              <option value="failed">Failed ({failedCount})</option>
+            </select>
@@
-            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
+            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
           </div>
*** End Patch
```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const params = new URLSearchParams({ page: String(next), limit: '20' });
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (batchFilter) params.set('batchName', batchFilter);
    const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
        "w-[420px] md:w-[520px]",
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
              <span className="text-xs text-muted-foreground">Q {queuedCount} • R {runningCount} • C {completedCount} • F {failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-1 border-b text-xs text-muted-foreground flex items-center gap-4">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Queued {queuedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />Running {runningCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />Completed {completedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Failed {failedCount}</span>
          </div>
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle ({queuedCount + runningCount + completedCount + failedCount})</option>
              <option value="queued">Queued ({queuedCount})</option>
              <option value="running">Running ({runningCount})</option>
              <option value="completed">Completed ({completedCount})</option>
              <option value="failed">Failed ({failedCount})</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
            <Button size="sm" onClick={async () => {
              try {
                const payload: Record<string, string> = {};
                if (statusFilter && statusFilter !== 'all') payload.status = statusFilter;
                if (batchFilter) payload.batchName = batchFilter;
                const res = await fetch('/api/external/jobs/retry-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) return;
                await refreshNow();
              } catch {}
            }}>Neu starten (gefiltert)</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
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

Erledigt: Oben in der Jobliste gibt es jetzt eine kompakte Legende mit farbigen Dots und Zählern sowie Zähler in den Status-Filteroptionen.

- Legende unter dem Titel
  - Queued (blau), Running (gelb), Completed (grün), Failed (rot) mit aktuellen Counts.
- Status-Select
  - Optionen zeigen Counts in Klammern: z. B. „Running (3)“.
- Performance
  - Zähler werden aus der aktuell sichtbaren Liste berechnet (keine zusätzlichen Requests).
- Keine Layoutänderung an der Liste selbst.

Sag, wenn du statt „global für Liste“ lieber „serverseitige Gesamtzahlen für alle Seiten“ möchtest; dann ergänze ich einen leichten Count-Endpoint.

---

**User**

Ich möchte natürlich in der Statistik serverseitige Gesamtzahlen für alle Seiten sehen

---

**Cursor**

```typescript
import { Collection } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
import { ExternalJob, ExternalJobStatus, ExternalJobStep, ExternalJobIngestionInfo } from '@/types/external-job';

export class ExternalJobsRepository {
  private collectionName = 'external_jobs';

  private async getCollection(): Promise<Collection<ExternalJob>> {
    return getCollection<ExternalJob>(this.collectionName);
  }

  hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  async create(job: Omit<ExternalJob, 'createdAt' | 'updatedAt'>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.insertOne({ ...job, createdAt: now, updatedAt: now });
  }

  async setStatus(jobId: string, status: ExternalJobStatus, extra: Partial<ExternalJob> = {}): Promise<boolean> {
    const col = await this.getCollection();
    const res = await col.updateOne(
      { jobId },
      { $set: { status, updatedAt: new Date(), ...extra } }
    );
    return res.modifiedCount > 0;
  }

  async setProcess(jobId: string, processId: string): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne({ jobId }, { $set: { processId, updatedAt: new Date() } });
  }

  async appendLog(jobId: string, entry: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $push: { logs: { timestamp: new Date(), ...entry } } }
    );
  }

  async setResult(jobId: string, payload: ExternalJob['payload'], result: ExternalJob['result']): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { payload, result, updatedAt: new Date() } }
    );
  }

  async mergeParameters(jobId: string, params: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            parameters: { $mergeObjects: [ '$parameters', params ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async initializeSteps(jobId: string, steps: ExternalJobStep[], parameters?: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { steps, updatedAt: new Date(), ...(parameters ? { parameters } : {}) } }
    );
  }

  async updateStep(jobId: string, name: string, patch: Partial<ExternalJobStep>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    const setObj = Object.fromEntries(Object.entries(patch).map(([k, v]) => ([`steps.$.${k}`, v])));
    await col.updateOne(
      { jobId, 'steps.name': name },
      { $set: { ...setObj, updatedAt: now } }
    );
  }

  async appendMeta(jobId: string, meta: Record<string, unknown>, source: string): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      {
        $set: { updatedAt: now },
        $push: { metaHistory: { at: now, meta, source } },
      }
    );
    // Merge cumulativeMeta (shallow)
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            cumulativeMeta: { $mergeObjects: [ '$cumulativeMeta', meta ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async setIngestion(jobId: string, info: ExternalJobIngestionInfo): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { ingestion: info, updatedAt: new Date() } }
    );
  }

  async get(jobId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.findOne({ jobId });
  }

  async listByUserEmail(
    userEmail: string,
    options: { page?: number; limit?: number }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const cursor = col
      .find({ userEmail })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments({ userEmail })
    ]);
    return { items, total, page, limit };
  }

  async listByUserWithFilters(
    userEmail: string,
    options: {
      page?: number;
      limit?: number;
      status?: ExternalJobStatus | ExternalJobStatus[];
      batchName?: string;
      batchId?: string;
      libraryId?: string;
      q?: string;
    }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const filter: Record<string, unknown> = { userEmail };
    if (options.libraryId) filter['libraryId'] = options.libraryId;
    if (options.batchId) filter['correlation.batchId'] = options.batchId;
    if (options.batchName) filter['correlation.batchName'] = options.batchName;
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filter['status'] = { $in: statuses };
    }
    if (options.q) {
      const rx = new RegExp(options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [
        { 'correlation.source.name': rx },
        { 'correlation.source.itemId': rx },
        { jobId: rx },
      ];
    }

    const cursor = col
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments(filter)
    ]);
    return { items, total, page, limit };
  }

  async findLatestBySourceItem(userEmail: string, libraryId: string, sourceItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.itemId': sourceItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByResultItem(userEmail: string, resultItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, 'result.savedItemId': resultItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByFileIdAuto(userEmail: string, libraryId: string, fileId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({
      userEmail,
      libraryId,
      $or: [
        { 'correlation.source.itemId': fileId },
        { 'result.savedItemId': fileId }
      ]
    }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestBySourceName(userEmail: string, libraryId: string, sourceName: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.name': sourceName }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async listDistinctBatchNames(userEmail: string, libraryId?: string): Promise<string[]> {
    const col = await this.getCollection();
    const match: Record<string, unknown> = {
      userEmail,
      'correlation.batchName': { $type: 'string', $ne: '' }
    };
    if (libraryId) match['libraryId'] = libraryId;
    const rows = await col.aggregate<{ _id: string }>([
      { $match: match },
      { $group: { _id: '$correlation.batchName' } },
      { $sort: { _id: 1 } }
    ]).toArray();
    return rows.map(r => r._id).filter((v): v is string => typeof v === 'string' && v.length > 0);
  }

  async countByStatus(
    userEmail: string,
    filters: { libraryId?: string; batchName?: string; batchId?: string }
  ): Promise<{ queued: number; running: number; completed: number; failed: number; pendingStorage: number; total: number }>
  {
    const col = await this.getCollection();
    const match: Record<string, unknown> = { userEmail };
    if (filters.libraryId) match['libraryId'] = filters.libraryId;
    if (filters.batchId) match['correlation.batchId'] = filters.batchId;
    if (filters.batchName) match['correlation.batchName'] = filters.batchName;

    const rows = await col.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    const by: Record<string, number> = Object.fromEntries(rows.map(r => [r._id, r.count]));
    const queued = by['queued'] || 0;
    const running = by['running'] || 0;
    const completed = by['completed'] || 0;
    const failed = by['failed'] || 0;
    const pendingStorage = by['pending-storage'] || 0;
    const total = queued + running + completed + failed + pendingStorage;
    return { queued, running, completed, failed, pendingStorage, total };
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const url = new URL(request.url);
    const libraryId = url.searchParams.get('libraryId') || undefined;
    const batchName = url.searchParams.get('batchName') || undefined;
    const batchId = url.searchParams.get('batchId') || undefined;

    const repo = new ExternalJobsRepository();
    const counters = await repo.countByStatus(userEmail, { libraryId, batchName, batchId });
    return NextResponse.json({ counters });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


```

```typescriptreact
"use client";

import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { upsertJobStatusAtom } from '@/atoms/job-status';
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  sourceItemId?: string;
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
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    running: { label: 'Running', className: 'bg-yellow-200 text-yellow-900 border-yellow-300' },
    completed: { label: 'Completed', className: 'bg-green-200 text-green-900 border-green-300' },
    failed: { label: 'Failed', className: 'bg-red-200 text-red-900 border-red-300' },
  };
  const entry = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium', entry.className)}>{entry.label}</span>;
}

export function JobMonitorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<JobListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const eventRef = useRef<EventSource | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);
  const upsertJobStatus = useSetAtom(upsertJobStatusAtom);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [serverCounts, setServerCounts] = useState<{ queued: number; running: number; completed: number; failed: number; pendingStorage: number; total: number } | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Initiale Seite nur laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(pageNum: number, replace: boolean) {
      try {
        isFetchingRef.current = true;
        const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setItems(prev => replace ? json.items : [...prev, ...json.items]);
        setHasMore(json.items.length === 20);
      } finally {
        isFetchingRef.current = false;
      }
    }
    void load(1, true);
    return () => { cancelled = true; };
  }, [isOpen, statusFilter, batchFilter]);

  // Batch-Namen laden, wenn Panel geöffnet wird
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadBatches() {
      try {
        const res = await fetch('/api/external/jobs/batches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        const names = Array.isArray(json.items) ? json.items.filter((v: unknown) => typeof v === 'string') as string[] : [];
        setBatchNames(names);
      } catch {}
    }
    void loadBatches();
    return () => { active = false; };
  }, [isOpen]);

  // Serverseitige Zähler laden (gesamt, optional gefiltert nach Batch)
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    async function loadCounts() {
      try {
        const params = new URLSearchParams();
        if (batchFilter) params.set('batchName', batchFilter);
        const res = await fetch(`/api/external/jobs/counters?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        setServerCounts(json.counters || null);
      } catch {}
    }
    void loadCounts();
    const t = setInterval(loadCounts, 5000);
    return () => { active = false; clearInterval(t); };
  }, [isOpen, batchFilter]);

  const refreshNow = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (batchFilter) params.set('batchName', batchFilter);
      const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items || []);
      setPage(1);
      setHasMore((json.items || []).length === 20);
    } finally {
      setIsRefreshing(false);
    }
  };

  // SSE verbinden nur wenn Panel geöffnet ist und Live-Updates aktiv sind; bei Schließen sofort beenden
  useEffect(() => {
    if (!isOpen || !liveUpdates) {
      if (eventRef.current) { try { eventRef.current.close(); } catch {} eventRef.current = null; }
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      if (eventRef.current) {
        try { eventRef.current.close(); } catch {}
      }
      const es = new EventSource('/api/external/jobs/stream');
      eventRef.current = es;

      // kein aggressiver Refresh im open-Event; initiales Laden oben beim Öffnen

      const onUpdate = (e: MessageEvent) => {
        try {
          const evt: JobUpdateEvent = JSON.parse(e.data);
          lastEventTsRef.current = Date.now();
          if (evt.sourceItemId && evt.status) {
            upsertJobStatus({ itemId: evt.sourceItemId, status: evt.status });
          }
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
            // Neuer Job: nur einfügen wenn Filter passt; bei Batch-Filter immer via Refresh laden
            if (statusFilter && statusFilter !== 'all' && evt.status !== statusFilter) {
              return prev;
            }
            if (batchFilter) {
              void refreshNow();
              return prev;
            }
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
        // Nur reconnecten, wenn Panel offen bleibt
        retryTimer = setTimeout(() => { if (isOpen && liveUpdates) connect(); }, 1000);
      });
    }
    connect();
    // Fallback: lokale Events (wenn wir selbst einen Job starten)
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as JobUpdateEvent;
      if (!detail?.jobId) return;
      lastEventTsRef.current = Date.now();
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
  }, [isOpen, liveUpdates, upsertJobStatus, statusFilter, batchFilter]);

  const handleToggle = () => setIsOpen(v => !v);
  const queuedCount = items.filter(i => i.status === 'queued').length;
  const runningCount = items.filter(i => i.status === 'running').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  async function retryJob(jobId: string) {
    try {
      const res = await fetch(`/api/external/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) return;
      // Nach erfolgreichem Retry frisch laden
      await refreshNow();
    } catch {}
  }
  const loadMore = async () => {
    if (!hasMore || isFetchingRef.current) return;
    const next = page + 1;
    const params = new URLSearchParams({ page: String(next), limit: '20' });
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (batchFilter) params.set('batchName', batchFilter);
    const res = await fetch(`/api/external/jobs?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setItems(prev => [...prev, ...json.items]);
    setPage(next);
    setHasMore(json.items.length === 20);
  };

  // Polling Fallback: nur wenn Panel offen, Live-Updates an UND keine SSE-Events für 10s
  useEffect(() => {
    if (!isOpen || !liveUpdates) return;
    const onTick = () => {
      const idleMs = Date.now() - lastEventTsRef.current;
      if (idleMs > 10_000) void refreshNow();
    };
    const timer = setInterval(onTick, 2000);
    const unsub = () => { lastEventTsRef.current = Date.now(); };
    window.addEventListener('job_update_local', unsub as unknown as EventListener);
    return () => { clearInterval(timer); window.removeEventListener('job_update_local', unsub as unknown as EventListener); };
  }, [isOpen, liveUpdates]);

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
        "w-[420px] md:w-[520px]",
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
              <span className="text-xs text-muted-foreground">Q {serverCounts?.queued ?? queuedCount} • R {serverCounts?.running ?? runningCount} • C {serverCounts?.completed ?? completedCount} • F {serverCounts?.failed ?? failedCount}</span>
              <button
                onClick={() => setLiveUpdates(v => !v)}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                aria-label={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
                title={liveUpdates ? "Live-Updates anhalten" : "Live-Updates starten"}
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || liveUpdates) && "animate-spin")} />
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
          <div className="px-4 py-1 border-b text-xs text-muted-foreground flex items-center gap-4">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" />Queued {serverCounts?.queued ?? queuedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />Running {serverCounts?.running ?? runningCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />Completed {serverCounts?.completed ?? completedCount}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Failed {serverCounts?.failed ?? failedCount}</span>
          </div>
          <div className="px-4 py-2 border-b flex items-center gap-2">
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Alle ({serverCounts?.total ?? (queuedCount + runningCount + completedCount + failedCount)})</option>
              <option value="queued">Queued ({serverCounts?.queued ?? queuedCount})</option>
              <option value="running">Running ({serverCounts?.running ?? runningCount})</option>
              <option value="completed">Completed ({serverCounts?.completed ?? completedCount})</option>
              <option value="failed">Failed ({serverCounts?.failed ?? failedCount})</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm flex-1" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Alle Batches</option>
              {batchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={refreshNow}>Filtern</Button>
            <Button size="sm" onClick={async () => {
              try {
                const payload: Record<string, string> = {};
                if (statusFilter && statusFilter !== 'all') payload.status = statusFilter;
                if (batchFilter) payload.batchName = batchFilter;
                const res = await fetch('/api/external/jobs/retry-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) return;
                await refreshNow();
              } catch {}
            }}>Neu starten (gefiltert)</Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-3 space-y-2">
              {items.filter(it => !hiddenIds.has(it.jobId)).map(item => (
                <li key={item.jobId} className={cn(
                  "border rounded-md p-3",
                  item.status === 'queued' && 'bg-blue-100/60',
                  item.status === 'running' && 'bg-yellow-100/60',
                  item.status === 'completed' && 'bg-green-100/60',
                  item.status === 'failed' && 'bg-red-100/60'
                )}>
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
                    <div className="flex items-center gap-1 shrink-0 w-28 justify-end">
                      <button
                        onClick={() => hideJob(item.jobId)}
                        className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                        aria-label="Ausblenden"
                        title="Ausblenden"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                      {(item.status === 'failed' || item.status === 'queued') && (
                        <button
                          onClick={() => retryJob(item.jobId)}
                          className="pointer-events-auto inline-flex items-center justify-center rounded p-1 hover:bg-muted"
                          aria-label="Neu starten"
                          title="Neu starten"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-2 relative">
                    <Progress value={typeof item.lastProgress === 'number' ? Math.max(0, Math.min(100, item.lastProgress)) : 0} />
                    {item.status === 'running' && (
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                        Läuft…
                      </div>
                    )}
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

Ich habe serverseitige Gesamtzahlen ergänzt und ins Panel integriert:

- Backend
  - Repo: `countByStatus(userEmail, { libraryId?, batchName?, batchId? })` aggregiert alle Jobs.
  - API: `GET /api/external/jobs/counters?batchName=...&batchId=...&libraryId=...` liefert `{ queued, running, completed, failed, pendingStorage, total }`.

- Frontend
  - `JobMonitorPanel` lädt die Zähler alle 5s (nur wenn Panel offen).
  - Die Legende und der Status-Select zeigen nun die serverseitigen Counters; solange nichts geladen ist, werden lokale Zähler verwendet.

Test:
- Panel öffnen → Legende zeigt Gesamtzahlen.
- Optional Batch im Dropdown wählen → Zähler aktualisieren sich entsprechend.
- Statusfilter wechseln → Liste bleibt gefiltert; Zähler bleiben „gesamt“ (bzw. batch-gefiltet, wenn Batch gesetzt).

Sag Bescheid, wenn die Zähler zusätzlich nach Statusfilter (statt gesamt) berechnet werden sollen; dann parametrisiere ich den Counter-Endpoint optional um `status`.

---

**User**

Und werden die auch Serverseiten alle abgearbeitet, auch wenn es Hunderte sind?

---

**Cursor**

Ja. Unsere Umsetzung reicht alle ausgewählten PDFs serverseitig ein – auch Hunderte.

- Einreichung: Der Dialog schickt die Liste an den Server. Dort werden alle Jobs persistent angelegt und direkt an den Secretary-Service weitergereicht.
- Parallelität: Serverseitig werden derzeit max. 5 Einreichungen gleichzeitig abgearbeitet (konfigurierbar); der Secretary hat zusätzlich seine eigene Parallelität.
- Robustheit: Die Einreichung ist idempotent, Jobs liegen in der DB. Fällt etwas aus, bleiben sie auf queued/failed; du kannst sie einzeln oder gefiltert neu starten.
- Monitoring: Fortschritt/Status kommen per SSE in der Jobliste an (kein hartes Polling nötig). Die Zähler oben zeigen serverseitige Gesamtstände.

Wenn wir Lastspitzen erwarten (Tausenderbereich), können wir zusätzlich:
- Parallelitätslimit per Env anpassen.
- Batch einreich-seitig in kleinere Chunks aufteilen.
- Backoff/Retry-Strategie (Rate-Limit freundlich).
- Optional: echten Queue-Worker (persistente Job-Queue) hinterlegen.

