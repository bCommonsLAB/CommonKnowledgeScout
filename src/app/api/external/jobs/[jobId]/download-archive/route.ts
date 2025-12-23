import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getSecretaryConfig } from '@/lib/env'

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
    const { baseUrl: base } = getSecretaryConfig();
    const targetUrl = isAbsolute ? archiveUrl : `${base}${archiveUrl.startsWith('/') ? '' : '/'}${archiveUrl}`;

    // Mit Service-Auth an Secretary weiterreichen
    const { apiKey } = getSecretaryConfig();
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-Secretary-Api-Key'] = apiKey;
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


