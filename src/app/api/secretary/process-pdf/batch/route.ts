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
    const submitOne = async (it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> => {
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
        const filename = it.name || 'document.pdf';
        const file = new File([blob], filename, { type: it.mimeType || bin.mimeType || 'application/pdf' });

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
    const worker = async () => {
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


