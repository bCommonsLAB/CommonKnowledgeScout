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
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
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
    
    // Extraktionsmethode
    if (formData.has('extractionMethod')) {
      serviceFormData.append('extraction_method', formData.get('extractionMethod') as string);
    } else {
      serviceFormData.append('extraction_method', 'native'); // Standardwert
    }
    
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
    const extractionMethod = (formData.get('extractionMethod') as string) || 'native';
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
              if (lib2 && lib2.type === 'local' && lib2.path) {
                const provider = new FileSystemProvider(lib2.path);
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