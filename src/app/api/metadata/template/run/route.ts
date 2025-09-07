import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { LibraryService } from '@/lib/services/library-service';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';

function stripFrontmatter(markdown: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n?/;
  return markdown.replace(fm, '');
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : '';
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    const ingest = Boolean(body.ingest);
    if (!libraryId || !fileId) return NextResponse.json({ error: 'libraryId und fileId erforderlich' }, { status: 400 });

    // Markdown laden (nur Local Filesystem aktuell)
    const lib = await LibraryService.getInstance().getLibrary(libraryId).catch(() => undefined);
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });

    let markdown = '';
    if (lib.type === 'local') {
      const provider = new FileSystemProvider(lib.path);
      const bin = await provider.getBinary(fileId);
      markdown = await bin.blob.text();
    } else {
      return NextResponse.json({ error: 'Template-Run nur für lokalen Provider implementiert' }, { status: 501 });
    }

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


