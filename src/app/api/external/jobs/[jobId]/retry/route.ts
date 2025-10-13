import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateExtractPdf } from '@/lib/processing/gates';
import { getPolicies, shouldRunExtract } from '@/lib/processing/phase-policy';
import { LibraryService } from '@/lib/services/library-service';
import { getServerProvider } from '@/lib/storage/server-provider';
import { TransformService } from '@/lib/transform/transform-service';
import { FileLogger } from '@/lib/debug/logger';
import { describeIndex, upsertVectorsChunked } from '@/lib/chat/pinecone';
import { loadLibraryChatContext } from '@/lib/chat/loader';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Interner Bypass für Worker-Aufrufe
    const internalBypass = (() => {
      const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token');
      const envToken = process.env.INTERNAL_TEST_TOKEN || '';
      return !!t && !!envToken && t === envToken;
    })();

    const { userId } = getAuth(request);
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
      await repo.appendLog(jobId, { phase: 'requeue_blocked_already_active', message: `Status=${job.status}` } as unknown as Record<string, unknown>);
      return NextResponse.json({ error: 'Job bereits aktiv' }, { status: 409 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

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
    FileLogger.info('external-jobs-retry', 'Requeue gestartet', { jobId, callbackUrl })
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
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
      if (!runExtract) {
        // Phase 1 überspringen → Schritte markieren
        await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.exists ? (g.reason || 'artifact_exists') : 'policy_ignore' } });

        // Template-Only Pfad ausführen, falls Policy es verlangt
        if (policies.metadata !== 'ignore') {
          await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
          // Kompaktes Live-Logging + SSE
          await repo.appendLog(jobId, { phase: 'initializing', progress: 5, message: 'Job initialisiert' });
          try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 5, updatedAt: new Date().toISOString(), message: 'initializing', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          await repo.appendLog(jobId, { phase: 'transform_template', progress: 10, message: 'Template-Transformation gestartet' });
          try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 10, updatedAt: new Date().toISOString(), message: 'transform_template', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
          try {
            // Template bestimmen
            const libraries = await LibraryService.getInstance().getUserLibraries(userEmail);
            const lib = libraries.find(l => l.id === libraryId);
            const rootItems = await provider.listItemsById('root');
            const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
            const ensureTemplatesFolderId = async (): Promise<string> => {
              if (templatesFolder) return (templatesFolder as { id: string }).id;
              const created = await provider.createFolder('root', 'templates');
              return created.id;
            };
            const templatesFolderId = await ensureTemplatesFolderId();
            let chosen: { id: string } | undefined;
            if (templatesFolderId) {
              const tplItems = await provider.listItemsById(templatesFolderId);
              const preferredTemplate = ((lib?.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || 'pdfanalyse').trim();
              const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
              chosen = pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) || pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file') as { id: string } | undefined;
            }
            let templateContent = '# {{title}}\n';
            if (chosen) {
              const binTpl = await provider.getBinary(chosen.id);
              templateContent = await binTpl.blob.text();
            }

            // Shadow‑Twin finden und laden
            const siblings = await provider.listItemsById(source.parentId);
            const targetLanguage = String(serviceFormData.get('target_language') || 'de');
            const base = (source.name || 'output').replace(/\.[^/.]+$/, '');
            const expectedName = `${base}.${targetLanguage}.md`;
            const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName) as { id: string } | undefined;
            if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
            const twinBin = await provider.getBinary(twin.id);
            const originalMarkdown = await twinBin.blob.text();
            const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

            // Template-Transform aufrufen
            const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
            const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
            const fd = new FormData();
            fd.append('text', stripped);
            fd.append('target_language', targetLanguage);
            fd.append('template_content', templateContent);
            fd.append('use_cache', 'false');
            const headers: Record<string, string> = { 'Accept': 'application/json' };
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
            await repo.appendLog(jobId, { phase: 'template_request_sent', message: 'Template-Anfrage gesendet', details: { url: transformerUrl, method: 'POST' } as unknown as Record<string, unknown> });
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 30, updatedAt: new Date().toISOString(), message: 'template_request_sent', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
            const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
            const data: unknown = await resp.json().catch(() => ({}));
            if (!resp.ok) {
              await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: (data && typeof data === 'object' && (data as { error?: { message?: string } }).error?.message) || `${resp.status} ${resp.statusText}` } });
              await repo.setStatus(jobId, 'failed');
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'template_failed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
              return NextResponse.json({ error: 'template_failed' }, { status: 500 });
            }
            const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};
            await repo.appendLog(jobId, { phase: 'template_request_ack', status: resp.status, statusText: resp.statusText } as unknown as Record<string, unknown>);
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 60, updatedAt: new Date().toISOString(), message: 'template_request_ack', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}

            await repo.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
            await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });
            const metaKeysCount = typeof mdMeta === 'object' && mdMeta ? Object.keys(mdMeta as Record<string, unknown>).length : 0;
            await repo.appendLog(jobId, { phase: 'transform_meta_completed', progress: 90, message: `Template-Transformation abgeschlossen (${metaKeysCount} Schlüssel)` });
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 90, updatedAt: new Date().toISOString(), message: 'transform_meta_completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}

            // Markdown mit neuem Frontmatter erzeugen und als neue Datei speichern
            const ssotFlat: Record<string, unknown> = {
              job_id: jobId,
              source_file: source.name || 'document.pdf',
              extract_status: 'completed',
              template_status: 'completed',
              summary_language: targetLanguage,
            };
            const mergedMeta = { ...(mdMeta as Record<string, unknown>), ...ssotFlat } as Record<string, unknown>;
            const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
              ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mergedMeta)
              : stripped;
            await repo.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
            await repo.appendLog(jobId, { phase: 'postprocessing_save', progress: 95, message: 'Ergebnisse werden gespeichert' });
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 95, updatedAt: new Date().toISOString(), message: 'postprocessing_save', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}
            const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName, { type: 'text/markdown' });
            const saved = await provider.uploadFile(source.parentId, outFile);
            await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });
            FileLogger.info('external-jobs-retry', 'Shadow‑Twin gespeichert (template-only)', { jobId, fileId: saved.id, name: expectedName })
            await repo.appendLog(jobId, { phase: 'stored_local', progress: 98, message: 'Shadow‑Twin gespeichert' });
            try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'running', progress: 98, updatedAt: new Date().toISOString(), message: 'stored_local', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId }); } catch {}

            // Doc‑Meta in Pinecone upserten (Zero‑Vektor) – template-only Pfad
            try {
              const apiKey = process.env.PINECONE_API_KEY
              if (apiKey) {
                const ctx = await loadLibraryChatContext(userEmail, libraryId)
                if (ctx) {
                  const idx = await describeIndex(ctx.vectorIndex, apiKey)
                  if (idx?.host) {
                    const dim = typeof idx.dimension === 'number' ? idx.dimension : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)
                    const zero = new Array<number>(dim).fill(0)
                    zero[0] = 1
                    const canonicalFileId = source.itemId || saved.id
                    // Idempotenz: alle Doc‑Meta zu dieser Quelle vorab entfernen
                    try {
                      const { deleteByFilter } = await import('@/lib/chat/pinecone')
                      await deleteByFilter(idx.host, apiKey, { sourceFileId: { $eq: canonicalFileId } })
                      await deleteByFilter(idx.host, apiKey, { fileId: { $eq: canonicalFileId } })
                    } catch { /* ignore */ }

                    const meta: Record<string, unknown> = {
                      kind: 'doc', user: userEmail, libraryId, fileId: canonicalFileId, fileName: source.itemId ? (source.name || expectedName) : expectedName,
                      upsertedAt: new Date().toISOString(),
                      docMetaJson: JSON.stringify(mergedMeta || {}),
                      extract_status: 'completed', template_status: 'completed', ingest_status: 'none',
                      sourceFileId: canonicalFileId,
                    }
                    await upsertVectorsChunked(idx.host, apiKey, [{ id: `${canonicalFileId}-meta`, values: zero, metadata: meta }])
                    FileLogger.info('external-jobs-retry', 'Doc‑Meta upserted (template-only)', { jobId, fileId: saved.id })
                  }
                }
              }
            } catch (e) {
              FileLogger.warn('external-jobs-retry', 'Doc‑Meta Upsert fehlgeschlagen (template-only)', { err: String(e) })
            }
          } catch (err) {
            await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: err instanceof Error ? err.message : String(err) } });
            await repo.setStatus(jobId, 'failed');
            return NextResponse.json({ error: 'template_only_failed' }, { status: 500 });
          }
        } else {
          await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        // Neu: statt lokalem Abschluss → interner Callback, damit Ingestion zentral läuft
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
          if (internalToken) headers['X-Internal-Token'] = internalToken;
          const callbackUrl = `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/external/jobs/${jobId}`;
          await fetch(callbackUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              phase: 'template_completed',
              data: {
                extracted_text: newMarkdown,
                metadata: mergedMeta,
                file_name: expectedName,
                parent_id: source.parentId
              }
            })
          });
        } catch {}
        return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true }, mode: 'template_only' });
      }
    } catch {
      // Falls Gate fehlschlägt, wird normal extrahiert
    }

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
    FileLogger.info('external-jobs-retry', 'Secretary Request akzeptiert', { jobId, status: response.status })
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}


